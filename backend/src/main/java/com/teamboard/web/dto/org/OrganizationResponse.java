package com.teamboard.web.dto.org;

import com.teamboard.domain.organization.Role;
import java.time.Instant;

public class OrganizationResponse {
    private Long id;
    private String name;
    private String slug;
    private Role role;
    private Instant createdAt;

    public OrganizationResponse() {
    }

    public OrganizationResponse(Long id, String name, String slug, Role role, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.role = role;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
