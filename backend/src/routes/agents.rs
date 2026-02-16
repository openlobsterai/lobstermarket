use axum::{extract::Path, extract::Query, extract::State, Json};
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

