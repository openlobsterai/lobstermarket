use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ─── User ───────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub client_score: f32,
    pub is_suspended: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ─── Wallet ─────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Wallet {
    pub id: Uuid,
    pub user_id: Uuid,
    pub public_key: String,
    pub wallet_type: String,
    pub is_primary: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

// ─── Agent ──────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Agent {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub tagline: Option<String>,
    pub description: Option<String>,
    pub avatar_url: Option<String>,
    pub endpoint_url: Option<String>,
    pub source_url: Option<String>,
    pub verification_tier: String,
    pub lobster_score: f32,
    pub total_jobs_completed: i32,
    pub on_time_pct: f32,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AgentCapability {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub capability: String,
    pub proficiency_level: i32,
}

// ─── Job ────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Job {
    pub id: Uuid,
    pub client_id: Uuid,
    pub title: String,
    pub description: String,
    pub budget_lamports: Option<i64>,
    pub state: String,
    pub currency: String,
    pub currency_chain: String,
    pub battle_mode: bool,
    pub battle_max_submissions: Option<i32>,
    pub battle_partial_reward_pct: Option<i32>,
    pub deadline: Option<DateTime<Utc>>,
    pub tags: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ─── Job Requirement ────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct JobRequirement {
    pub id: Uuid,
    pub job_id: Uuid,
    pub requirement: String,
    pub is_mandatory: bool,
}

// ─── Offer ──────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Offer {
    pub id: Uuid,
    pub job_id: Uuid,
    pub agent_id: Uuid,
    pub proposed_price_lamports: Option<i64>,
    pub estimated_duration_hours: Option<i32>,
    pub pitch: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ─── Contract ───────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Contract {
    pub id: Uuid,
    pub job_id: Uuid,
    pub offer_id: Uuid,
    pub agent_id: Uuid,
    pub client_id: Uuid,
    pub agreed_price_lamports: i64,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

// ─── Escrow ─────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EscrowAccount {
    pub id: Uuid,
    pub contract_id: Uuid,
    pub amount_lamports: i64,
    pub state: String,
    pub funded_at: Option<DateTime<Utc>>,
    pub released_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EscrowLedgerEntry {
    pub id: Uuid,
    pub escrow_id: Uuid,
    pub entry_type: String,
    pub amount_lamports: i64,
    pub created_at: DateTime<Utc>,
}

// ─── Job Run ────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct JobRun {
    pub id: Uuid,
    pub contract_id: Uuid,
    pub agent_id: Uuid,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub output_summary: Option<String>,
    pub logs_url: Option<String>,
}

// ─── Submission ─────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Submission {
    pub id: Uuid,
    pub job_id: Uuid,
    pub contract_id: Option<Uuid>,
    pub agent_id: Uuid,
    pub content: String,
    pub artifacts_url: Option<String>,
    pub status: String,
    pub is_battle_submission: bool,
    pub created_at: DateTime<Utc>,
}

// ─── Review ─────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Review {
    pub id: Uuid,
    pub contract_id: Uuid,
    pub reviewer_id: Uuid,
    pub reviewee_id: Uuid,
    pub reviewer_role: String,
    pub quality: i32,
    pub communication: i32,
    pub timeliness: i32,
    pub requirements_clarity: Option<i32>,
    pub would_work_again: bool,
    pub comment: String,
    pub proof_links: Option<Vec<String>>,
    pub is_hidden: bool,
    pub weight: f32,
    pub created_at: DateTime<Utc>,
}

// ─── Reputation Event ───────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ReputationEvent {
    pub id: Uuid,
    pub user_id: Uuid,
    pub agent_id: Option<Uuid>,
    pub event_type: String,
    pub score_delta: f32,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

// ─── Leaderboard Snapshot ───────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LeaderboardSnapshot {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub score: f32,
    pub rank: i32,
    pub snapshot_date: NaiveDate,
    pub created_at: DateTime<Utc>,
}

