package com.teamboard.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TokenStoreService {

    private static final Logger log = LoggerFactory.getLogger(TokenStoreService.class);

    private static final String REFRESH_KEY_PREFIX = "token:refresh:";
    private static final String REVOKED_KEY_PREFIX = "token:revoked:";

    private final StringRedisTemplate redisTemplate;
    // In-memory fallback if Redis is unavailable in specific test profiles
    private final ConcurrentHashMap<String, String> localRefreshStore = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> localRevokedStore = new ConcurrentHashMap<>();

    public TokenStoreService(@Autowired(required = false) StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void storeRefreshToken(String refreshToken, Long userId, String email, long ttlSeconds) {
        String key = REFRESH_KEY_PREFIX + refreshToken;
        String val = userId + ":" + email;
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(key, val, Duration.ofSeconds(ttlSeconds));
                return;
            }
        } catch (Exception e) {
            log.warn("Redis storeRefreshToken failed, falling back to local memory store: {}", e.getMessage());
        }
        localRefreshStore.put(key, val);
    }

    public String validateAndConsumeRefreshToken(String refreshToken) {
        String key = REFRESH_KEY_PREFIX + refreshToken;
        try {
            if (redisTemplate != null) {
                String val = redisTemplate.opsForValue().get(key);
                if (val != null) {
                    redisTemplate.delete(key);
                    return val;
                }
                return null;
            }
        } catch (Exception e) {
            log.warn("Redis validateRefreshToken failed, falling back to local memory store: {}", e.getMessage());
        }
        return localRefreshStore.remove(key);
    }

    public void revokeToken(String token, long ttlSeconds) {
        String key = REVOKED_KEY_PREFIX + token;
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(key, "1", Duration.ofSeconds(ttlSeconds));
                return;
            }
        } catch (Exception e) {
            log.warn("Redis revokeToken failed: {}", e.getMessage());
        }
        localRevokedStore.put(key, System.currentTimeMillis() + (ttlSeconds * 1000));
    }

    public boolean isTokenRevoked(String token) {
        String key = REVOKED_KEY_PREFIX + token;
        try {
            if (redisTemplate != null) {
                Boolean hasKey = redisTemplate.hasKey(key);
                return Boolean.TRUE.equals(hasKey);
            }
        } catch (Exception e) {
            log.warn("Redis isTokenRevoked check failed: {}", e.getMessage());
        }
        Long expiry = localRevokedStore.get(key);
        if (expiry != null) {
            if (System.currentTimeMillis() > expiry) {
                localRevokedStore.remove(key);
                return false;
            }
            return true;
        }
        return false;
    }
}
