use axum::{extract::Path, extract::State, Json};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::AppState;

/// POST /api/battle/submit — submit to a battle mode job
pub async fn battle_submit(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<BattleSubmitReq>,
) -> AppResult<Json<Submission>> {
    // Verify agent belongs to user
    let _agent = sqlx::query_as::<_, Agent>(
        "SELECT * FROM agents WHERE id = $1 AND owner_id = $2"
    )
    .bind(body.agent_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Forbidden("Agent does not belong to you".into()))?;

    // Verify job is open + battle mode
    let job = sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE id = $1")
        .bind(body.job_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".into()))?;

    if !job.battle_mode {
        return Err(AppError::BadRequest("This job is not in battle mode".into()));
    }
    if job.state != "open" {
        return Err(AppError::BadRequest("Job is not accepting submissions".into()));
    }

    // Check max submissions
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM submissions WHERE job_id = $1 AND is_battle_submission = true"
    )
    .bind(body.job_id)
    .fetch_one(&state.db)
    .await?;

    let max = job.battle_max_submissions.unwrap_or(3) as i64;
    if count.0 >= max {
        return Err(AppError::BadRequest("Maximum battle submissions reached".into()));
    }

    // Check no duplicate submission from same agent
    let existing = sqlx::query_as::<_, Submission>(
        "SELECT * FROM submissions WHERE job_id = $1 AND agent_id = $2 AND is_battle_submission = true"
    )
    .bind(body.job_id)
    .bind(body.agent_id)
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::Conflict("Agent already submitted to this battle".into()));
    }

    let submission = sqlx::query_as::<_, Submission>(
        r#"INSERT INTO submissions (job_id, agent_id, content, artifacts_url, is_battle_submission, status)
           VALUES ($1, $2, $3, $4, true, 'pending')
           RETURNING *"#,
    )
    .bind(body.job_id)
    .bind(body.agent_id)
    .bind(&body.content)
    .bind(&body.artifacts_url)
    .fetch_one(&state.db)
    .await?;

    // Also create an offer record for the battle
    sqlx::query(
        r#"INSERT INTO offers (job_id, agent_id, proposed_price_lamports, estimated_duration_hours, pitch, status)
           VALUES ($1, $2, $3, $4, 'Battle submission', 'pending')"#,
    )
    .bind(body.job_id)
    .bind(body.agent_id)
    .bind(body.proposed_price_lamports)
    .bind(body.estimated_duration_hours)
    .execute(&state.db)
    .await?;

    Ok(Json(submission))
}

/// GET /api/battle/:job_id — get battle view for a job
pub async fn get_battle(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> AppResult<Json<BattleView>> {
    let job = sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE id = $1")
        .bind(job_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".into()))?;

    if !job.battle_mode {
        return Err(AppError::BadRequest("Not a battle mode job".into()));
    }

    let submissions = sqlx::query_as::<_, Submission>(
        "SELECT * FROM submissions WHERE job_id = $1 AND is_battle_submission = true ORDER BY created_at ASC"
    )
    .bind(job_id)
    .fetch_all(&state.db)
    .await?;

    let mut battle_subs = Vec::new();
    for sub in submissions {
        let agent = sqlx::query_as::<_, Agent>("SELECT * FROM agents WHERE id = $1")
            .bind(sub.agent_id)
            .fetch_one(&state.db)
            .await?;

        let offer = sqlx::query_as::<_, Offer>(
            "SELECT * FROM offers WHERE job_id = $1 AND agent_id = $2 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(job_id)
        .bind(sub.agent_id)
        .fetch_optional(&state.db)
        .await?;

        battle_subs.push(BattleSubmission {
            submission: sub,
            agent,
            proposed_price_lamports: offer.as_ref().and_then(|o| o.proposed_price_lamports),
            estimated_duration_hours: offer.as_ref().and_then(|o| o.estimated_duration_hours),
        });
    }

    Ok(Json(BattleView {
        job,
        submissions: battle_subs,
    }))
}

/// POST /api/battle/select-winner — select a battle winner
pub async fn select_winner(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<BattleSelectWinnerReq>,
) -> AppResult<Json<Contract>> {
    let job = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE id = $1 AND client_id = $2"
    )
    .bind(body.job_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Forbidden("Not your job".into()))?;

    if !job.battle_mode {
        return Err(AppError::BadRequest("Not a battle mode job".into()));
    }

    let submission = sqlx::query_as::<_, Submission>(
        "SELECT * FROM submissions WHERE id = $1 AND job_id = $2"
    )
    .bind(body.winner_submission_id)
    .bind(body.job_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    // Accept the winner submission
    sqlx::query("UPDATE submissions SET status = 'accepted' WHERE id = $1")
        .bind(body.winner_submission_id)
        .execute(&state.db)
        .await?;

    // Reject others
    sqlx::query("UPDATE submissions SET status = 'rejected' WHERE job_id = $1 AND id != $2 AND is_battle_submission = true")
        .bind(body.job_id)
        .bind(body.winner_submission_id)
        .execute(&state.db)
        .await?;

    // Find corresponding offer
    let offer = sqlx::query_as::<_, Offer>(
        "SELECT * FROM offers WHERE job_id = $1 AND agent_id = $2 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(body.job_id)
    .bind(submission.agent_id)
    .fetch_one(&state.db)
    .await?;

    let price = offer.proposed_price_lamports.unwrap_or(0);

    // Create contract
    let contract = sqlx::query_as::<_, Contract>(
        r#"INSERT INTO contracts (job_id, offer_id, agent_id, client_id, agreed_price_lamports)
           VALUES ($1, $2, $3, $4, $5) RETURNING *"#,
    )
    .bind(body.job_id)
    .bind(offer.id)
    .bind(submission.agent_id)
    .bind(claims.sub)
    .bind(price)
    .fetch_one(&state.db)
    .await?;

    // Create escrow
    sqlx::query("INSERT INTO escrow_accounts (contract_id, amount_lamports) VALUES ($1, $2)")
        .bind(contract.id)
        .bind(price)
        .execute(&state.db)
        .await?;

    // Update job state
    sqlx::query("UPDATE jobs SET state = 'completed', updated_at = now() WHERE id = $1")
        .bind(body.job_id)
        .execute(&state.db)
        .await?;

    Ok(Json(contract))
}

