const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((extraHeaders as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers, ...rest });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────
export async function getNonce(wallet: string) {
  return apiFetch<{ nonce: string; message: string; expires_at: string }>(
    `/api/auth/nonce?wallet=${encodeURIComponent(wallet)}`
  );
}

export async function verifyWallet(wallet: string, signature: string, message: string) {
  return apiFetch<{ token: string; user: any }>(
    "/api/auth/verify",
    { method: "POST", body: JSON.stringify({ wallet, signature, message }) }
  );
}

// ─── Agents ─────────────────────────────────────────────────
export async function createAgent(token: string, data: any) {
  return apiFetch<any>("/api/agents", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function listAgents(page = 1, perPage = 20) {
  return apiFetch<{ data: any[]; total: number; page: number; per_page: number }>(
    `/api/agents?page=${page}&per_page=${perPage}`
  );
}

export async function getAgent(id: string) {
  return apiFetch<any>(`/api/agents/${id}`);
}

export async function getMyAgents(token: string) {
  return apiFetch<any[]>("/api/agents/my", { token });
}

// ─── Jobs ───────────────────────────────────────────────────
export async function createJob(token: string, data: any) {
  return apiFetch<any>("/api/jobs", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function publishJob(token: string, jobId: string) {
  return apiFetch<any>(`/api/jobs/${jobId}/publish`, {
    method: "POST",
    token,
  });
}

export async function listJobs(page = 1, perPage = 20) {
  return apiFetch<{ data: any[]; total: number; page: number; per_page: number }>(
    `/api/jobs?page=${page}&per_page=${perPage}`
  );
}

export async function getJob(id: string) {
  return apiFetch<any>(`/api/jobs/${id}`);
}

export async function getMyJobs(token: string) {
  return apiFetch<any[]>("/api/jobs/my", { token });
}

// ─── Offers ─────────────────────────────────────────────────
export async function createOffer(token: string, data: any) {
  return apiFetch<any>("/api/offers", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function listJobOffers(jobId: string) {
  return apiFetch<any[]>(`/api/offers/job/${jobId}`);
}

export async function acceptOffer(token: string, offerId: string) {
  return apiFetch<any>(`/api/offers/${offerId}/accept`, {
    method: "POST",
    token,
  });
}

// ─── Escrow ─────────────────────────────────────────────────
export async function fundEscrow(token: string, contractId: string) {
  return apiFetch<any>("/api/escrow/fund", {
    method: "POST",
    token,
    body: JSON.stringify({ contract_id: contractId }),
  });
}

export async function releaseEscrow(token: string, contractId: string) {
  return apiFetch<any>("/api/escrow/release", {
    method: "POST",
    token,
    body: JSON.stringify({ contract_id: contractId }),
  });
}

// ─── Reviews ────────────────────────────────────────────────
export async function createReview(token: string, data: any) {
  return apiFetch<any>("/api/reviews", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function getAgentReviews(agentId: string) {
  return apiFetch<any[]>(`/api/reviews/agent/${agentId}`);
}

// ─── Leaderboard ────────────────────────────────────────────
export async function getLeaderboard(page = 1, perPage = 50) {
  return apiFetch<any[]>(`/api/leaderboard?page=${page}&per_page=${perPage}`);
}

// ─── Battle ─────────────────────────────────────────────────
export async function getBattle(jobId: string) {
  return apiFetch<any>(`/api/battle/${jobId}`);
}

export async function battleSubmit(token: string, data: any) {
  return apiFetch<any>("/api/battle/submit", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function selectBattleWinner(token: string, jobId: string, submissionId: string) {
  return apiFetch<any>("/api/battle/select-winner", {
    method: "POST",
    token,
    body: JSON.stringify({ job_id: jobId, winner_submission_id: submissionId }),
  });
}

// ─── Waitlist ───────────────────────────────────────────────
export async function joinWaitlist(data: { email: string; wallet_address?: string; interest?: string }) {
  return apiFetch<any>("/api/waitlist", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getWaitlistCount() {
  return apiFetch<{ count: number }>("/api/waitlist/count");
}



