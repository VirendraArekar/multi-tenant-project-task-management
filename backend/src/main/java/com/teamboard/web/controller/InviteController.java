package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.MemberService;
import com.teamboard.web.dto.org.InviteRequest;
import com.teamboard.web.dto.org.InviteResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Tag(name = "Organization Invites", description = "Endpoints for creating, inspecting, and accepting workspace invites")
public class InviteController {

    private final MemberService memberService;

    public InviteController(MemberService memberService) {
        this.memberService = memberService;
    }

    @PostMapping("/api/v1/organizations/{organizationId}/invites")
    @Operation(summary = "Invite a new member by email (Admin/Owner only)")
    public ResponseEntity<ApiResponse<InviteResponse>> inviteMember(
            @PathVariable("organizationId") Long organizationId,
            @Valid @RequestBody InviteRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        InviteResponse response = memberService.inviteMember(organizationId, request, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Invite created successfully", response));
    }

    @GetMapping("/api/v1/organizations/{organizationId}/invites")
    @Operation(summary = "List pending invites for the organization (Admin/Owner only)")
    public ResponseEntity<ApiResponse<List<InviteResponse>>> getPendingInvites(
            @PathVariable("organizationId") Long organizationId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        List<InviteResponse> invites = memberService.getPendingInvites(organizationId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(invites));
    }

    @GetMapping("/api/v1/invites/{token}")
    @Operation(summary = "Get details of an invite token (public)")
    public ResponseEntity<ApiResponse<InviteResponse>> getInviteByToken(
            @PathVariable("token") String token
    ) {
        InviteResponse response = memberService.getInviteByToken(token);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/api/v1/invites/{token}/accept")
    @Operation(summary = "Accept an invitation to join an organization (requires authentication)")
    public ResponseEntity<ApiResponse<Void>> acceptInvite(
            @PathVariable("token") String token
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        memberService.acceptInvite(token, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Invite accepted successfully", null));
    }
}
