package com.teamboard.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CacheInvalidationService {

    private static final Logger log = LoggerFactory.getLogger(CacheInvalidationService.class);
    private static final String DASHBOARD_CACHE_PREFIX = "cache:dashboard:";

    private final StringRedisTemplate redisTemplate;
    private final ConcurrentHashMap<String, String> localDashboardCache = new ConcurrentHashMap<>();

    public CacheInvalidationService(@Autowired(required = false) StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void invalidateDashboard(Long orgId) {
        if (orgId == null) return;
        String pattern = DASHBOARD_CACHE_PREFIX + orgId + "*";
        try {
            if (redisTemplate != null) {
                Set<String> keys = redisTemplate.keys(pattern);
                if (keys != null && !keys.isEmpty()) {
                    redisTemplate.delete(keys);
                    log.debug("Invalidated Redis dashboard cache keys for org {}: {}", orgId, keys.size());
                }
            }
        } catch (Exception e) {
            log.debug("Redis dashboard invalidation failed: {}", e.getMessage());
        }

        localDashboardCache.keySet().removeIf(k -> k.startsWith(DASHBOARD_CACHE_PREFIX + orgId));
    }
}
