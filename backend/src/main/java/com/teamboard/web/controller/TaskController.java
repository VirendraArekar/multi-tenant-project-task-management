package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.common.dto.PageResponse;
import com.teamboard.domain.task.TaskStatus;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.TaskService;
import com.teamboard.web.dto.task.*;
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
@RequestMapping("/api/v1/organizations/{organizationId}")
@Tag(name = "Tasks", description = "Endpoints for task creation, kanban board, drag-and-drop, and task updates")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping("/projects/{projectId}/tasks")
    @Operation(summary = "Create a new task in a project")
    public ResponseEntity<ApiResponse<TaskResponse>> createTask(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("projectId") Long projectId,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        TaskResponse response = taskService.createTask(organizationId, projectId, request, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Task created successfully", response));
    }

    @GetMapping("/projects/{projectId}/tasks")
    @Operation(summary = "Get paginated tasks for a project with optional status filter")
    public ResponseEntity<ApiResponse<PageResponse<TaskResponse>>> getTasks(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("projectId") Long projectId,
            @RequestParam(value = "status", required = false) TaskStatus status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        PageResponse<TaskResponse> page = PageResponse.from(
                taskService.getTasks(organizationId, projectId, status, pageable, currentUserId)
        );
        return ResponseEntity.ok(ApiResponse.success(page));
    }

    @GetMapping("/projects/{projectId}/kanban")
    @Operation(summary = "Get full kanban board cards grouped by column ordered by position")
    public ResponseEntity<ApiResponse<KanbanBoardResponse>> getKanbanBoard(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("projectId") Long projectId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        KanbanBoardResponse response = taskService.getKanbanBoard(organizationId, projectId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/tasks/{taskId}")
    @Operation(summary = "Get full details of a task by ID")
    public ResponseEntity<ApiResponse<TaskResponse>> getTask(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("taskId") Long taskId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        TaskResponse response = taskService.getTask(organizationId, taskId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/tasks/{taskId}")
    @Operation(summary = "Update task details with optimistic locking")
    public ResponseEntity<ApiResponse<TaskResponse>> updateTask(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("taskId") Long taskId,
            @Valid @RequestBody UpdateTaskRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        TaskResponse response = taskService.updateTask(organizationId, taskId, request, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Task updated successfully", response));
    }

    @PatchMapping("/tasks/{taskId}/move")
    @Operation(summary = "Move task to another column or position on kanban board with optimistic locking")
    public ResponseEntity<ApiResponse<TaskResponse>> moveTask(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("taskId") Long taskId,
            @Valid @RequestBody MoveTaskRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        TaskResponse response = taskService.moveTask(organizationId, taskId, request, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Task moved successfully", response));
    }

    @DeleteMapping("/tasks/{taskId}")
    @Operation(summary = "Delete a task")
    public ResponseEntity<ApiResponse<Void>> deleteTask(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("taskId") Long taskId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        taskService.deleteTask(organizationId, taskId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Task deleted successfully", null));
    }
}
