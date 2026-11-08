package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.common.dto.PageResponse;
import com.teamboard.domain.activity.ActivityLog;
import com.teamboard.domain.activity.ActivityLogRepository;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.TenantSecurityService;
import com.teamboard.web.dto.dashboard.ActivityResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/activity-logs")
@Tag(name = "Activity Logs", description = "Endpoints for organization audit trail and activity history")
public class ActivityLogController {

    private final ActivityLogRepository activityLogRepository;
    private final TenantSecurityService tenantSecurityService;

    public ActivityLogController(
            ActivityLogRepository activityLogRepository,
            TenantSecurityService tenantSecurityService
    ) {
        this.activityLogRepository = activityLogRepository;
        this.tenantSecurityService = tenantSecurityService;
    }

    @GetMapping
    @Operation(summary = "Get paginated activity logs/audit trail for the organization")
    public ResponseEntity<ApiResponse<PageResponse<ActivityResponse>>> getActivityLogs(
            @PathVariable("organizationId") Long organizationId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        tenantSecurityService.verifyMembership(organizationId, currentUserId);

        Page<ActivityLog> page = activityLogRepository.findByOrganizationId(organizationId, pageable);
        PageResponse<ActivityResponse> response = PageResponse.from(
                page.map(log -> new ActivityResponse(
                        log.getId(),
                        log.getUserId(),
                        log.getUserName(),
                        log.getUserEmail(),
                        log.getAction(),
                        log.getEntityType(),
                        log.getEntityId(),
                        log.getEntityName(),
                        log.getDetails(),
                        log.getCreatedAt()
                ))
        );

        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
