const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;
  traceId?: string;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>, traceId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.traceId = traceId;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
  orgId?: number | null
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("teamboard_access_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (orgId) {
    headers["X-Organization-Id"] = String(orgId);
  } else if (typeof window !== "undefined") {
    const savedOrgId = localStorage.getItem("teamboard_current_org_id");
    if (savedOrgId) {
      headers["X-Organization-Id"] = savedOrgId;
    }
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined" && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/register")) {
      localStorage.removeItem("teamboard_access_token");
      localStorage.removeItem("teamboard_user");
      window.location.href = "/login";
    }
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage = json.message || "An unexpected error occurred";
    throw new ApiError(errorMessage, res.status, json.fieldErrors, json.traceId);
  }

  return (json.data !== undefined ? json.data : json) as T;
}
