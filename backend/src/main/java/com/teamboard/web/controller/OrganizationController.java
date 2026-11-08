package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.OrganizationService;
import com.teamboard.web.dto.org.CreateOrganizationRequest;
import com.teamboard.web.dto.org.OrganizationResponse;
import com.teamboard.web.dto.org.UpdateOrganizationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/organizations")
@Tag(name = "Organizations", description = "Endpoints for managing tenants and workspaces")
public class OrganizationController {

    private final OrganizationService organizationService;

    public OrganizationController(OrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    @PostMapping
    @Operation(summary = "Create a new organization/workspace")
    public ResponseEntity<ApiResponse<OrganizationResponse>> createOrganization(
            @Valid @RequestBody CreateOrganizationRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        OrganizationResponse response = organizationService.create(request, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Organization created successfully", response));
    }

    @GetMapping
    @Operation(summary = "List all organizations the authenticated user belongs to")
    public ResponseEntity<ApiResponse<List<OrganizationResponse>>> getUserOrganizations() {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        List<OrganizationResponse> organizations = organizationService.getUserOrganizations(currentUserId);
        return ResponseEntity.ok(ApiResponse.success(organizations));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get organization details by ID")
    public ResponseEntity<ApiResponse<OrganizationResponse>> getOrganization(
            @PathVariable("id") Long id
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        OrganizationResponse response = organizationService.getOrganization(id, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Rename/update organization (Admin/Owner only)")
    public ResponseEntity<ApiResponse<OrganizationResponse>> updateOrganization(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateOrganizationRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        OrganizationResponse response = organizationService.update(id, request, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Organization updated successfully", response));
    }
}
