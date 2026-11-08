package com.teamboard.service;

import com.teamboard.common.exception.ResourceNotFoundException;
import com.teamboard.domain.organization.Role;
import com.teamboard.domain.project.Project;
import com.teamboard.domain.project.ProjectRepository;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.web.dto.project.CreateProjectRequest;
import com.teamboard.web.dto.project.ProjectResponse;
import com.teamboard.web.dto.project.UpdateProjectRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final TenantSecurityService tenantSecurityService;
    private final OutboxService outboxService;

    public ProjectService(
            ProjectRepository projectRepository,
            UserRepository userRepository,
            TenantSecurityService tenantSecurityService,
            OutboxService outboxService
    ) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.tenantSecurityService = tenantSecurityService;
        this.outboxService = outboxService;
    }

    @Transactional
    public ProjectResponse createProject(Long orgId, CreateProjectRequest request, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        User creator = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + currentUserId));

        Project project = new Project(orgId, request.getName().trim(), request.getDescription(), currentUserId);
        project = projectRepository.save(project);

        outboxService.recordEvent(
                "PROJECT",
                project.getId().toString(),
                "PROJECT_CREATED",
                "task-events",
                Map.of(
                        "organizationId", orgId,
                        "projectId", project.getId(),
                        "name", project.getName(),
                        "createdBy", currentUserId,
                        "creatorName", creator.getFullName()
                )
        );

        return mapToResponse(project, creator.getFullName());
    }

    @Transactional(readOnly = true)
    public Page<ProjectResponse> getProjects(Long orgId, Boolean isArchived, Pageable pageable, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Page<Project> page;
        if (isArchived != null) {
            page = projectRepository.findByOrganizationIdAndIsArchived(orgId, isArchived, pageable);
        } else {
            page = projectRepository.findByOrganizationId(orgId, pageable);
        }

        return page.map(p -> {
            String creatorName = userRepository.findById(p.getCreatedBy())
                    .map(User::getFullName).orElse("Unknown");
            return mapToResponse(p, creatorName);
        });
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProject(Long orgId, Long projectId, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        Project project = projectRepository.findByIdAndOrganizationId(projectId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId + " in organization: " + orgId));

        String creatorName = userRepository.findById(project.getCreatedBy())
                .map(User::getFullName).orElse("Unknown");

        return mapToResponse(project, creatorName);
    }

    @Transactional
    public ProjectResponse updateProject(Long orgId, Long projectId, UpdateProjectRequest request, Long currentUserId) {
        tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);

        Project project = projectRepository.findByIdAndOrganizationId(projectId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId + " in organization: " + orgId));

        project.setName(request.getName().trim());
        project.setDescription(request.getDescription());
        project = projectRepository.save(project);

        outboxService.recordEvent(
                "PROJECT",
                project.getId().toString(),
                "PROJECT_UPDATED",
                "task-events",
                Map.of(
                        "organizationId", orgId,
                        "projectId", project.getId(),
                        "name", project.getName(),
                        "updatedBy", currentUserId
                )
        );

        String creatorName = userRepository.findById(project.getCreatedBy())
                .map(User::getFullName).orElse("Unknown");

        return mapToResponse(project, creatorName);
    }

    @Transactional
    public ProjectResponse setArchived(Long orgId, Long projectId, boolean archived, Long currentUserId) {
        tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);

        Project project = projectRepository.findByIdAndOrganizationId(projectId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId + " in organization: " + orgId));

        project.setArchived(archived);
        project = projectRepository.save(project);

        outboxService.recordEvent(
                "PROJECT",
                project.getId().toString(),
                archived ? "PROJECT_ARCHIVED" : "PROJECT_UNARCHIVED",
                "task-events",
                Map.of(
                        "organizationId", orgId,
                        "projectId", project.getId(),
                        "archived", archived,
                        "updatedBy", currentUserId
                )
        );

        String creatorName = userRepository.findById(project.getCreatedBy())
                .map(User::getFullName).orElse("Unknown");

        return mapToResponse(project, creatorName);
    }

    @Transactional
    public void deleteProject(Long orgId, Long projectId, Long currentUserId) {
        tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);

        Project project = projectRepository.findByIdAndOrganizationId(projectId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId + " in organization: " + orgId));

        projectRepository.delete(project);

        outboxService.recordEvent(
                "PROJECT",
                projectId.toString(),
                "PROJECT_DELETED",
                "task-events",
                Map.of(
                        "organizationId", orgId,
                        "projectId", projectId,
                        "name", project.getName(),
                        "deletedBy", currentUserId
                )
        );
    }

    private ProjectResponse mapToResponse(Project project, String creatorName) {
        return new ProjectResponse(
                project.getId(),
                project.getOrganizationId(),
                project.getName(),
                project.getDescription(),
                project.isArchived(),
                project.getCreatedBy(),
                creatorName,
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
