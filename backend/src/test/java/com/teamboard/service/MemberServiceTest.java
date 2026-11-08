package com.teamboard.service;

import com.teamboard.common.exception.BadRequestException;
import com.teamboard.common.exception.ForbiddenException;
import com.teamboard.domain.organization.*;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.web.dto.org.InviteRequest;
import com.teamboard.web.dto.org.InviteResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MemberServiceTest {

    @Mock
    private OrganizationMemberRepository memberRepository;

    @Mock
    private OrganizationInviteRepository inviteRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantSecurityService tenantSecurityService;

    @Mock
    private OutboxService outboxService;

    @InjectMocks
    private MemberService memberService;

    private Long orgId = 1L;
    private Long ownerId = 10L;
    private Long adminId = 20L;
    private Long memberId = 30L;

    @BeforeEach
    void setUp() {
    }

    @Test
    void cannotDemoteLastOwner() {
        OrganizationMember ownerMember = new OrganizationMember(orgId, ownerId, Role.OWNER);

        when(tenantSecurityService.getMemberRole(orgId, ownerId)).thenReturn(Role.OWNER);
        when(memberRepository.findByOrganizationIdAndUserId(orgId, ownerId)).thenReturn(Optional.of(ownerMember));
        when(memberRepository.countByOrganizationIdAndRole(orgId, Role.OWNER)).thenReturn(1L);

        assertThrows(BadRequestException.class, () ->
                memberService.changeRole(orgId, ownerId, Role.ADMIN, ownerId)
        );
    }

    @Test
    void adminCannotChangeOwnerRole() {
        OrganizationMember ownerMember = new OrganizationMember(orgId, ownerId, Role.OWNER);

        when(tenantSecurityService.getMemberRole(orgId, adminId)).thenReturn(Role.ADMIN);
        when(memberRepository.findByOrganizationIdAndUserId(orgId, ownerId)).thenReturn(Optional.of(ownerMember));

        assertThrows(ForbiddenException.class, () ->
                memberService.changeRole(orgId, ownerId, Role.MEMBER, adminId)
        );
    }

    @Test
    void adminCannotRemoveOwner() {
        OrganizationMember ownerMember = new OrganizationMember(orgId, ownerId, Role.OWNER);

        when(memberRepository.findByOrganizationIdAndUserId(orgId, ownerId)).thenReturn(Optional.of(ownerMember));
        when(tenantSecurityService.getMemberRole(orgId, adminId)).thenReturn(Role.ADMIN);

        assertThrows(ForbiddenException.class, () ->
                memberService.removeMember(orgId, ownerId, adminId)
        );
    }

    @Test
    void cannotRemoveLastOwner() {
        OrganizationMember ownerMember = new OrganizationMember(orgId, ownerId, Role.OWNER);

        when(memberRepository.findByOrganizationIdAndUserId(orgId, ownerId)).thenReturn(Optional.of(ownerMember));
        when(memberRepository.countByOrganizationIdAndRole(orgId, Role.OWNER)).thenReturn(1L);

        assertThrows(BadRequestException.class, () ->
                memberService.removeMember(orgId, ownerId, ownerId)
        );
    }

    @Test
    void inviteMemberSuccessfullyGeneratesToken() {
        Organization org = new Organization("Test Org", "test-org");
        org.setId(orgId);
        User inviter = new User("owner@test.com", "hash", "Owner Name");
        inviter.setId(ownerId);

        when(organizationRepository.findById(orgId)).thenReturn(Optional.of(org));
        when(userRepository.findById(ownerId)).thenReturn(Optional.of(inviter));
        when(userRepository.findByEmail("newmember@test.com")).thenReturn(Optional.empty());
        when(tenantSecurityService.getMemberRole(orgId, ownerId)).thenReturn(Role.OWNER);
        when(inviteRepository.findByOrganizationIdAndEmailAndAcceptedAtIsNull(orgId, "newmember@test.com"))
                .thenReturn(Optional.empty());

        when(inviteRepository.save(any(OrganizationInvite.class))).thenAnswer(invocation -> {
            OrganizationInvite invite = invocation.getArgument(0);
            invite.setId(99L);
            return invite;
        });

        InviteRequest request = new InviteRequest("newmember@test.com", Role.MEMBER);
        InviteResponse response = memberService.inviteMember(orgId, request, ownerId);

        assertNotNull(response);
        assertEquals("newmember@test.com", response.getEmail());
        assertEquals(Role.MEMBER, response.getRole());
        assertNotNull(response.getToken());
        assertTrue(response.getInviteLink().contains(response.getToken()));
        verify(outboxService, times(1)).recordEvent(eq("INVITE"), eq("99"), eq("MEMBER_INVITED"), any(), any());
    }
}
