"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Organization } from "./types";
import { apiClient } from "./api";

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  unreadCount: number;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: User) => Promise<void>;
  register: (token: string, refreshToken: string, user: User) => Promise<void>;
  logout: () => void;
  switchOrganization: (orgId: number) => void;
  refreshOrgs: () => Promise<Organization[]>;
  refreshOrganizations: () => Promise<Organization[]>;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshOrgs = useCallback(async (): Promise<Organization[]> => {
    try {
      const orgs = await apiClient<Organization[]>("/organizations");
      setOrganizations(orgs);

      const savedOrgId = localStorage.getItem("teamboard_current_org_id");
      let selected: Organization | undefined;

      if (savedOrgId) {
        selected = orgs.find((o) => String(o.id) === savedOrgId);
      }

      if (!selected && orgs.length > 0) {
        selected = orgs[0];
      }

      if (selected) {
        setCurrentOrg(selected);
        localStorage.setItem("teamboard_current_org_id", String(selected.id));
      } else {
        setCurrentOrg(null);
        localStorage.removeItem("teamboard_current_org_id");
      }

      return orgs;
    } catch {
      return [];
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    const savedOrgId = localStorage.getItem("teamboard_current_org_id");
    if (!savedOrgId) return;
    try {
      const res = await apiClient<{ unreadCount: number }>(
        `/organizations/${savedOrgId}/notifications/unread-count`,
        {},
        Number(savedOrgId)
      );
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // ignore
    }
  }, []);

  const switchOrganization = (orgId: number) => {
    const target = organizations.find((o) => o.id === orgId);
    if (target) {
      setCurrentOrg(target);
      localStorage.setItem("teamboard_current_org_id", String(target.id));
      refreshUnreadCount();
      // Reload page to refresh all tenant-scoped data
      window.location.reload();
    }
  };

  const login = async (token: string, refreshToken: string, userData: User) => {
    localStorage.setItem("teamboard_access_token", token);
    localStorage.setItem("teamboard_refresh_token", refreshToken);
    localStorage.setItem("teamboard_user", JSON.stringify(userData));
    setUser(userData);
    const orgs = await refreshOrgs();
    if (orgs.length > 0) {
      window.location.href = "/dashboard";
    }
  };

  const register = async (token: string, refreshToken: string, userData: User) => {
    localStorage.setItem("teamboard_access_token", token);
    localStorage.setItem("teamboard_refresh_token", refreshToken);
    localStorage.setItem("teamboard_user", JSON.stringify(userData));
    setUser(userData);
    await refreshOrgs();
    window.location.href = "/dashboard";
  };

  const logout = () => {
    const token = localStorage.getItem("teamboard_access_token");
    const refreshToken = localStorage.getItem("teamboard_refresh_token");
    if (token) {
      apiClient("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    localStorage.removeItem("teamboard_access_token");
    localStorage.removeItem("teamboard_refresh_token");
    localStorage.removeItem("teamboard_user");
    localStorage.removeItem("teamboard_current_org_id");
    setUser(null);
    setCurrentOrg(null);
    setOrganizations([]);
    window.location.href = "/login";
  };

  // Initial load
  useEffect(() => {
    const token = localStorage.getItem("teamboard_access_token");
    const savedUser = localStorage.getItem("teamboard_user");

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        refreshOrgs().then(() => {
          setIsLoading(false);
          refreshUnreadCount();
        });
      } catch {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [refreshOrgs, refreshUnreadCount]);

  // Polling for notifications unread count every 15 seconds
  useEffect(() => {
    if (!user || !currentOrg) return;
    const interval = setInterval(() => {
      refreshUnreadCount();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, currentOrg, refreshUnreadCount]);

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrg,
        unreadCount,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchOrganization,
        refreshOrgs,
        refreshOrganizations: refreshOrgs,
        refreshUnreadCount,
        setUnreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
