package com.teamboard.web.dto.org;

import com.teamboard.domain.organization.Role;
import java.time.Instant;

public class InviteResponse {
    private Long id;
    private Long organizationId;
    private String organizationName;
    private String email;
    private Role role;
    private String token;
    private String inviteLink;
    private String inviterName;
    private Instant expiresAt;
    private Instant acceptedAt;
    private Instant createdAt;

    public InviteResponse() {
    }

    public InviteResponse(Long id, Long organizationId, String organizationName, String email, Role role,
                          String token, String inviteLink, String inviterName, Instant expiresAt,
                          Instant acceptedAt, Instant createdAt) {
        this.id = id;
        this.organizationId = organizationId;
        this.organizationName = organizationName;
        this.email = email;
        this.role = role;
        this.token = token;
        this.inviteLink = inviteLink;
        this.inviterName = inviterName;
        this.expiresAt = expiresAt;
        this.acceptedAt = acceptedAt;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(Long organizationId) {
        this.organizationId = organizationId;
    }

    public String getOrganizationName() {
        return organizationName;
    }

    public void setOrganizationName(String organizationName) {
        this.organizationName = organizationName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getInviteLink() {
        return inviteLink;
    }

    public void setInviteLink(String inviteLink) {
        this.inviteLink = inviteLink;
    }

    public String getInviterName() {
        return inviterName;
    }

    public void setInviterName(String inviterName) {
        this.inviterName = inviterName;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(Instant acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
