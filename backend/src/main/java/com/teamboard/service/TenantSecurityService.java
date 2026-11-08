package com.teamboard.service;

import com.teamboard.common.exception.ForbiddenException;
import com.teamboard.domain.organization.OrganizationMember;
import com.teamboard.domain.organization.OrganizationMemberRepository;
import com.teamboard.domain.organization.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TenantSecurityService {

    private static final Logger log = LoggerFactory.getLogger(TenantSecurityService.class);
    private static final String CACHE_PREFIX = "org:member:role:";

    private final OrganizationMemberRepository memberRepository;
    private final StringRedisTemplate redisTemplate;
    private final ConcurrentHashMap<String, String> localRoleCache = new ConcurrentHashMap<>();

    public TenantSecurityService(
            OrganizationMemberRepository memberRepository,
            @Autowired(required = false) StringRedisTemplate redisTemplate
    ) {
        this.memberRepository = memberRepository;
        this.redisTemplate = redisTemplate;
    }

    public OrganizationMember verifyMembership(Long orgId, Long userId) {
        if (orgId == null || userId == null) {
            throw new ForbiddenException("Organization and user identifier are required for tenant access");
        }

        return memberRepository.findByOrganizationIdAndUserId(orgId, userId)
                .orElseThrow(() -> new ForbiddenException("Access denied: You are not a member of organization " + orgId));
    }

    public Role getMemberRole(Long orgId, Long userId) {
        String cacheKey = CACHE_PREFIX + orgId + ":" + userId;
        try {
            if (redisTemplate != null) {
                String cached = redisTemplate.opsForValue().get(cacheKey);
                if (cached != null) {
                    return Role.valueOf(cached);
                }
            }
        } catch (Exception e) {
            log.debug("Redis role cache get failed: {}", e.getMessage());
        }

        String localCached = localRoleCache.get(cacheKey);
        if (localCached != null) {
            return Role.valueOf(localCached);
        }

        OrganizationMember member = verifyMembership(orgId, userId);
        cacheRole(cacheKey, member.getRole().name());
        return member.getRole();
    }

    public void verifyRole(Long orgId, Long userId, Role requiredRole) {
        Role actualRole = getMemberRole(orgId, userId);
        if (!actualRole.isAtLeast(requiredRole)) {
            throw new ForbiddenException("Insufficient permissions: requires " + requiredRole + " role, but you are " + actualRole);
        }
    }

    public void invalidateRoleCache(Long orgId, Long userId) {
        String cacheKey = CACHE_PREFIX + orgId + ":" + userId;
        try {
            if (redisTemplate != null) {
                redisTemplate.delete(cacheKey);
            }
        } catch (Exception e) {
            log.debug("Redis role cache evict failed: {}", e.getMessage());
        }
        localRoleCache.remove(cacheKey);
    }

    private void cacheRole(String key, String roleName) {
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(key, roleName, Duration.ofMinutes(15));
                return;
            }
        } catch (Exception e) {
            log.debug("Redis role cache set failed: {}", e.getMessage());
        }
        localRoleCache.put(key, roleName);
    }
}
