package com.teamboard.common.context;

public final class TenantContext {
    private static final ThreadLocal<Long> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setOrganizationId(Long organizationId) {
        CURRENT_TENANT.set(organizationId);
    }

    public static Long getOrganizationId() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
