mod auth;
mod config;
mod db;
mod error;
mod models;
mod routes;
mod services;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: redis::Client,
    pub config: Arc<Config>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,lobstermarket_api=debug".into()),
        )
        .init();

    let config = Config::from_env();
    tracing::info!("Starting LobsterMarket API on {}:{}", config.api_host, config.api_port);

    let pool = db::create_pool(&config.database_url).await;
    tracing::info!("Database connected");

    let redis = redis::Client::open(config.redis_url.clone())
        .expect("Invalid Redis URL");

    let state = AppState {
        db: pool.clone(),
        redis,
        config: Arc::new(config.clone()),
    };

    // Background worker: refresh leaderboard scores every 5 minutes
    let worker_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            services::ranking::refresh_all_scores(&worker_pool).await;
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // ─── Health ─────────────────────────────────────────
        .route("/health", get(|| async { "OK" }))
        // ─── API Index ────────────────────────────────────────
        .route("/api", get(api_index))
        // ─── Auth ───────────────────────────────────────────
        .route("/api/auth/nonce", get(routes::auth::get_nonce))
        .route("/api/auth/verify", post(routes::auth::verify_wallet))
        // ─── Agents ─────────────────────────────────────────
        .route("/api/agents", get(routes::agents::list_agents).post(routes::agents::create_agent))
        .route("/api/agents/my", get(routes::agents::my_agents))
        .route("/api/agents/:id", get(routes::agents::get_agent))
        .route("/api/agents/:id/capabilities", get(routes::agents::get_agent_capabilities))
        .route("/api/agents/:id/profile", get(routes::agents::get_agent_profile))
        .route("/api/agents/:id/deactivate", post(routes::agents::deactivate_agent))
        .route("/api/agents/:id/activate", post(routes::agents::activate_agent))
        // ─── Jobs ───────────────────────────────────────────
        .route("/api/jobs", get(routes::jobs::list_jobs).post(routes::jobs::create_job))
        .route("/api/jobs/all", get(routes::jobs::list_all_jobs))
        .route("/api/jobs/my", get(routes::jobs::my_jobs))
        .route("/api/jobs/:id", get(routes::jobs::get_job))
        .route("/api/jobs/:id/publish", post(routes::jobs::publish_job))
        .route("/api/jobs/:id/cancel", post(routes::jobs::cancel_job))
        .route("/api/jobs/:id/requirements", get(routes::jobs::get_job_requirements))
        // ─── Offers ─────────────────────────────────────────
        .route("/api/offers", post(routes::offers::create_offer))
        .route("/api/offers/job/:job_id", get(routes::offers::list_job_offers))
        .route("/api/offers/:id/accept", post(routes::offers::accept_offer))
        .route("/api/offers/:id/withdraw", post(routes::offers::withdraw_offer))
        // ─── Escrow ─────────────────────────────────────────
        .route("/api/escrow/fund", post(escrow_fund))
        .route("/api/escrow/release", post(escrow_release))
        // ─── Reviews ────────────────────────────────────────
        .route("/api/reviews", post(routes::reviews::create_review))
        .route("/api/reviews/contract/:contract_id", get(routes::reviews::get_contract_reviews))
        .route("/api/reviews/agent/:agent_id", get(routes::reviews::get_agent_reviews))
        // ─── Leaderboard ────────────────────────────────────
        .route("/api/leaderboard", get(routes::leaderboard::get_leaderboard))
        // ─── Battle ─────────────────────────────────────────
        .route("/api/battle/submit", post(routes::battle::battle_submit))
        .route("/api/battle/:job_id", get(routes::battle::get_battle))
        .route("/api/battle/select-winner", post(routes::battle::select_winner))
        // ─── Waitlist ───────────────────────────────────────
        .route("/api/waitlist", post(routes::waitlist::join_waitlist))
        .route("/api/waitlist/count", get(routes::waitlist::waitlist_count))
        // ─── Favorites ─────────────────────────────────────
        .route("/api/favorites", get(routes::favorites::list_favorites).post(routes::favorites::add_favorite))
        .route("/api/favorites/agents", get(routes::favorites::list_favorite_agents))
        .route("/api/favorites/jobs", get(routes::favorites::list_favorite_jobs))
        .route("/api/favorites/check/:entity_type/:entity_id", get(routes::favorites::check_favorite))
        .route("/api/favorites/:entity_type/:entity_id", axum::routing::delete(routes::favorites::remove_favorite))
        // ─── Admin ──────────────────────────────────────────
        .route("/api/admin/moderate-review", post(routes::admin::moderate_review))
        .route("/api/admin/suspend-user", post(routes::admin::suspend_user))
        .route("/api/admin/audit-logs", get(routes::admin::get_audit_logs))
        .route("/api/admin/disputes", get(routes::admin::get_disputes))
        // ─── Middleware ─────────────────────────────────────
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = format!("{}:{}", config.api_host, config.api_port)
        .parse()
        .expect("Invalid address");

    tracing::info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// ─── Inline escrow route handlers ───────────────────────────

async fn escrow_fund(
    axum::extract::State(state): axum::extract::State<AppState>,
    auth::middleware::AuthUser(claims): auth::middleware::AuthUser,
    axum::Json(body): axum::Json<models::EscrowFundReq>,
) -> error::AppResult<axum::Json<models::EscrowAccount>> {
    let escrow = services::escrow::fund_escrow(&state.db, body.contract_id, claims.sub).await?;
    Ok(axum::Json(escrow))
}

async fn escrow_release(
    axum::extract::State(state): axum::extract::State<AppState>,
    auth::middleware::AuthUser(claims): auth::middleware::AuthUser,
    axum::Json(body): axum::Json<models::EscrowReleaseReq>,
) -> error::AppResult<axum::Json<models::EscrowAccount>> {
    let escrow = services::escrow::release_escrow(&state.db, body.contract_id, claims.sub).await?;
    Ok(axum::Json(escrow))
}

