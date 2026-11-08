package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.common.dto.PageResponse;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.NotificationService;
import com.teamboard.web.dto.notification.NotificationResponse;
import com.teamboard.web.dto.notification.UnreadCountResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/notifications")
@Tag(name = "Notifications", description = "Endpoints for in-app user notifications and unread badges")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @Operation(summary = "Get user notifications for this organization (paginated)")
    public ResponseEntity<ApiResponse<PageResponse<NotificationResponse>>> getNotifications(
            @PathVariable("organizationId") Long organizationId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        PageResponse<NotificationResponse> page = PageResponse.from(
                notificationService.getNotifications(organizationId, currentUserId, pageable)
        );
        return ResponseEntity.ok(ApiResponse.success(page));
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Get count of unread notifications for the badge counter")
    public ResponseEntity<ApiResponse<UnreadCountResponse>> getUnreadCount(
            @PathVariable("organizationId") Long organizationId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        UnreadCountResponse response = notificationService.getUnreadCount(organizationId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("id") Long id
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        notificationService.markAsRead(organizationId, id, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read", null));
    }

    @PatchMapping("/read-all")
    @Operation(summary = "Mark all notifications as read for current user")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(
            @PathVariable("organizationId") Long organizationId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        notificationService.markAllAsRead(organizationId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read", null));
    }
}
