use axum::{extract::Path, extract::State, Json};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::services::antifraud;
use crate::AppState;

/// POST /api/reviews — create a review (two-sided: client or agent)
pub async fn create_review(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<CreateReviewReq>,
) -> AppResult<Json<Review>> {
    // Validate ratings
    for r in [body.quality, body.communication, body.timeliness] {
        if !(1..=5).contains(&r) {
            return Err(AppError::BadRequest("Ratings must be 1-5".into()));
        }
    }
    if body.comment.len() < 20 {
        return Err(AppError::BadRequest("Comment must be at least 20 characters".into()));
    }

    // Find contract
    let contract = sqlx::query_as::<_, Contract>(
        "SELECT * FROM contracts WHERE id = $1"
    )
    .bind(body.contract_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Contract not found".into()))?;

    if contract.status != "completed" {
        return Err(AppError::BadRequest("Can only review completed contracts".into()));
    }

    // Verify escrow was funded
    let escrow = sqlx::query_as::<_, EscrowAccount>(
        "SELECT * FROM escrow_accounts WHERE contract_id = $1"
    )
    .bind(contract.id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(e) = &escrow {
        if e.state == "none" {
            return Err(AppError::BadRequest("Cannot review: escrow was never funded".into()));
        }
    }

    // Determine reviewer role
    let (reviewer_role, reviewee_id) = if claims.sub == contract.client_id {
        // Agent's owner_id lookup for reviewee
        let agent = sqlx::query_as::<_, Agent>(
            "SELECT * FROM agents WHERE id = $1"
        )
        .bind(contract.agent_id)
        .fetch_one(&state.db)
        .await?;
        ("client", agent.owner_id)
    } else {
        // Check if user owns the agent
        let agent = sqlx::query_as::<_, Agent>(
            "SELECT * FROM agents WHERE id = $1 AND owner_id = $2"
        )
        .bind(contract.agent_id)
        .bind(claims.sub)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Forbidden("You are not a party to this contract".into()))?;
        let _ = agent;
        ("agent", contract.client_id)
    };

    // One review per side per contract
    let existing = sqlx::query_as::<_, Review>(
        "SELECT * FROM reviews WHERE contract_id = $1 AND reviewer_role = $2"
    )
    .bind(body.contract_id)
    .bind(reviewer_role)
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::Conflict("You already reviewed this contract".into()));
    }

    let review = sqlx::query_as::<_, Review>(
        r#"INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, reviewer_role,
           quality, communication, timeliness, requirements_clarity,
           would_work_again, comment, proof_links)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *"#,
    )
    .bind(body.contract_id)
    .bind(claims.sub)
    .bind(reviewee_id)
    .bind(reviewer_role)
    .bind(body.quality)
    .bind(body.communication)
    .bind(body.timeliness)
    .bind(body.requirements_clarity)
    .bind(body.would_work_again)
    .bind(&body.comment)
    .bind(&body.proof_links.clone().unwrap_or_default())
    .fetch_one(&state.db)
    .await?;

    // Run anti-fraud check
    let _ = antifraud::check_review(&state.db, &review).await;

    // Create reputation event
    let avg = (body.quality + body.communication + body.timeliness) as f32 / 3.0;
    let delta = (avg - 3.0) * 2.0; // +/- up to 4 points
    sqlx::query(
        r#"INSERT INTO reputation_events (user_id, agent_id, event_type, score_delta, metadata)
           VALUES ($1, $2, 'review_received', $3, $4)"#,
    )
    .bind(reviewee_id)
    .bind(if reviewer_role == "client" { Some(contract.agent_id) } else { None::<Uuid> })
    .bind(delta)
    .bind(serde_json::json!({"review_id": review.id, "reviewer_role": reviewer_role}))
    .execute(&state.db)
    .await?;

    Ok(Json(review))
}

/// GET /api/reviews/contract/:contract_id
pub async fn get_contract_reviews(
    State(state): State<AppState>,
    Path(contract_id): Path<Uuid>,
) -> AppResult<Json<Vec<Review>>> {
    let reviews = sqlx::query_as::<_, Review>(
        "SELECT * FROM reviews WHERE contract_id = $1 AND is_hidden = false"
    )
    .bind(contract_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(reviews))
}

/// GET /api/reviews/agent/:agent_id
pub async fn get_agent_reviews(
    State(state): State<AppState>,
    Path(agent_id): Path<Uuid>,
) -> AppResult<Json<Vec<Review>>> {
    let reviews = sqlx::query_as::<_, Review>(
        r#"SELECT r.* FROM reviews r
           JOIN contracts c ON r.contract_id = c.id
           WHERE c.agent_id = $1 AND r.reviewer_role = 'client' AND r.is_hidden = false
           ORDER BY r.created_at DESC"#,
    )
    .bind(agent_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(reviews))
}



