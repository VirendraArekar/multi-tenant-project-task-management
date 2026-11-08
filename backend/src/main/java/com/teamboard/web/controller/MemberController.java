package com.teamboard.web.controller;

import com.teamboard.common.dto.ApiResponse;
import com.teamboard.security.SecurityUtils;
import com.teamboard.service.MemberService;
import com.teamboard.web.dto.org.ChangeRoleRequest;
import com.teamboard.web.dto.org.MemberResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/members")
@Tag(name = "Organization Members", description = "Endpoints for managing workspace members and roles")
public class MemberController {

    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping
    @Operation(summary = "Get list of members in the organization")
    public ResponseEntity<ApiResponse<List<MemberResponse>>> getMembers(
            @PathVariable("organizationId") Long organizationId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        List<MemberResponse> members = memberService.getMembers(organizationId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(members));
    }

    @PutMapping("/{userId}/role")
    @Operation(summary = "Change a member's role (Admin/Owner only)")
    public ResponseEntity<ApiResponse<Void>> changeMemberRole(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("userId") Long userId,
            @Valid @RequestBody ChangeRoleRequest request
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        memberService.changeRole(organizationId, userId, request.getRole(), currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Member role updated successfully", null));
    }

    @DeleteMapping("/{userId}")
    @Operation(summary = "Remove a member from the organization or leave workspace")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable("organizationId") Long organizationId,
            @PathVariable("userId") Long userId
    ) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        memberService.removeMember(organizationId, userId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success("Member removed successfully", null));
    }
}
