package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.common.dto.PageResponse;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.CommentService;
import com.teamboard.web.dto.task.AddCommentRequest;
import com.teamboard.web.dto.task.CommentResponse;
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
@RequestMapping("/api/v1/organizations/{organizationId}/tasks/{taskId}/comments")
@Tag(name = "Comments", description = "Endpoints for task discussion comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @PostMapping
    @Operation(summary = "Add a comment to a task")
    public ResponseEntity<ApiResponse<CommentResponse>> addComment(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("taskId") Long taskId,
            @Valid @RequestBody AddCommentRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        CommentResponse response = commentService.addComment(organizationId, taskId, request, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Comment added successfully", response));
    }

    @GetMapping
    @Operation(summary = "Get comments for a task (paginated)")
    public ResponseEntity<ApiResponse<PageResponse<CommentResponse>>> getComments(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("taskId") Long taskId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        PageResponse<CommentResponse> page = PageResponse.from(
                commentService.getComments(organizationId, taskId, pageable, currentUserId)
        );
        return ResponseEntity.ok(ApiResponse.success(page));
    }
}
