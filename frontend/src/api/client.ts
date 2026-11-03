import type {
  User,
  Submission,
  SubmissionDetail,
  AuditResult,
  Finding,
  Review,
  Comment,
  Rule,
  Fact,
  InsightsData,
  AuditLogItem,
} from "../types";

const rawBaseUrl = (import.meta.env.VITE_API_URL || "/api").trim().replace(/\/+$/, "");
const BASE_URL =
  rawBaseUrl.startsWith("http") && !rawBaseUrl.endsWith("/api")
    ? `${rawBaseUrl}/api`
    : rawBaseUrl;

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(status: number, message: string, code: string = "API_ERROR", details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("brandguard_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let message = response.statusText;
    let code = "UNKNOWN_ERROR";
    let details: any = null;

    if (data && typeof data === "object") {
      if (data.error) {
        code = data.error.code || code;
        message = data.error.message || message;
        details = data.error.details;
      } else if (data.detail) {
        if (typeof data.detail === "string") {
          message = data.detail;
        } else {
          details = data.detail;
        }
      }
    }

    throw new ApiError(response.status, message, code, details);
  }

  return data as T;
}

// ── Round 3 helpers ──────────────────────────────────────────────────────────

/** Build auth headers — adds Bearer token; only adds Content-Type for JSON requests */
function authHeaders(json: boolean): Record<string, string> {
  const token = sessionStorage.getItem("brandguard_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/** Convert a failed response into an ApiError (shared by apiUpload + apiBlob) */
async function toApiError(res: Response): Promise<ApiError> {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  let message = res.statusText;
  let code = "UNKNOWN_ERROR";
  let details: any = null;
  if (data && typeof data === "object") {
    if (data.error) {
      code = data.error.code || code;
      message = data.error.message || message;
      details = data.error.details;
    } else if (data.detail) {
      message = typeof data.detail === "string" ? data.detail : message;
      details = typeof data.detail !== "string" ? data.detail : null;
    }
  }
  return new ApiError(res.status, message, code, details);
}

/**
 * Multipart upload — DO NOT set Content-Type (browser adds the boundary automatically).
 * Returns the parsed JSON response body.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(false),
    body: form,
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

/**
 * Authenticated binary fetch — returns a Blob (e.g. for image assets behind auth).
 * Use useAssetBlobUrl hook to convert to an object URL.
 */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw await toApiError(res);
  return res.blob();
}

/**
 * Authenticated DELETE — expects 204 No Content.
 */
export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw await toApiError(res);
}

export const api = {
  // --- Auth ---
  auth: {
    async login(email: string, password: string = "demo1234"): Promise<{ token: string; user: User }> {
      return request<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    async register(name: string, email: string, password: string, role: string): Promise<{ token: string; user: User }> {
      return request<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
    },
    async me(): Promise<User> {
      return request<User>("/auth/me");
    },
    async forgotPassword(email: string): Promise<{ message: string; reset_token?: string; expires_in_minutes: number }> {
      return request<{ message: string; reset_token?: string; expires_in_minutes: number }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    async resetPassword(token: string, new_password: string): Promise<{ message: string }> {
      return request<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password }),
      });
    },
  },

  // --- Submissions ---
  submissions: {
    async list(): Promise<Submission[]> {
      return request<Submission[]>("/submissions");
    },
    async get(id: number): Promise<SubmissionDetail> {
      return request<SubmissionDetail>(`/submissions/${id}`);
    },
    async create(payload: { title: string; content_type?: string; body: string }): Promise<SubmissionDetail> {
      return request<SubmissionDetail>("/submissions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    async createVersion(id: number, body: string): Promise<AuditResult> {
      return request<AuditResult>(`/submissions/${id}/versions`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    },
    async recheck(id: number): Promise<AuditResult> {
      return request<AuditResult>(`/submissions/${id}/audit`, {
        method: "POST",
      });
    },
    async submit(id: number): Promise<SubmissionDetail> {
      return request<SubmissionDetail>(`/submissions/${id}/submit`, {
        method: "POST",
      });
    },
    async getDiff(id: number): Promise<{
      submission_id: number;
      v1_number: number;
      v2_number: number;
      diff: string;
      v1_body: string;
      v2_body: string;
    }> {
      return request(`/submissions/${id}/diff`);
    },
    async getComments(id: number): Promise<Comment[]> {
      return request<Comment[]>(`/submissions/${id}/comments`);
    },
    async addComment(id: number, body: string): Promise<Comment> {
      return request<Comment>(`/submissions/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    },
  },

  // --- Findings ---
  findings: {
    async resolve(
      id: number,
      resolution: "accepted" | "edited" | "dismissed",
      reason?: string
    ): Promise<Finding> {
      return request<Finding>(`/findings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ resolution, reason }),
      });
    },
    async get(id: number): Promise<Finding> {
      return request<Finding>(`/findings/${id}`);
    },
  },

  // --- Review ---
  review: {
    async queue(): Promise<Submission[]> {
      return request<Submission[]>("/review/queue");
    },
    async decide(
      submissionId: number,
      payload: { decision: "approve" | "request_revision"; comment: string; override_reason?: string }
    ): Promise<Review> {
      return request<Review>(`/review/${submissionId}/decision`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  },

  // --- Knowledge ---
  knowledge: {
    async getRules(): Promise<Rule[]> {
      return request<Rule[]>("/knowledge/rules");
    },
    async getRule(id: string): Promise<Rule> {
      return request<Rule>(`/knowledge/rules/${id}`);
    },
    async createRule(payload: Record<string, unknown>): Promise<Rule> {
      return request<Rule>("/knowledge/rules", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    async getFacts(): Promise<Fact[]> {
      return request<Fact[]>("/knowledge/facts");
    },
    async getFact(id: string): Promise<Fact> {
      return request<Fact>(`/knowledge/facts/${id}`);
    },
  },

  // --- Insights ---
  insights: {
    async getSummary(): Promise<InsightsData> {
      return request<InsightsData>("/insights/summary");
    },
  },

  // --- Admin ---
  admin: {
    async getAuditLogs(): Promise<AuditLogItem[]> {
      return request<AuditLogItem[]>("/admin/audit-log");
    },
  },
};
