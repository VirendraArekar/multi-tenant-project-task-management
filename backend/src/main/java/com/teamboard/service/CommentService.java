package com.teamboard.service;

import com.teamboard.common.exception.ResourceNotFoundException;
import com.teamboard.domain.task.Task;
import com.teamboard.domain.task.TaskComment;
import com.teamboard.domain.task.TaskCommentRepository;
import com.teamboard.domain.task.TaskRepository;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.web.dto.task.AddCommentRequest;
import com.teamboard.web.dto.task.CommentResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class CommentService {

    private final TaskCommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final TenantSecurityService tenantSecurityService;
    private final OutboxService outboxService;

    public CommentService(
            TaskCommentRepository commentRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            TenantSecurityService tenantSecurityService,
            OutboxService outboxService
    ) {
        this.commentRepository = commentRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.tenantSecurityService = tenantSecurityService;
        this.outboxService = outboxService;
    }

    @Transactional
    public CommentResponse addComment(Long orgId, Long taskId, AddCommentRequest request, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Task task = taskRepository.findByIdAndOrganizationId(taskId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId + " in organization: " + orgId));

        User author = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + currentUserId));

        TaskComment comment = new TaskComment(orgId, taskId, currentUserId, request.getContent().trim());
        comment = commentRepository.save(comment);

        outboxService.recordEvent(
                "COMMENT",
                comment.getId().toString(),
                "COMMENT_ADDED",
                "comment-events",
                Map.of(
                        "organizationId", orgId,
                        "projectId", task.getProjectId(),
                        "taskId", taskId,
                        "taskTitle", task.getTitle(),
                        "commentId", comment.getId(),
                        "authorId", currentUserId,
                        "authorName", author.getFullName(),
                        "assigneeId", task.getAssigneeId() != null ? task.getAssigneeId() : 0L,
                        "reporterId", task.getReporterId(),
                        "contentPreview", comment.getContent().length() > 80 ? comment.getContent().substring(0, 80) + "..." : comment.getContent()
                )
        );

        return new CommentResponse(
                comment.getId(),
                taskId,
                currentUserId,
                author.getFullName(),
                author.getEmail(),
                comment.getContent(),
                comment.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public Page<CommentResponse> getComments(Long orgId, Long taskId, Pageable pageable, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        if (!taskRepository.findByIdAndOrganizationId(taskId, orgId).isPresent()) {
            throw new ResourceNotFoundException("Task not found with id: " + taskId + " in organization: " + orgId);
        }

        Page<TaskComment> page = commentRepository.findByOrganizationIdAndTaskId(orgId, taskId, pageable);

        return page.map(c -> new CommentResponse(
                c.getId(),
                c.getTaskId(),
                c.getUserId(),
                c.getAuthor() != null ? c.getAuthor().getFullName() : "Unknown",
                c.getAuthor() != null ? c.getAuthor().getEmail() : null,
                c.getContent(),
                c.getCreatedAt()
        ));
    }
}
