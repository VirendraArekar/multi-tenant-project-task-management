package com.teamboard.service;

import com.teamboard.common.exception.BadRequestException;
import com.teamboard.common.exception.ForbiddenException;
import com.teamboard.common.exception.ResourceNotFoundException;
import com.teamboard.domain.organization.*;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.web.dto.org.InviteRequest;
import com.teamboard.web.dto.org.InviteResponse;
import com.teamboard.web.dto.org.MemberResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MemberService {

    private final OrganizationMemberRepository memberRepository;
    private final OrganizationInviteRepository inviteRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final TenantSecurityService tenantSecurityService;
    private final OutboxService outboxService;

    public MemberService(
            OrganizationMemberRepository memberRepository,
            OrganizationInviteRepository inviteRepository,
            OrganizationRepository organizationRepository,
            UserRepository userRepository,
            TenantSecurityService tenantSecurityService,
            OutboxService outboxService
    ) {
        this.memberRepository = memberRepository;
        this.inviteRepository = inviteRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.tenantSecurityService = tenantSecurityService;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<MemberResponse> getMembers(Long orgId, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);
        List<OrganizationMember> members = memberRepository.findByOrganizationIdWithUser(orgId);

        return members.stream()
                .map(m -> new MemberResponse(
                        m.getId(),
                        m.getUserId(),
                        m.getUser() != null ? m.getUser().getEmail() : null,
                        m.getUser() != null ? m.getUser().getFullName() : null,
                        m.getRole(),
                        m.getJoinedAt()
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public InviteResponse inviteMember(Long orgId, InviteRequest request, Long currentUserId) {
        tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);

        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found with id: " + orgId));

        User inviter = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + currentUserId));

        String email = request.getEmail().trim().toLowerCase();

        // Check if already a member
        userRepository.findByEmail(email).ifPresent(user -> {
            if (memberRepository.existsByOrganizationIdAndUserId(orgId, user.getId())) {
                throw new BadRequestException("User with email " + email + " is already a member of this organization");
            }
        });

        // Ensure role is valid (only OWNER can invite another OWNER; admins can invite ADMIN or MEMBER)
        Role callerRole = tenantSecurityService.getMemberRole(orgId, currentUserId);
        if (request.getRole() == Role.OWNER && callerRole != Role.OWNER) {
            throw new ForbiddenException("Only an Owner can invite someone with the Owner role");
        }

        // Cancel previous pending invite for this email in this org if any exists
        inviteRepository.findByOrganizationIdAndEmailAndAcceptedAtIsNull(orgId, email)
                .ifPresent(inviteRepository::delete);

        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);

        OrganizationInvite invite = new OrganizationInvite(orgId, email, request.getRole(), token, currentUserId, expiresAt);
        invite = inviteRepository.save(invite);

        String inviteLink = "/invite/accept?token=" + token;

        outboxService.recordEvent(
                "INVITE",
                invite.getId().toString(),
                "MEMBER_INVITED",
                "membership-events",
                Map.of(
                        "organizationId", orgId,
                        "organizationName", org.getName(),
                        "inviteId", invite.getId(),
                        "email", email,
                        "role", request.getRole().name(),
                        "inviterName", inviter.getFullName(),
                        "token", token
                )
        );

        return new InviteResponse(
                invite.getId(),
                orgId,
                org.getName(),
                email,
                invite.getRole(),
                token,
                inviteLink,
                inviter.getFullName(),
                expiresAt,
                null,
                invite.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> getPendingInvites(Long orgId, Long currentUserId) {
        tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found with id: " + orgId));

        return inviteRepository.findByOrganizationIdAndAcceptedAtIsNull(orgId).stream()
                .filter(i -> !i.isExpired())
                .map(i -> {
                    String inviterName = userRepository.findById(i.getInviterId())
                            .map(User::getFullName).orElse("Team Member");
                    return new InviteResponse(
                            i.getId(),
                            orgId,
                            org.getName(),
                            i.getEmail(),
                            i.getRole(),
                            i.getToken(),
                            "/invite/accept?token=" + i.getToken(),
                            inviterName,
                            i.getExpiresAt(),
                            i.getAcceptedAt(),
                            i.getCreatedAt()
                    );
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public InviteResponse getInviteByToken(String token) {
        OrganizationInvite invite = inviteRepository.findByTokenWithOrganization(token)
                .orElseThrow(() -> new ResourceNotFoundException("Invite link is invalid"));

        if (invite.isExpired()) {
            throw new BadRequestException("This invite link has expired");
        }
        if (invite.isAccepted()) {
            throw new BadRequestException("This invite link has already been accepted");
        }

        String inviterName = userRepository.findById(invite.getInviterId())
                .map(User::getFullName).orElse("Team Member");

        return new InviteResponse(
                invite.getId(),
                invite.getOrganizationId(),
                invite.getOrganization().getName(),
                invite.getEmail(),
                invite.getRole(),
                invite.getToken(),
                "/invite/accept?token=" + invite.getToken(),
                inviterName,
                invite.getExpiresAt(),
                invite.getAcceptedAt(),
                invite.getCreatedAt()
        );
    }

    @Transactional
    public void acceptInvite(String token, Long currentUserId) {
        OrganizationInvite invite = inviteRepository.findByTokenWithOrganization(token)
                .orElseThrow(() -> new ResourceNotFoundException("Invite link is invalid"));

        if (invite.isExpired()) {
            throw new BadRequestException("This invite link has expired");
        }
        if (invite.isAccepted()) {
            throw new BadRequestException("This invite link has already been accepted");
        }

        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + currentUserId));

        Long orgId = invite.getOrganizationId();

        // If not already member, add member
        if (!memberRepository.existsByOrganizationIdAndUserId(orgId, currentUserId)) {
            OrganizationMember member = new OrganizationMember(orgId, currentUserId, invite.getRole());
            memberRepository.save(member);
        }

        invite.setAcceptedAt(Instant.now());
        inviteRepository.save(invite);

        tenantSecurityService.invalidateRoleCache(orgId, currentUserId);

        outboxService.recordEvent(
                "MEMBERSHIP",
                currentUserId.toString(),
                "MEMBER_JOINED",
                "membership-events",
                Map.of(
                        "organizationId", orgId,
                        "organizationName", invite.getOrganization().getName(),
                        "userId", currentUserId,
                        "userEmail", user.getEmail(),
                        "userName", user.getFullName(),
                        "role", invite.getRole().name()
                )
        );
    }

    @Transactional
    public void changeRole(Long orgId, Long targetUserId, Role newRole, Long currentUserId) {
        tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);

        Role callerRole = tenantSecurityService.getMemberRole(orgId, currentUserId);
        OrganizationMember targetMember = memberRepository.findByOrganizationIdAndUserId(orgId, targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Target member not found in this organization"));

        // Rule: Only OWNER can modify an OWNER
        if (targetMember.getRole() == Role.OWNER && callerRole != Role.OWNER) {
            throw new ForbiddenException("Admins cannot change an Owner's role");
        }

        // Rule: Only OWNER can promote someone to OWNER
        if (newRole == Role.OWNER && callerRole != Role.OWNER) {
            throw new ForbiddenException("Only an Owner can promote a member to Owner");
        }

        // Rule: Cannot demote the last OWNER
        if (targetMember.getRole() == Role.OWNER && newRole != Role.OWNER) {
            long ownerCount = memberRepository.countByOrganizationIdAndRole(orgId, Role.OWNER);
            if (ownerCount <= 1) {
                throw new BadRequestException("Cannot demote the last owner of the organization");
            }
        }

        targetMember.setRole(newRole);
        memberRepository.save(targetMember);
        tenantSecurityService.invalidateRoleCache(orgId, targetUserId);

        outboxService.recordEvent(
                "MEMBERSHIP",
                targetUserId.toString(),
                "ROLE_CHANGED",
                "membership-events",
                Map.of(
                        "organizationId", orgId,
                        "targetUserId", targetUserId,
                        "newRole", newRole.name(),
                        "updatedBy", currentUserId
                )
        );
    }

    @Transactional
    public void removeMember(Long orgId, Long targetUserId, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        OrganizationMember targetMember = memberRepository.findByOrganizationIdAndUserId(orgId, targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Target member not found in this organization"));

        boolean isSelf = currentUserId.equals(targetUserId);

        if (!isSelf) {
            tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);
            Role callerRole = tenantSecurityService.getMemberRole(orgId, currentUserId);

            // Rule: Admin cannot remove an Owner
            if (targetMember.getRole() == Role.OWNER && callerRole != Role.OWNER) {
                throw new ForbiddenException("Admins cannot remove an Owner");
            }
        }

        // Rule: Cannot remove the last OWNER
        if (targetMember.getRole() == Role.OWNER) {
            long ownerCount = memberRepository.countByOrganizationIdAndRole(orgId, Role.OWNER);
            if (ownerCount <= 1) {
                throw new BadRequestException("Cannot remove the last owner of the organization");
            }
        }

        memberRepository.deleteByOrganizationIdAndUserId(orgId, targetUserId);
        tenantSecurityService.invalidateRoleCache(orgId, targetUserId);

        outboxService.recordEvent(
                "MEMBERSHIP",
                targetUserId.toString(),
                "MEMBER_REMOVED",
                "membership-events",
                Map.of(
                        "organizationId", orgId,
                        "targetUserId", targetUserId,
                        "removedBy", currentUserId
                )
        );
    }
}