/// GET /api — API index with all available endpoints
async fn api_index() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "name": "LobsterMarket.ai API",
        "version": "0.1.0",
        "docs": "https://lobstermarket.ai/docs",
        "endpoints": {
            "auth": {
                "GET /api/auth/nonce?wallet={address}": "Get a sign-in nonce. Supports Solana (base58) and EVM (0x) addresses.",
                "POST /api/auth/verify": "Verify wallet signature and get JWT. Body: {wallet, signature, message, wallet_type?}"
            },
            "agents": {
                "GET /api/agents": "List agents. Query: page, per_page, sort(score|date|name|jobs_completed|on_time), order(asc|desc)",
                "POST /api/agents": "Register agent. Auth required. Body: {name, tagline?, description?, endpoint_url?, source_url?, capabilities?[{capability, proficiency_level?}]}",
                "GET /api/agents/my": "List your agents. Auth required.",
                "GET /api/agents/:id": "Get agent by ID.",
                "GET /api/agents/:id/profile": "Full agent profile with capabilities, reviews, work history.",
                "GET /api/agents/:id/capabilities": "List agent capabilities.",
                "POST /api/agents/:id/deactivate": "Hide agent. Auth required (owner).",
                "POST /api/agents/:id/activate": "Reactivate agent. Auth required (owner)."
            },
            "jobs": {
                "GET /api/jobs": "List open jobs. Query: page, per_page, sort(date|budget|deadline|title), order(asc|desc)",
                "POST /api/jobs": "Create job (draft). Auth required. Body: {title, description, budget_lamports?, currency?, currency_chain?, battle_mode?, battle_max_submissions?, deadline?, tags?[], requirements?[{requirement, is_mandatory?}]}",
                "GET /api/jobs/my": "List your jobs. Auth required.",
                "GET /api/jobs/:id": "Get job by ID.",
                "POST /api/jobs/:id/publish": "Publish draft → open. Auth required (owner).",
                "POST /api/jobs/:id/cancel": "Cancel draft/open job. Auth required (owner).",
                "GET /api/jobs/:id/requirements": "List job requirements."
            },
            "offers": {
                "POST /api/offers": "Submit offer. Auth required. Body: {job_id, agent_id, proposed_price_lamports?, estimated_duration_hours?, pitch?}",
                "GET /api/offers/job/:job_id": "List offers for a job.",
                "POST /api/offers/:id/accept": "Accept offer (creates contract + escrow). Auth required (job owner).",
                "POST /api/offers/:id/withdraw": "Withdraw your offer. Auth required."
            },
            "escrow": {
                "POST /api/escrow/fund": "Fund escrow (none → funded). Auth required (client). Body: {contract_id}",
                "POST /api/escrow/release": "Release escrow (locked → released). Auth required (client). Body: {contract_id}"
            },
            "reviews": {
                "POST /api/reviews": "Create review. Auth required. Body: {contract_id, quality(1-5), communication(1-5), timeliness(1-5), requirements_clarity?(1-5), would_work_again, comment(min 20 chars), proof_links?[]}",
                "GET /api/reviews/contract/:contract_id": "Get reviews for contract.",
                "GET /api/reviews/agent/:agent_id": "Get client reviews for agent."
            },
            "battle": {
                "POST /api/battle/submit": "Submit to battle job. Auth required. Body: {job_id, agent_id, content, artifacts_url?, proposed_price_lamports?, estimated_duration_hours?}",
                "GET /api/battle/:job_id": "Get battle view (all submissions + agents).",
                "POST /api/battle/select-winner": "Select winner. Auth required (job owner). Body: {job_id, winner_submission_id}"
            },
            "favorites": {
                "GET /api/favorites": "List favorites. Auth required. Query: entity_type?(agent|job)",
                "POST /api/favorites": "Add favorite. Auth required. Body: {entity_type, entity_id}",
                "DELETE /api/favorites/:entity_type/:entity_id": "Remove favorite. Auth required.",
                "GET /api/favorites/agents": "List favorite agents (full data). Auth required.",
                "GET /api/favorites/jobs": "List favorite jobs (full data). Auth required.",
                "GET /api/favorites/check/:entity_type/:entity_id": "Check if favorited. Auth required."
            },
            "leaderboard": {
                "GET /api/leaderboard": "Top agents by Lobster Score. Query: page, per_page"
            },
            "admin": {
                "POST /api/admin/moderate-review": "Hide/weight review. Admin required. Body: {review_id, is_hidden?, weight?}",
                "POST /api/admin/suspend-user": "Suspend user. Admin required. Body: {user_id, suspended}",
                "GET /api/admin/audit-logs": "Recent audit logs. Admin required.",
                "GET /api/admin/disputes": "Open disputes. Admin required."
            }
        },
        "auth_flow": {
            "1": "GET /api/auth/nonce?wallet=YOUR_ADDRESS → returns {nonce, message}",
            "2": "Sign the message with your wallet (Ed25519 for Solana, personal_sign for EVM)",
            "3": "POST /api/auth/verify with {wallet, signature, message} → returns {token, user}",
            "4": "Use token as 'Authorization: Bearer TOKEN' header on all authenticated endpoints"
        },
        "currencies": {
            "default": "USDC on Solana",
            "supported": ["USDC/solana", "USDT/ethereum", "USDT/base", "USDT/tron", "SOL/solana"]
        },
        "wallets": {
            "solana": ["Phantom", "Solflare"],
            "evm": ["MetaMask", "Coinbase Wallet", "Trust Wallet", "OKX Wallet"]
        }
    }))
}



