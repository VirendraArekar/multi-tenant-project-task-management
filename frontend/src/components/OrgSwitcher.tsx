"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import { Organization } from "@/lib/types";
import { ChevronDown, Plus, Check, Building2 } from "lucide-react";

export function OrgSwitcher() {
  const { organizations, currentOrg, switchOrganization, refreshOrgs } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const newOrg = await apiClient<Organization>("/organizations", {
        method: "POST",
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      await refreshOrgs();
      switchOrganization(newOrg.id);
      setIsModalOpen(false);
      setNewOrgName("");
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm transition-colors"
      >
        <div className="flex items-center space-x-2 truncate">
          <Building2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <span className="truncate">{currentOrg ? currentOrg.name : "Select Workspace"}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1 divide-y divide-slate-100">
            <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Workspaces
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {organizations.map((org) => {
                const isSelected = currentOrg?.id === org.id;
                return (
                  <button
                    key={org.id}
                    onClick={() => {
                      switchOrganization(org.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-50 text-slate-700 transition-colors"
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium truncate">{org.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{org.role}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-brand-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="p-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Workspace</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create Org Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Create Workspace</h3>
            <p className="text-sm text-slate-500 mb-4">
              Workspaces represent separate companies, departments, or tenants.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateOrg}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Engineering"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {isLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrgSwitcher;

