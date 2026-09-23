export type Role = "student" | "teacher" | "admin";

export type Permission = "users" | "courses" | "content" | "reports" | "payments" | "settings";
export type ApiUser = { id: string; email: string; name: string; role: Role; phone?: string; parentPhone?: string; grade?: string; subject?: string; grades?: string[]; avatar?: string; status?: "pending" | "approved" | "rejected"; permissions?: Permission[] };

const tokenKey = "oxford-api-token";

export function getApiToken() {
  return localStorage.getItem(tokenKey);
}

export function setApiToken(token: string) {
  localStorage.setItem(tokenKey, token);
}

export function clearApiToken() {
  localStorage.removeItem(tokenKey);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getApiToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`/api${path}`, { ...init, headers });
  const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: { message?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } };
  if (!response.ok) {
    const details = payload.error?.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
    const fields = details?.fieldErrors ? Object.values(details.fieldErrors).flat().join("، ") : "";
    throw new Error([payload.error?.message, fields].filter(Boolean).join(": ") || "تعذر الاتصال بالخادم");
  }
  return payload.data as T;
}

export function apiLogin(identifier: string, password: string) {
  return api<{ token: string; user: ApiUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export function apiLogout() {
  return api<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
}

export function apiMe() {
  return api<ApiUser>("/auth/me");
}

export type RegisterPayload = { name: string; email: string; password: string; role: Role; phone?: string; parentPhone?: string; grade?: string; subject?: string; grades?: string[]; avatar?: string; adminInviteCode?: string };

export function apiRegister(payload: RegisterPayload) {
  return api<{ token: string | null; user: ApiUser; message?: string }>("/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export function apiGenerateAdminInviteCode() {
  return api<{ inviteCode: string }>("/admin/invite-code", { method: "POST" });
}

export function apiSetupStatus() {
  return api<{ setupRequired: boolean }>("/setup/status");
}

export type SetupPrimaryAdminPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  bootstrapSecret: string;
};

export function apiSetupPrimaryAdmin(payload: SetupPrimaryAdminPayload) {
  const { bootstrapSecret, ...body } = payload;
  return api<{ message: string; user: ApiUser }>("/setup/primary-admin", {
    method: "POST",
    headers: {
      "X-Primary-Admin-Bootstrap-Secret": bootstrapSecret,
    },
    body: JSON.stringify(body),
  });
}