// ─── Waitlist ───────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WaitlistEntry {
    pub id: Uuid,
    pub email: String,
    pub wallet_address: Option<String>,
    pub interest: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ─── Audit Log ──────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ─── Dispute ────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Dispute {
    pub id: Uuid,
    pub contract_id: Uuid,
    pub initiator_id: Uuid,
    pub reason: String,
    pub status: String,
    pub resolution: Option<String>,
    pub resolved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

// ═══════════════════════════════════════════════════════════════
// REQUEST / RESPONSE DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateAgentReq {
    pub name: String,
    pub tagline: Option<String>,
    pub description: Option<String>,
    pub endpoint_url: Option<String>,
    pub source_url: Option<String>,
    pub capabilities: Option<Vec<CapabilityInput>>,
}

#[derive(Debug, Deserialize)]
pub struct CapabilityInput {
    pub capability: String,
    pub proficiency_level: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateJobReq {
    pub title: String,
    pub description: String,
    pub budget_lamports: Option<i64>,
    pub currency: Option<String>,        // USDC | USDT | SOL — default USDC
    pub currency_chain: Option<String>,   // solana | ethereum | base | tron | bnb — default solana
    pub battle_mode: Option<bool>,
    pub battle_max_submissions: Option<i32>,
    pub battle_partial_reward_pct: Option<i32>,
    pub deadline: Option<DateTime<Utc>>,
    pub tags: Option<Vec<String>>,
    pub requirements: Option<Vec<RequirementInput>>,
}

#[derive(Debug, Deserialize)]
pub struct RequirementInput {
    pub requirement: String,
    pub is_mandatory: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PublishJobReq {
    pub job_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateOfferReq {
    pub job_id: Uuid,
    pub agent_id: Uuid,
    pub proposed_price_lamports: Option<i64>,
    pub estimated_duration_hours: Option<i32>,
    pub pitch: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AcceptOfferReq {
    pub offer_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct SubmitWorkReq {
    pub contract_id: Uuid,
    pub content: String,
    pub artifacts_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BattleSubmitReq {
    pub job_id: Uuid,
    pub agent_id: Uuid,
    pub content: String,
    pub artifacts_url: Option<String>,
    pub proposed_price_lamports: Option<i64>,
    pub estimated_duration_hours: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct BattleSelectWinnerReq {
    pub job_id: Uuid,
    pub winner_submission_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateReviewReq {
    pub contract_id: Uuid,
    pub quality: i32,
    pub communication: i32,
    pub timeliness: i32,
    pub requirements_clarity: Option<i32>,
    pub would_work_again: bool,
    pub comment: String,
    pub proof_links: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct WaitlistReq {
    pub email: String,
    pub wallet_address: Option<String>,
    pub interest: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EscrowFundReq {
    pub contract_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct EscrowReleaseReq {
    pub contract_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct DisputeReq {
    pub contract_id: Uuid,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct AdminModerateReviewReq {
    pub review_id: Uuid,
    pub is_hidden: Option<bool>,
    pub weight: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct AdminSuspendReq {
    pub user_id: Uuid,
    pub suspended: bool,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Serialize)]
pub struct NonceResponse {
    pub nonce: String,
    pub message: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyWalletReq {
    pub wallet: String,
    pub signature: String,
    pub message: String,
    pub wallet_type: Option<String>, // solana | ethereum | base | bnb | tron
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl PaginationParams {
    pub fn offset(&self) -> i64 {
        ((self.page.unwrap_or(1) - 1) * self.per_page.unwrap_or(20)).max(0)
    }
    pub fn limit(&self) -> i64 {
        self.per_page.unwrap_or(20).min(100)
    }
}

#[derive(Debug, Serialize)]
pub struct LeaderboardEntry {
    pub rank: i64,
    pub agent: Agent,
    pub score: f32,
}

#[derive(Debug, Serialize)]
pub struct BattleView {
    pub job: Job,
    pub submissions: Vec<BattleSubmission>,
}

#[derive(Debug, Serialize)]
pub struct BattleSubmission {
    pub submission: Submission,
    pub agent: Agent,
    pub proposed_price_lamports: Option<i64>,
    pub estimated_duration_hours: Option<i32>,
}



