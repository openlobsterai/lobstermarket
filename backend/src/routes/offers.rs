use axum::{extract::Path, extract::State, Json};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::AppState;

/// POST /api/offers — submit an offer on a job
pub async fn create_offer(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<CreateOfferReq>,
) -> AppResult<Json<Offer>> {
    // Verify agent belongs to user
    let agent = sqlx::query_as::<_, Agent>(
        "SELECT * FROM agents WHERE id = $1 AND owner_id = $2"
    )
    .bind(body.agent_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Forbidden("Agent does not belong to you".into()))?;

    if agent.status != "active" {
        return Err(AppError::BadRequest("Agent is not active".into()));
    }

    // Verify job is open
    let job = sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE id = $1")
        .bind(body.job_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".into()))?;

    if job.state != "open" {
        return Err(AppError::BadRequest("Job is not accepting offers".into()));
    }

    // Check duplicate offer
    let existing = sqlx::query_as::<_, Offer>(
        "SELECT * FROM offers WHERE job_id = $1 AND agent_id = $2 AND status = 'pending'"
    )
    .bind(body.job_id)
    .bind(body.agent_id)
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::Conflict("You already have a pending offer on this job".into()));
    }

    let offer = sqlx::query_as::<_, Offer>(
        r#"INSERT INTO offers (job_id, agent_id, proposed_price_lamports, estimated_duration_hours, pitch)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *"#,
    )
    .bind(body.job_id)
    .bind(body.agent_id)
    .bind(body.proposed_price_lamports)
    .bind(body.estimated_duration_hours)
    .bind(&body.pitch)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(offer))
}

/// GET /api/offers/job/:job_id — list offers for a job
pub async fn list_job_offers(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> AppResult<Json<Vec<Offer>>> {
    let offers = sqlx::query_as::<_, Offer>(
        "SELECT * FROM offers WHERE job_id = $1 ORDER BY created_at ASC"
    )
    .bind(job_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(offers))
}

/// POST /api/offers/:id/accept — accept an offer, create contract + escrow
pub async fn accept_offer(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(offer_id): Path<Uuid>,
) -> AppResult<Json<Contract>> {
    let offer = sqlx::query_as::<_, Offer>("SELECT * FROM offers WHERE id = $1")
        .bind(offer_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Offer not found".into()))?;

    // Verify caller owns the job
    let job = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE id = $1 AND client_id = $2"
    )
    .bind(offer.job_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Forbidden("Not your job".into()))?;

    if job.state != "open" {
        return Err(AppError::BadRequest("Job is not in open state".into()));
    }

    // Accept the offer, reject others
    sqlx::query("UPDATE offers SET status = 'accepted', updated_at = now() WHERE id = $1")
        .bind(offer_id)
        .execute(&state.db)
        .await?;

    sqlx::query("UPDATE offers SET status = 'rejected', updated_at = now() WHERE job_id = $1 AND id != $2 AND status = 'pending'")
        .bind(offer.job_id)
        .bind(offer_id)
        .execute(&state.db)
        .await?;

    // Update job state
    sqlx::query("UPDATE jobs SET state = 'matched', updated_at = now() WHERE id = $1")
        .bind(offer.job_id)
        .execute(&state.db)
        .await?;

    // Create contract
    let price = offer.proposed_price_lamports.unwrap_or(0);
    let contract = sqlx::query_as::<_, Contract>(
        r#"INSERT INTO contracts (job_id, offer_id, agent_id, client_id, agreed_price_lamports)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *"#,
    )
    .bind(offer.job_id)
    .bind(offer_id)
    .bind(offer.agent_id)
    .bind(claims.sub)
    .bind(price)
    .fetch_one(&state.db)
    .await?;

    // Create escrow account
    sqlx::query(
        "INSERT INTO escrow_accounts (contract_id, amount_lamports) VALUES ($1, $2)"
    )
    .bind(contract.id)
    .bind(price)
    .execute(&state.db)
    .await?;

    Ok(Json(contract))
}

/// POST /api/offers/:id/withdraw — withdraw your own offer
pub async fn withdraw_offer(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(offer_id): Path<Uuid>,
) -> AppResult<Json<Offer>> {
    let offer = sqlx::query_as::<_, Offer>("SELECT * FROM offers WHERE id = $1")
        .bind(offer_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Offer not found".into()))?;

    // Verify agent belongs to user
    let _agent = sqlx::query_as::<_, Agent>(
        "SELECT * FROM agents WHERE id = $1 AND owner_id = $2"
    )
    .bind(offer.agent_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Forbidden("Not your offer".into()))?;

    if offer.status != "pending" {
        return Err(AppError::BadRequest("Can only withdraw pending offers".into()));
    }

    let updated = sqlx::query_as::<_, Offer>(
        "UPDATE offers SET status = 'withdrawn', updated_at = now() WHERE id = $1 RETURNING *"
    )
    .bind(offer_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated))
}

