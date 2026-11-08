package com.teamboard.service;

import com.teamboard.common.exception.ResourceNotFoundException;
import com.teamboard.domain.organization.*;
import com.teamboard.web.dto.org.CreateOrganizationRequest;
import com.teamboard.web.dto.org.OrganizationResponse;
import com.teamboard.web.dto.org.UpdateOrganizationRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final TenantSecurityService tenantSecurityService;
    private final OutboxService outboxService;

    public OrganizationService(
            OrganizationRepository organizationRepository,
            OrganizationMemberRepository memberRepository,
            TenantSecurityService tenantSecurityService,
            OutboxService outboxService
    ) {
        this.organizationRepository = organizationRepository;
        this.memberRepository = memberRepository;
        this.tenantSecurityService = tenantSecurityService;
        this.outboxService = outboxService;
    }

    @Transactional
    public OrganizationResponse create(CreateOrganizationRequest request, Long currentUserId) {
        String name = request.getName().trim();
        String slug = generateSlug(name);

        Organization org = new Organization(name, slug);
        org = organizationRepository.save(org);

        OrganizationMember member = new OrganizationMember(org.getId(), currentUserId, Role.OWNER);
        memberRepository.save(member);

        outboxService.recordEvent(
                "ORGANIZATION",
                org.getId().toString(),
                "ORGANIZATION_CREATED",
                "membership-events",
                Map.of(
                        "organizationId", org.getId(),
                        "organizationName", org.getName(),
                        "userId", currentUserId,
                        "role", "OWNER"
                )
        );

        return new OrganizationResponse(org.getId(), org.getName(), org.getSlug(), Role.OWNER, org.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public List<OrganizationResponse> getUserOrganizations(Long currentUserId) {
        List<OrganizationMember> memberships = memberRepository.findByUserId(currentUserId);
        return memberships.stream()
                .map(m -> {
                    Organization org = organizationRepository.findById(m.getOrganizationId())
                            .orElse(null);
                    if (org == null) return null;
                    return new OrganizationResponse(org.getId(), org.getName(), org.getSlug(), m.getRole(), org.getCreatedAt());
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public OrganizationResponse getOrganization(Long orgId, Long currentUserId) {
        OrganizationMember member = tenantSecurityService.verifyMembership(orgId, currentUserId);
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found with id: " + orgId));

        return new OrganizationResponse(org.getId(), org.getName(), org.getSlug(), member.getRole(), org.getCreatedAt());
    }

    @Transactional
    public OrganizationResponse update(Long orgId, UpdateOrganizationRequest request, Long currentUserId) {
        tenantSecurityService.verifyRole(orgId, currentUserId, Role.ADMIN);

        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found with id: " + orgId));

        org.setName(request.getName().trim());
        org = organizationRepository.save(org);

        Role userRole = tenantSecurityService.getMemberRole(orgId, currentUserId);

        outboxService.recordEvent(
                "ORGANIZATION",
                org.getId().toString(),
                "ORGANIZATION_RENAMED",
                "membership-events",
                Map.of(
                        "organizationId", org.getId(),
                        "organizationName", org.getName(),
                        "updatedBy", currentUserId
                )
        );

        return new OrganizationResponse(org.getId(), org.getName(), org.getSlug(), userRole, org.getCreatedAt());
    }

    private String generateSlug(String name) {
        String baseSlug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (baseSlug.isBlank()) {
            baseSlug = "workspace";
        }
        String candidateSlug = baseSlug;
        int attempt = 1;
        while (organizationRepository.existsBySlug(candidateSlug)) {
            candidateSlug = baseSlug + "-" + UUID.randomUUID().toString().substring(0, 6);
            attempt++;
            if (attempt > 10) {
                candidateSlug = baseSlug + "-" + System.currentTimeMillis();
                break;
            }
        }
        return candidateSlug;
    }
}
