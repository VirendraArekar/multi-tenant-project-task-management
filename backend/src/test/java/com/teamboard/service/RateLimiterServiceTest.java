package com.teamboard.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class RateLimiterServiceTest {

    private RateLimiterService rateLimiterService;

    @BeforeEach
    void setUp() {
        rateLimiterService = new RateLimiterService(null); // tests in-memory token bucket implementation
        ReflectionTestUtils.setField(rateLimiterService, "defaultCapacity", 5L);
        ReflectionTestUtils.setField(rateLimiterService, "defaultRefillTokensPerMinute", 60.0);
        ReflectionTestUtils.setField(rateLimiterService, "authCapacity", 2L);
        ReflectionTestUtils.setField(rateLimiterService, "authRefillTokensPerMinute", 6.0);
    }

    @Test
    void allowsRequestsWithinCapacity() {
        String key = "test:user:1";
        for (int i = 0; i < 5; i++) {
            RateLimiterService.RateLimitResult result = rateLimiterService.checkRateLimit(key, false);
            assertTrue(result.isAllowed(), "Request " + i + " should be allowed");
        }
    }

    @Test
    void blocksRequestsExceedingCapacityAndReturnsRetryAfter() {
        String key = "test:user:exceed";
        // Consume all 5 tokens
        for (int i = 0; i < 5; i++) {
            rateLimiterService.checkRateLimit(key, false);
        }

        // 6th request must be rejected
        RateLimiterService.RateLimitResult rejected = rateLimiterService.checkRateLimit(key, false);
        assertFalse(rejected.isAllowed());
        assertTrue(rejected.getRetryAfterSeconds() > 0);
        assertEquals(0, rejected.getRemaining());
    }

    @Test
    void enforcesStricterLimitsOnAuthEndpoints() {
        String key = "test:auth:ip:127.0.0.1";
        // Consume 2 auth tokens
        assertTrue(rateLimiterService.checkRateLimit(key, true).isAllowed());
        assertTrue(rateLimiterService.checkRateLimit(key, true).isAllowed());

        // 3rd attempt must be rejected
        RateLimiterService.RateLimitResult rejected = rateLimiterService.checkRateLimit(key, true);
        assertFalse(rejected.isAllowed());
        assertEquals(2L, rejected.getLimit());
    }
}
