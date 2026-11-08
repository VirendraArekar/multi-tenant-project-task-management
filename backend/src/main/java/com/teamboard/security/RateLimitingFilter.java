package com.teamboard.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamboard.common.dto.ErrorResponse;
import com.teamboard.common.filter.TraceIdFilter;
import com.teamboard.service.RateLimiterService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(-100) // Runs right after TraceIdFilter but before Business Filters
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RateLimitingFilter(RateLimiterService rateLimiterService) {
        this.rateLimiterService = rateLimiterService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();

        // Skip static resources, actuator, and swagger
        if (!uri.startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        boolean isAuthEndpoint = uri.equals("/api/v1/auth/login") || uri.equals("/api/v1/auth/register");

        String rateLimitKey;
        if (isAuthEndpoint) {
            rateLimitKey = "ratelimit:auth:" + clientIp;
        } else {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
                rateLimitKey = "ratelimit:user:" + principal.getId();
            } else {
                rateLimitKey = "ratelimit:ip:" + clientIp;
            }
        }

        RateLimiterService.RateLimitResult result = rateLimiterService.checkRateLimit(rateLimitKey, isAuthEndpoint);

        response.setHeader("X-RateLimit-Limit", String.valueOf(result.getLimit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(result.getRemaining()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(System.currentTimeMillis() / 1000 + (result.isAllowed() ? 60 : result.getRetryAfterSeconds())));

        if (!result.isAllowed()) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(result.getRetryAfterSeconds()));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            String traceId = TraceIdFilter.getCurrentTraceId();
            ErrorResponse error = new ErrorResponse(
                    "Rate limit exceeded. Please wait " + result.getRetryAfterSeconds() + " seconds before retrying.",
                    null,
                    traceId
            );

            response.getWriter().write(objectMapper.writeValueAsString(error));
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        String xr = request.getHeader("X-Real-IP");
        if (xr != null && !xr.isBlank()) {
            return xr.trim();
        }
        return request.getRemoteAddr();
    }
}
