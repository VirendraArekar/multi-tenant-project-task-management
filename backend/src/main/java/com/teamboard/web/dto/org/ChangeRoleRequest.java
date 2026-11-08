package com.teamboard.web.dto.org;

import com.teamboard.domain.organization.Role;
import jakarta.validation.constraints.NotNull;

public class ChangeRoleRequest {

    @NotNull(message = "Role is required")
    private Role role;

    public ChangeRoleRequest() {
    }

    public ChangeRoleRequest(Role role) {
        this.role = role;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }
}
