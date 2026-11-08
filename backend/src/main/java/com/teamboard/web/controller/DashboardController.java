package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.DashboardService;
import com.teamboard.web.dto.dashboard.DashboardResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/dashboard")
@Tag(name = "Dashboard", description = "Endpoints for workspace dashboard metrics, aggregates, and activity summaries")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    @Operation(summary = "Get workspace dashboard aggregates with status breakdown, overdue tasks, and activity feed")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard(
            @PathVariable("organizationId") Long organizationId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        DashboardResponse response = dashboardService.getDashboard(organizationId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
