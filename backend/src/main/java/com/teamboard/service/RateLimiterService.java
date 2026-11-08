package com.teamboard.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);

    private final StringRedisTemplate redisTemplate;
    private final DefaultRedisScript<List> tokenBucketScript;

    @Value("${app.rate-limit.default-capacity:60}")
    private long defaultCapacity;

    @Value("${app.rate-limit.default-refill-tokens-per-minute:60}")
    private double defaultRefillTokensPerMinute;

    @Value("${app.rate-limit.auth-capacity:10}")
    private long authCapacity;

    @Value("${app.rate-limit.auth-refill-tokens-per-minute:10}")
    private double authRefillTokensPerMinute;

    // In-memory fallback
    private final ConcurrentHashMap<String, InMemoryBucket> localBuckets = new ConcurrentHashMap<>();

    private static final String LUA_TOKEN_BUCKET =
            "local key = KEYS[1]\n" +
            "local capacity = tonumber(ARGV[1])\n" +
            "local refillRate = tonumber(ARGV[2])\n" +
            "local now = tonumber(ARGV[3])\n" +
            "local requested = tonumber(ARGV[4])\n" +
            "\n" +
            "local data = redis.call('HMGET', key, 'tokens', 'lastRefill')\n" +
            "local tokens = tonumber(data[1])\n" +
            "local lastRefill = tonumber(data[2])\n" +
            "\n" +
            "if tokens == nil then\n" +
            "    tokens = capacity\n" +
            "    lastRefill = now\n" +
            "else\n" +
            "    local delta = math.max(0, now - lastRefill)\n" +
            "    tokens = math.min(capacity, tokens + delta * refillRate)\n" +
            "    lastRefill = now\n" +
            "end\n" +
            "\n" +
            "if tokens >= requested then\n" +
            "    tokens = tokens - requested\n" +
            "    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)\n" +
            "    redis.call('EXPIRE', key, 3600)\n" +
            "    return {1, math.floor(tokens), 0}\n" +
            "else\n" +
            "    local missing = requested - tokens\n" +
            "    local retryAfter = math.ceil(missing / refillRate)\n" +
            "    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)\n" +
            "    redis.call('EXPIRE', key, 3600)\n" +
            "    return {0, math.floor(tokens), retryAfter}\n" +
            "end";

    public RateLimiterService(@Autowired(required = false) StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.tokenBucketScript = new DefaultRedisScript<>();
        this.tokenBucketScript.setScriptText(LUA_TOKEN_BUCKET);
        this.tokenBucketScript.setResultType(List.class);
    }

    public RateLimitResult checkRateLimit(String key, boolean isAuthEndpoint) {
        long capacity = isAuthEndpoint ? authCapacity : defaultCapacity;
        double refillPerSec = (isAuthEndpoint ? authRefillTokensPerMinute : defaultRefillTokensPerMinute) / 60.0;
        long nowSeconds = System.currentTimeMillis() / 1000;

        try {
            if (redisTemplate != null) {
                List result = redisTemplate.execute(
                        tokenBucketScript,
                        Collections.singletonList(key),
                        String.valueOf(capacity),
                        String.valueOf(refillPerSec),
                        String.valueOf(nowSeconds),
                        "1"
                );

                if (result != null && result.size() >= 3) {
                    boolean allowed = ((Number) result.get(0)).intValue() == 1;
                    long remaining = ((Number) result.get(1)).longValue();
                    long retryAfter = ((Number) result.get(2)).longValue();
                    return new RateLimitResult(allowed, capacity, remaining, retryAfter);
                }
            }
        } catch (Exception e) {
            log.warn("Redis rate limit evaluation failed, falling back to local bucket for key {}: {}", key, e.getMessage());
        }

        // Local in-memory token bucket fallback
        return checkLocalRateLimit(key, capacity, refillPerSec, nowSeconds);
    }

    private synchronized RateLimitResult checkLocalRateLimit(String key, long capacity, double refillPerSec, long nowSeconds) {
        InMemoryBucket bucket = localBuckets.computeIfAbsent(key, k -> new InMemoryBucket(capacity, nowSeconds));
        return bucket.consume(capacity, refillPerSec, nowSeconds);
    }

    public static class RateLimitResult {
        private final boolean allowed;
        private final long limit;
        private final long remaining;
        private final long retryAfterSeconds;

        public RateLimitResult(boolean allowed, long limit, long remaining, long retryAfterSeconds) {
            this.allowed = allowed;
            this.limit = limit;
            this.remaining = remaining;
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public boolean isAllowed() {
            return allowed;
        }

        public long getLimit() {
            return limit;
        }

        public long getRemaining() {
            return remaining;
        }

        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }
    }

    private static class InMemoryBucket {
        private double tokens;
        private long lastRefill;

        public InMemoryBucket(long capacity, long nowSeconds) {
            this.tokens = capacity;
            this.lastRefill = nowSeconds;
        }

        public synchronized RateLimitResult consume(long capacity, double refillRate, long nowSeconds) {
            long delta = Math.max(0, nowSeconds - lastRefill);
            tokens = Math.min(capacity, tokens + delta * refillRate);
            lastRefill = nowSeconds;

            if (tokens >= 1.0) {
                tokens -= 1.0;
                return new RateLimitResult(true, capacity, (long) tokens, 0);
            } else {
                double missing = 1.0 - tokens;
                long retryAfter = (long) Math.ceil(missing / refillRate);
                return new RateLimitResult(false, capacity, (long) tokens, retryAfter);
            }
        }
    }
}
