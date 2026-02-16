use axum::{extract::Path, extract::Query, extract::State, Json};
use serde::Serialize;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::AppState;

/// POST /api/agents — register a new agent
pub async fn create_agent(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<CreateAgentReq>,
) -> AppResult<Json<Agent>> {
    let agent = sqlx::query_as::<_, Agent>(
        r#"INSERT INTO agents (owner_id, name, tagline, description, endpoint_url, source_url)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&body.name)
    .bind(&body.tagline)
    .bind(&body.description)
    .bind(&body.endpoint_url)
    .bind(&body.source_url)
    .fetch_one(&state.db)
    .await?;

    // Insert capabilities
    if let Some(caps) = &body.capabilities {
        for cap in caps {
            sqlx::query(
                "INSERT INTO agent_capabilities (agent_id, capability, proficiency_level) VALUES ($1, $2, $3)"
            )
            .bind(agent.id)
            .bind(&cap.capability)
            .bind(cap.proficiency_level.unwrap_or(1))
            .execute(&state.db)
            .await?;
        }
    }

    sqlx::query(
        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1, 'agent_created', 'agent', $2)"
    )
    .bind(claims.sub)
    .bind(agent.id)
    .execute(&state.db)
    .await?;

    Ok(Json(agent))
}

/// GET /api/agents — list agents with pagination
pub async fn list_agents(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<PaginatedResponse<Agent>>> {
    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agents WHERE status = 'active'"
    )
    .fetch_one(&state.db)
    .await?;

    let agents = sqlx::query_as::<_, Agent>(
        "SELECT * FROM agents WHERE status = 'active' ORDER BY lobster_score DESC LIMIT $1 OFFSET $2"
    )
    .bind(params.limit())
    .bind(params.offset())
    .fetch_all(&state.db)
    .await?;

    Ok(Json(PaginatedResponse {
        data: agents,
        total: total.0,
        page: params.page.unwrap_or(1),
        per_page: params.limit(),
    }))
}

/// GET /api/agents/:id
pub async fn get_agent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Agent>> {
    let agent = sqlx::query_as::<_, Agent>(
        "SELECT * FROM agents WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Agent not found".into()))?;

    Ok(Json(agent))
}

/// GET /api/agents/:id/capabilities
pub async fn get_agent_capabilities(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<AgentCapability>>> {
    let caps = sqlx::query_as::<_, AgentCapability>(
        "SELECT * FROM agent_capabilities WHERE agent_id = $1"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(caps))
}

/// GET /api/agents/my — list agents owned by the authenticated user
pub async fn my_agents(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Vec<Agent>>> {
    let agents = sqlx::query_as::<_, Agent>(
        "SELECT * FROM agents WHERE owner_id = $1 ORDER BY created_at DESC"
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(agents))
}

// ═══════════════════════════════════════════════════════════════
// AGENT PROFILE — full profile with capabilities, work history, reviews
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct AgentProfile {
    pub agent: Agent,
    pub capabilities: Vec<AgentCapability>,
    pub owner_name: Option<String>,
    pub review_stats: ReviewStats,
    pub completed_jobs: Vec<CompletedJob>,
}

#[derive(Debug, Serialize)]
pub struct ReviewStats {
    pub total_reviews: i64,
    pub avg_quality: f64,
    pub avg_communication: f64,
    pub avg_timeliness: f64,
    pub would_work_again_pct: f64,
}

#[derive(Debug, Serialize)]
pub struct CompletedJob {
    pub job_title: String,
    pub job_description: String,
    pub agreed_price_lamports: i64,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub contract_id: Uuid,
    pub job_id: Uuid,
    pub review: Option<JobReviewSummary>,
}

#[derive(Debug, Serialize)]
pub struct JobReviewSummary {
    pub quality: i32,
    pub communication: i32,
    pub timeliness: i32,
    pub would_work_again: bool,
    pub comment: String,
}

/// GET /api/agents/:id/profile — full agent profile
pub async fn get_agent_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<AgentProfile>> {
    // Agent
    let agent = sqlx::query_as::<_, Agent>("SELECT * FROM agents WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Agent not found".into()))?;

    // Capabilities
    let capabilities = sqlx::query_as::<_, AgentCapability>(
        "SELECT * FROM agent_capabilities WHERE agent_id = $1"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    // Owner display name
    let owner: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT display_name FROM users WHERE id = $1"
    )
    .bind(agent.owner_id)
    .fetch_optional(&state.db)
    .await?;
    let owner_name = owner.and_then(|o| o.0);

    // Review stats
    let stats_row: Option<(i64, Option<f64>, Option<f64>, Option<f64>)> = sqlx::query_as(
        r#"SELECT
             COUNT(*)::bigint,
             AVG(r.quality::float),
             AVG(r.communication::float),
             AVG(r.timeliness::float)
           FROM reviews r
           JOIN contracts c ON r.contract_id = c.id
           WHERE c.agent_id = $1
             AND r.reviewer_role = 'client'
             AND r.is_hidden = false"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let would_work_count: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM reviews r
           JOIN contracts c ON r.contract_id = c.id
           WHERE c.agent_id = $1
             AND r.reviewer_role = 'client'
             AND r.is_hidden = false
             AND r.would_work_again = true"#,
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let (total_reviews, avg_q, avg_c, avg_t) = stats_row.unwrap_or((0, None, None, None));
    let review_stats = ReviewStats {
        total_reviews,
        avg_quality: avg_q.unwrap_or(0.0),
        avg_communication: avg_c.unwrap_or(0.0),
        avg_timeliness: avg_t.unwrap_or(0.0),
        would_work_again_pct: if total_reviews > 0 {
            (would_work_count.0 as f64 / total_reviews as f64) * 100.0
        } else {
            0.0
        },
    };

    // Completed jobs (last 20)
    let contracts = sqlx::query_as::<_, Contract>(
        r#"SELECT * FROM contracts
           WHERE agent_id = $1 AND status = 'completed'
           ORDER BY completed_at DESC LIMIT 20"#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let mut completed_jobs = Vec::new();
    for contract in &contracts {
        let job = sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE id = $1")
            .bind(contract.job_id)
            .fetch_optional(&state.db)
            .await?;

        let review = sqlx::query_as::<_, Review>(
            "SELECT * FROM reviews WHERE contract_id = $1 AND reviewer_role = 'client' AND is_hidden = false"
        )
        .bind(contract.id)
        .fetch_optional(&state.db)
        .await?;

        if let Some(job) = job {
            completed_jobs.push(CompletedJob {
                job_title: job.title,
                job_description: job.description,
                agreed_price_lamports: contract.agreed_price_lamports,
                completed_at: contract.completed_at,
                contract_id: contract.id,
                job_id: contract.job_id,
                review: review.map(|r| JobReviewSummary {
                    quality: r.quality,
                    communication: r.communication,
                    timeliness: r.timeliness,
                    would_work_again: r.would_work_again,
                    comment: r.comment,
                }),
            });
        }
    }

    Ok(Json(AgentProfile {
        agent,
        capabilities,
        owner_name,
        review_stats,
        completed_jobs,
    }))
}
