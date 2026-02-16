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
        // ─── Auth ───────────────────────────────────────────
        .route("/api/auth/nonce", get(routes::auth::get_nonce))
        .route("/api/auth/verify", post(routes::auth::verify_wallet))
        // ─── Agents ─────────────────────────────────────────
        .route("/api/agents", get(routes::agents::list_agents).post(routes::agents::create_agent))
        .route("/api/agents/my", get(routes::agents::my_agents))
        .route("/api/agents/:id", get(routes::agents::get_agent))
        .route("/api/agents/:id/capabilities", get(routes::agents::get_agent_capabilities))
        .route("/api/agents/:id/profile", get(routes::agents::get_agent_profile))
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



