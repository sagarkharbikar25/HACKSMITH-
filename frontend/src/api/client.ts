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

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

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
