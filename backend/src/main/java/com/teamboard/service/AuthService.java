package com.teamboard.service;

import com.teamboard.common.exception.BadRequestException;
import com.teamboard.common.exception.ResourceNotFoundException;
import com.teamboard.common.exception.UnauthorizedException;
import com.teamboard.domain.organization.Organization;
import com.teamboard.domain.organization.OrganizationMember;
import com.teamboard.domain.organization.OrganizationMemberRepository;
import com.teamboard.domain.organization.OrganizationRepository;
import com.teamboard.domain.organization.Role;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.security.JwtTokenProvider;
import com.teamboard.security.TokenStoreService;
import com.teamboard.web.dto.auth.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final TokenStoreService tokenStoreService;
    private final OutboxService outboxService;

    public AuthService(
            UserRepository userRepository,
            OrganizationRepository organizationRepository,
            OrganizationMemberRepository memberRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            TokenStoreService tokenStoreService,
            OutboxService outboxService
    ) {
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.memberRepository = memberRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.tokenStoreService = tokenStoreService;
        this.outboxService = outboxService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BadRequestException("An account with this email already exists");
        }

        // 1. Create User
        String passwordHash = passwordEncoder.encode(request.getPassword());
        User user = new User(normalizedEmail, passwordHash, request.getFullName().trim());
        user = userRepository.save(user);

        // 2. Create Initial Organization
        String orgName = (request.getOrganizationName() != null && !request.getOrganizationName().isBlank())
                ? request.getOrganizationName().trim()
                : user.getFullName() + "'s Workspace";

        String slug = generateSlug(orgName);
        Organization organization = new Organization(orgName, slug);
        organization = organizationRepository.save(organization);

        // 3. Assign as OWNER
        OrganizationMember member = new OrganizationMember(organization.getId(), user.getId(), Role.OWNER);
        memberRepository.save(member);

        // 4. Record domain event in transactional outbox
        outboxService.recordEvent(
                "ORGANIZATION",
                organization.getId().toString(),
                "ORGANIZATION_CREATED",
                "membership-events",
                Map.of(
                        "organizationId", organization.getId(),
                        "organizationName", organization.getName(),
                        "userId", user.getId(),
                        "userEmail", user.getEmail(),
                        "userName", user.getFullName(),
                        "role", "OWNER"
                )
        );

        // 5. Generate Tokens
        return createAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        return createAuthResponse(user);
    }

    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String storedData = tokenStoreService.validateAndConsumeRefreshToken(request.getRefreshToken());
        if (storedData == null) {
            throw new UnauthorizedException("Invalid or expired refresh token");
        }

        String[] parts = storedData.split(":", 2);
        Long userId = Long.parseLong(parts[0]);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("User not found"));

        return createAuthResponse(user);
    }

    public void logout(String accessToken, LogoutRequest request) {
        if (accessToken != null && !accessToken.isBlank()) {
            tokenStoreService.revokeToken(accessToken, jwtTokenProvider.getAccessTokenExpirationSeconds());
        }
        if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            tokenStoreService.validateAndConsumeRefreshToken(request.getRefreshToken());
        }
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        return new UserDto(user.getId(), user.getEmail(), user.getFullName());
    }

    private AuthResponse createAuthResponse(User user) {
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getFullName());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail());

        tokenStoreService.storeRefreshToken(
                refreshToken,
                user.getId(),
                user.getEmail(),
                jwtTokenProvider.getRefreshTokenExpirationSeconds()
        );

        UserDto userDto = new UserDto(user.getId(), user.getEmail(), user.getFullName());
        return new AuthResponse(
                accessToken,
                refreshToken,
                jwtTokenProvider.getAccessTokenExpirationSeconds(),
                userDto
        );
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
