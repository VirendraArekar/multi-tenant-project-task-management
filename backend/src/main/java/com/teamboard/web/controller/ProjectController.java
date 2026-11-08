package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.common.dto.PageResponse;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.ProjectService;
import com.teamboard.web.dto.project.CreateProjectRequest;
import com.teamboard.web.dto.project.ProjectResponse;
import com.teamboard.web.dto.project.UpdateProjectRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/projects")
@Tag(name = "Projects", description = "Endpoints for project management within an organization")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping
    @Operation(summary = "Create a new project in the organization")
    public ResponseEntity<ApiResponse<ProjectResponse>> createProject(
            @PathVariable("organizationId") Long organizationId,
            @Valid @RequestBody CreateProjectRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        ProjectResponse response = projectService.createProject(organizationId, request, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Project created successfully", response));
    }

    @GetMapping
    @Operation(summary = "List projects in the organization (paginated)")
    public ResponseEntity<ApiResponse<PageResponse<ProjectResponse>>> getProjects(
            @PathVariable("organizationId") Long organizationId,
            @RequestParam(value = "isArchived", required = false) Boolean isArchived,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        PageResponse<ProjectResponse> page = PageResponse.from(
                projectService.getProjects(organizationId, isArchived, pageable, currentUserId)
        );
        return ResponseEntity.ok(ApiResponse.success(page));
    }

    @GetMapping("/{projectId}")
    @Operation(summary = "Get project details by ID")
    public ResponseEntity<ApiResponse<ProjectResponse>> getProject(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("projectId") Long projectId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        ProjectResponse response = projectService.getProject(organizationId, projectId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{projectId}")
    @Operation(summary = "Update project name and description (Admin/Owner only)")
    public ResponseEntity<ApiResponse<ProjectResponse>> updateProject(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("projectId") Long projectId,
            @Valid @RequestBody UpdateProjectRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        ProjectResponse response = projectService.updateProject(organizationId, projectId, request, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Project updated successfully", response));
    }

    @PatchMapping("/{projectId}/archive")
    @Operation(summary = "Archive or unarchive a project (Admin/Owner only)")
    public ResponseEntity<ApiResponse<ProjectResponse>> setProjectArchived(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("projectId") Long projectId,
            @RequestParam("archived") boolean archived
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        ProjectResponse response = projectService.setArchived(organizationId, projectId, archived, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(
                archived ? "Project archived successfully" : "Project unarchived successfully",
                response
        ));
    }

    @DeleteMapping("/{projectId}")
    @Operation(summary = "Delete a project and its tasks (Admin/Owner only)")
    public ResponseEntity<ApiResponse<Void>> deleteProject(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("projectId") Long projectId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        projectService.deleteProject(organizationId, projectId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Project deleted successfully", null));
    }
}
