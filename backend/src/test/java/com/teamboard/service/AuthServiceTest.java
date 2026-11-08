package com.teamboard.service;

import com.teamboard.common.exception.BadRequestException;
import com.teamboard.common.exception.UnauthorizedException;
import com.teamboard.domain.organization.Organization;
import com.teamboard.domain.organization.OrganizationMember;
import com.teamboard.domain.organization.OrganizationMemberRepository;
import com.teamboard.domain.organization.OrganizationRepository;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.security.JwtTokenProvider;
import com.teamboard.security.TokenStoreService;
import com.teamboard.web.dto.auth.AuthResponse;
import com.teamboard.web.dto.auth.LoginRequest;
import com.teamboard.web.dto.auth.RefreshTokenRequest;
import com.teamboard.web.dto.auth.RegisterRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private OrganizationMemberRepository memberRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private TokenStoreService tokenStoreService;

    @Mock
    private OutboxService outboxService;

    @InjectMocks
    private AuthService authService;

    @BeforeEach
    void setUp() {
    }

    @Test
    void registerUserSuccessfully() {
        RegisterRequest request = new RegisterRequest("john@example.com", "secret123", "John Doe", "Acme Corp");

        when(userRepository.existsByEmail("john@example.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("hashed-pwd");
        when(organizationRepository.existsBySlug("acme-corp")).thenReturn(false);

        when(userRepository.save(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(1L);
            return u;
        });

        when(organizationRepository.save(any(Organization.class))).thenAnswer(i -> {
            Organization o = i.getArgument(0);
            o.setId(10L);
            return o;
        });

        when(jwtTokenProvider.generateAccessToken(1L, "john@example.com", "John Doe")).thenReturn("mock-access-token");
        when(jwtTokenProvider.generateRefreshToken(1L, "john@example.com")).thenReturn("mock-refresh-token");
        when(jwtTokenProvider.getAccessTokenExpirationSeconds()).thenReturn(900L);
        when(jwtTokenProvider.getRefreshTokenExpirationSeconds()).thenReturn(604800L);

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("mock-access-token", response.getAccessToken());
        assertEquals("mock-refresh-token", response.getRefreshToken());
        assertEquals("john@example.com", response.getUser().getEmail());

        verify(memberRepository, times(1)).save(any(OrganizationMember.class));
        verify(outboxService, times(1)).recordEvent(eq("ORGANIZATION"), eq("10"), eq("ORGANIZATION_CREATED"), any(), any());
        verify(tokenStoreService, times(1)).storeRefreshToken("mock-refresh-token", 1L, "john@example.com", 604800L);
    }

    @Test
    void registerDuplicateEmailThrowsBadRequest() {
        RegisterRequest request = new RegisterRequest("john@example.com", "secret123", "John Doe", null);
        when(userRepository.existsByEmail("john@example.com")).thenReturn(true);

        assertThrows(BadRequestException.class, () -> authService.register(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    void loginSuccess() {
        User user = new User("john@example.com", "hashed-pwd", "John Doe");
        user.setId(1L);

        when(userRepository.findByEmail("john@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "hashed-pwd")).thenReturn(true);
        when(jwtTokenProvider.generateAccessToken(1L, "john@example.com", "John Doe")).thenReturn("mock-access-token");
        when(jwtTokenProvider.generateRefreshToken(1L, "john@example.com")).thenReturn("mock-refresh-token");
        when(jwtTokenProvider.getAccessTokenExpirationSeconds()).thenReturn(900L);
        when(jwtTokenProvider.getRefreshTokenExpirationSeconds()).thenReturn(604800L);

        LoginRequest request = new LoginRequest("john@example.com", "secret123");
        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("mock-access-token", response.getAccessToken());
        assertEquals("mock-refresh-token", response.getRefreshToken());
    }

    @Test
    void loginInvalidPasswordThrowsUnauthorized() {
        User user = new User("john@example.com", "hashed-pwd", "John Doe");
        user.setId(1L);

        when(userRepository.findByEmail("john@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "hashed-pwd")).thenReturn(false);

        LoginRequest request = new LoginRequest("john@example.com", "wrong-password");
        assertThrows(UnauthorizedException.class, () -> authService.login(request));
    }

    @Test
    void refreshTokenSuccess() {
        User user = new User("john@example.com", "hashed-pwd", "John Doe");
        user.setId(1L);

        when(tokenStoreService.validateAndConsumeRefreshToken("old-refresh-token")).thenReturn("1:john@example.com");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(jwtTokenProvider.generateAccessToken(1L, "john@example.com", "John Doe")).thenReturn("new-access-token");
        when(jwtTokenProvider.generateRefreshToken(1L, "john@example.com")).thenReturn("new-refresh-token");
        when(jwtTokenProvider.getAccessTokenExpirationSeconds()).thenReturn(900L);
        when(jwtTokenProvider.getRefreshTokenExpirationSeconds()).thenReturn(604800L);

        RefreshTokenRequest request = new RefreshTokenRequest("old-refresh-token");
        AuthResponse response = authService.refreshToken(request);

        assertNotNull(response);
        assertEquals("new-access-token", response.getAccessToken());
        assertEquals("new-refresh-token", response.getRefreshToken());
        verify(tokenStoreService, times(1)).storeRefreshToken("new-refresh-token", 1L, "john@example.com", 604800L);
    }
}
