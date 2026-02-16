use axum::{extract::Path, extract::Query, extract::State, Json};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::AppState;

/// POST /api/jobs — create a new job (draft)
pub async fn create_job(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<CreateJobReq>,
) -> AppResult<Json<Job>> {
    let job = sqlx::query_as::<_, Job>(
        r#"INSERT INTO jobs (client_id, title, description, budget_lamports, battle_mode,
           battle_max_submissions, battle_partial_reward_pct, deadline, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&body.title)
    .bind(&body.description)
    .bind(body.budget_lamports)
    .bind(body.battle_mode.unwrap_or(false))
    .bind(body.battle_max_submissions)
    .bind(body.battle_partial_reward_pct)
    .bind(body.deadline)
    .bind(&body.tags.clone().unwrap_or_default())
    .fetch_one(&state.db)
    .await?;

    // Insert requirements
    if let Some(reqs) = &body.requirements {
        for req in reqs {
            sqlx::query(
                "INSERT INTO job_requirements (job_id, requirement, is_mandatory) VALUES ($1, $2, $3)"
            )
            .bind(job.id)
            .bind(&req.requirement)
            .bind(req.is_mandatory.unwrap_or(true))
            .execute(&state.db)
            .await?;
        }
    }

    Ok(Json(job))
}

/// POST /api/jobs/:id/publish — transition draft → open
pub async fn publish_job(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Job>> {
    let job = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE id = $1 AND client_id = $2"
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".into()))?;

    if job.state != "draft" {
        return Err(AppError::BadRequest(format!(
            "Cannot publish job in state '{}'", job.state
        )));
    }

    let updated = sqlx::query_as::<_, Job>(
        "UPDATE jobs SET state = 'open', updated_at = now() WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated))
}

/// GET /api/jobs — browse open jobs
pub async fn list_jobs(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<PaginatedResponse<Job>>> {
    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM jobs WHERE state = 'open'"
    )
    .fetch_one(&state.db)
    .await?;

    let jobs = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE state = 'open' ORDER BY created_at DESC LIMIT $1 OFFSET $2"
    )
    .bind(params.limit())
    .bind(params.offset())
    .fetch_all(&state.db)
    .await?;

    Ok(Json(PaginatedResponse {
        data: jobs,
        total: total.0,
        page: params.page.unwrap_or(1),
        per_page: params.limit(),
    }))
}

/// GET /api/jobs/all — browse all jobs (any state, for authenticated users)
pub async fn list_all_jobs(
    State(state): State<AppState>,
    AuthUser(_claims): AuthUser,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<PaginatedResponse<Job>>> {
    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM jobs"
    )
    .fetch_one(&state.db)
    .await?;

    let jobs = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2"
    )
    .bind(params.limit())
    .bind(params.offset())
    .fetch_all(&state.db)
    .await?;

    Ok(Json(PaginatedResponse {
        data: jobs,
        total: total.0,
        page: params.page.unwrap_or(1),
        per_page: params.limit(),
    }))
}

/// GET /api/jobs/:id
pub async fn get_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Job>> {
    let job = sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".into()))?;

    Ok(Json(job))
}

/// GET /api/jobs/:id/requirements
pub async fn get_job_requirements(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<JobRequirement>>> {
    let reqs = sqlx::query_as::<_, JobRequirement>(
        "SELECT * FROM job_requirements WHERE job_id = $1"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(reqs))
}

/// POST /api/jobs/:id/cancel
pub async fn cancel_job(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Job>> {
    let job = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE id = $1 AND client_id = $2"
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".into()))?;

    if !["draft", "open"].contains(&job.state.as_str()) {
        return Err(AppError::BadRequest("Can only cancel draft or open jobs".into()));
    }

    let updated = sqlx::query_as::<_, Job>(
        "UPDATE jobs SET state = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated))
}

/// GET /api/jobs/my — jobs posted by the authenticated user
pub async fn my_jobs(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Vec<Job>>> {
    let jobs = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE client_id = $1 ORDER BY created_at DESC"
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(jobs))
}

