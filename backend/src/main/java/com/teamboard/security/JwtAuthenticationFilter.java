package com.teamboard.security;

import com.teamboard.common.context.TenantContext;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenStoreService tokenStoreService;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider, TokenStoreService tokenStoreService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.tokenStoreService = tokenStoreService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String token = resolveToken(request);
            if (token != null && !tokenStoreService.isTokenRevoked(token)) {
                Claims claims = jwtTokenProvider.validateAndGetClaims(token);
                if (claims != null) {
                    Long userId = claims.get("userId", Long.class);
                    if (userId == null && claims.get("userId") instanceof Integer intVal) {
                        userId = intVal.longValue();
                    }
                    String email = claims.getSubject();
                    String fullName = claims.get("fullName", String.class);

                    UserPrincipal principal = new UserPrincipal(userId, email, "", fullName);
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }

            // Extract organization ID header if present
            String orgIdHeader = request.getHeader("X-Organization-Id");
            if (orgIdHeader != null && !orgIdHeader.isBlank()) {
                try {
                    TenantContext.setOrganizationId(Long.parseLong(orgIdHeader.trim()));
                } catch (NumberFormatException ignored) {
                }
            }

            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7).trim();
        }
        return null;
    }
}
