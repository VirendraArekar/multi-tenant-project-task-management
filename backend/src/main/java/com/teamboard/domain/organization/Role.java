package com.teamboard.domain.organization;

public enum Role {
    OWNER,
    ADMIN,
    MEMBER;

    public boolean isAtLeast(Role requiredRole) {
        if (this == OWNER) return true;
        if (this == ADMIN) return requiredRole != OWNER;
        return this == requiredRole;
    }
}
