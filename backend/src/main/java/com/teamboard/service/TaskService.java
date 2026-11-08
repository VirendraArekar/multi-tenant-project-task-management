package com.teamboard.service;

import com.teamboard.common.exception.BadRequestException;
import com.teamboard.common.exception.ConflictException;
import com.teamboard.common.exception.ForbiddenException;
import com.teamboard.common.exception.ResourceNotFoundException;
import com.teamboard.domain.organization.Role;
import com.teamboard.domain.project.Project;
import com.teamboard.domain.project.ProjectRepository;
import com.teamboard.domain.task.*;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.web.dto.task.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final TaskLabelRepository taskLabelRepository;
    private final TenantSecurityService tenantSecurityService;
    private final OutboxService outboxService;
    private final CacheInvalidationService cacheInvalidationService;

    public TaskService(
            TaskRepository taskRepository,
            ProjectRepository projectRepository,
            UserRepository userRepository,
            TaskLabelRepository taskLabelRepository,
            TenantSecurityService tenantSecurityService,
            OutboxService outboxService,
            @Autowired(required = false) CacheInvalidationService cacheInvalidationService
    ) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.taskLabelRepository = taskLabelRepository;
        this.tenantSecurityService = tenantSecurityService;
        this.outboxService = outboxService;
        this.cacheInvalidationService = cacheInvalidationService;
    }

    @Transactional
    public TaskResponse createTask(Long orgId, Long projectId, CreateTaskRequest request, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Project project = projectRepository.findByIdAndOrganizationId(projectId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId + " in organization: " + orgId));

        if (project.isArchived()) {
            throw new BadRequestException("Cannot create tasks in an archived project");
        }

        User reporter = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + currentUserId));

        User assignee = null;
        if (request.getAssigneeId() != null) {
            assignee = userRepository.findById(request.getAssigneeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Assignee not found with id: " + request.getAssigneeId()));
            tenantSecurityService.verifyMembership(orgId, assignee.getId());
        }

        // Calculate initial position: max position in column + 65536.0
        TaskStatus status = request.getStatus() != null ? request.getStatus() : TaskStatus.TODO;
        Double maxPos = taskRepository.findMaxPositionByProjectIdAndStatus(projectId, status);
        double position = (maxPos != null ? maxPos + 65536.0 : 65536.0);

        Task task = new Task(
                orgId,
                projectId,
                request.getTitle().trim(),
                request.getDescription(),
                status,
                request.getPriority(),
                request.getAssigneeId(),
                currentUserId,
                request.getDueDate(),
                position
        );

        task = taskRepository.save(task);

        // Save labels
        List<TaskLabel> labels = new ArrayList<>();
        if (request.getLabels() != null) {
            for (LabelDto l : request.getLabels()) {
                TaskLabel label = new TaskLabel(orgId, task.getId(), l.getName().trim(), l.getColor());
                labels.add(taskLabelRepository.save(label));
            }
        }
        task.setLabels(labels);

        // Record domain event in transactional outbox
        Map<String, Object> eventPayload = new HashMap<>();
        eventPayload.put("organizationId", orgId);
        eventPayload.put("projectId", projectId);
        eventPayload.put("projectName", project.getName());
        eventPayload.put("taskId", task.getId());
        eventPayload.put("title", task.getTitle());
        eventPayload.put("status", task.getStatus().name());
        eventPayload.put("priority", task.getPriority().name());
        eventPayload.put("reporterId", currentUserId);
        eventPayload.put("reporterName", reporter.getFullName());
        if (assignee != null) {
            eventPayload.put("assigneeId", assignee.getId());
            eventPayload.put("assigneeName", assignee.getFullName());
            eventPayload.put("assigneeEmail", assignee.getEmail());
        }

        outboxService.recordEvent("TASK", task.getId().toString(), "TASK_CREATED", "task-events", eventPayload);

        if (assignee != null && !assignee.getId().equals(currentUserId)) {
            outboxService.recordEvent("TASK", task.getId().toString(), "TASK_ASSIGNED", "task-events", eventPayload);
        }

        invalidateDashboardCache(orgId);

        return mapToResponse(task, reporter.getFullName(), assignee != null ? assignee.getFullName() : null, assignee != null ? assignee.getEmail() : null);
    }

    @Transactional(readOnly = true)
    public Page<TaskResponse> getTasks(Long orgId, Long projectId, TaskStatus status, Pageable pageable, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Page<Task> page;
        if (status != null) {
            page = taskRepository.findByOrganizationIdAndProjectIdAndStatus(orgId, projectId, status, pageable);
        } else {
            page = taskRepository.findByOrganizationIdAndProjectId(orgId, projectId, pageable);
        }

        return page.map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public KanbanBoardResponse getKanbanBoard(Long orgId, Long projectId, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Project project = projectRepository.findByIdAndOrganizationId(projectId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId + " in organization: " + orgId));

        List<Task> allTasks = taskRepository.findByOrganizationIdAndProjectIdOrderByPositionAsc(orgId, projectId);

        Map<TaskStatus, List<TaskResponse>> columns = new LinkedHashMap<>();
        for (TaskStatus s : TaskStatus.values()) {
            columns.put(s, new ArrayList<>());
        }

        for (Task task : allTasks) {
            columns.get(task.getStatus()).add(mapToResponse(task));
        }

        return new KanbanBoardResponse(projectId, project.getName(), columns);
    }

    @Transactional(readOnly = true)
    public TaskResponse getTask(Long orgId, Long taskId, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Task task = taskRepository.findByIdAndOrganizationId(taskId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId + " in organization: " + orgId));

        return mapToResponse(task);
    }

    @Transactional
    public TaskResponse updateTask(Long orgId, Long taskId, UpdateTaskRequest request, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Task task = taskRepository.findByIdAndOrganizationId(taskId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId + " in organization: " + orgId));

        // Optimistic locking verification
        if (!task.getVersion().equals(request.getVersion())) {
            throw new ConflictException("Conflict detected: This task has been modified by another user. Please reload the board to see the latest changes.");
        }

        Long previousAssigneeId = task.getAssigneeId();

        task.setTitle(request.getTitle().trim());
        task.setDescription(request.getDescription());
        task.setStatus(request.getStatus());
        task.setPriority(request.getPriority());
        task.setDueDate(request.getDueDate());

        User assignee = null;
        if (request.getAssigneeId() != null) {
            assignee = userRepository.findById(request.getAssigneeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Assignee not found with id: " + request.getAssigneeId()));
            tenantSecurityService.verifyMembership(orgId, assignee.getId());
            task.setAssigneeId(assignee.getId());
        } else {
            task.setAssigneeId(null);
        }

        // Update labels
        taskLabelRepository.deleteByTaskId(task.getId());
        List<TaskLabel> newLabels = new ArrayList<>();
        if (request.getLabels() != null) {
            for (LabelDto l : request.getLabels()) {
                TaskLabel label = new TaskLabel(orgId, task.getId(), l.getName().trim(), l.getColor());
                newLabels.add(taskLabelRepository.save(label));
            }
        }
        task.setLabels(newLabels);

        task = taskRepository.saveAndFlush(task);

        Map<String, Object> eventPayload = new HashMap<>();
        eventPayload.put("organizationId", orgId);
        eventPayload.put("projectId", task.getProjectId());
        eventPayload.put("taskId", task.getId());
        eventPayload.put("title", task.getTitle());
        eventPayload.put("status", task.getStatus().name());
        eventPayload.put("priority", task.getPriority().name());
        eventPayload.put("updatedBy", currentUserId);

        outboxService.recordEvent("TASK", task.getId().toString(), "TASK_UPDATED", "task-events", eventPayload);

        // If newly assigned or reassigned to a different user, emit TASK_ASSIGNED
        if (assignee != null && !assignee.getId().equals(previousAssigneeId) && !assignee.getId().equals(currentUserId)) {
            eventPayload.put("assigneeId", assignee.getId());
            eventPayload.put("assigneeName", assignee.getFullName());
            outboxService.recordEvent("TASK", task.getId().toString(), "TASK_ASSIGNED", "task-events", eventPayload);
        }

        invalidateDashboardCache(orgId);

        return mapToResponse(task);
    }

    @Transactional
    public TaskResponse moveTask(Long orgId, Long taskId, MoveTaskRequest request, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Task task = taskRepository.findByIdAndOrganizationId(taskId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId + " in organization: " + orgId));

        // Optimistic locking verification
        if (!task.getVersion().equals(request.getVersion())) {
            throw new ConflictException("Conflict detected: This task has been modified by another user. Please reload the board to see the latest changes.");
        }

        TaskStatus oldStatus = task.getStatus();
        TaskStatus newStatus = request.getTargetStatus();

        task.setStatus(newStatus);
        task.setPosition(request.getTargetPosition());

        task = taskRepository.saveAndFlush(task);

        outboxService.recordEvent(
                "TASK",
                task.getId().toString(),
                "TASK_MOVED",
                "task-events",
                Map.of(
                        "organizationId", orgId,
                        "projectId", task.getProjectId(),
                        "taskId", task.getId(),
                        "title", task.getTitle(),
                        "oldStatus", oldStatus.name(),
                        "newStatus", newStatus.name(),
                        "position", task.getPosition(),
                        "updatedBy", currentUserId
                )
        );

        invalidateDashboardCache(orgId);

        return mapToResponse(task);
    }

    @Transactional
    public void deleteTask(Long orgId, Long taskId, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Task task = taskRepository.findByIdAndOrganizationId(taskId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId + " in organization: " + orgId));

        boolean isReporter = currentUserId.equals(task.getReporterId());
        if (!isReporter) {
            tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);
        }

        taskRepository.delete(task);

        outboxService.recordEvent(
                "TASK",
                taskId.toString(),
                "TASK_DELETED",
                "task-events",
                Map.of(
                        "organizationId", orgId,
                        "projectId", task.getProjectId(),
                        "taskId", taskId,
                        "title", task.getTitle(),
                        "deletedBy", currentUserId
                )
        );

        invalidateDashboardCache(orgId);
    }

    private void invalidateDashboardCache(Long orgId) {
        if (cacheInvalidationService != null) {
            cacheInvalidationService.invalidateDashboard(orgId);
        }
    }

    private TaskResponse mapToResponse(Task task) {
        String reporterName = userRepository.findById(task.getReporterId())
                .map(User::getFullName).orElse("Unknown");

        String assigneeName = null;
        String assigneeEmail = null;
        if (task.getAssigneeId() != null) {
            User assignee = userRepository.findById(task.getAssigneeId()).orElse(null);
            if (assignee != null) {
                assigneeName = assignee.getFullName();
                assigneeEmail = assignee.getEmail();
            }
        }

        return mapToResponse(task, reporterName, assigneeName, assigneeEmail);
    }

    private TaskResponse mapToResponse(Task task, String reporterName, String assigneeName, String assigneeEmail) {
        List<LabelDto> labelDtos = (task.getLabels() != null)
                ? task.getLabels().stream()
                .map(l -> new LabelDto(l.getId(), l.getName(), l.getColor()))
                .collect(Collectors.toList())
                : Collections.emptyList();

        int commentCount = (task.getComments() != null) ? task.getComments().size() : 0;

        return new TaskResponse(
                task.getId(),
                task.getOrganizationId(),
                task.getProjectId(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus(),
                task.getPriority(),
                task.getAssigneeId(),
                assigneeName,
                assigneeEmail,
                task.getReporterId(),
                reporterName,
                task.getDueDate(),
                task.isOverdue(),
                task.getPosition(),
                task.getVersion(),
                labelDtos,
                commentCount,
                task.getCreatedAt(),
                task.getUpdatedAt()
        );
    }
}
