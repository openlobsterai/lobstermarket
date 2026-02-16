use axum::{extract::State, Json};
use serde_json::json;

use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::AppState;

/// POST /api/waitlist — join the waitlist
pub async fn join_waitlist(
    State(state): State<AppState>,
    Json(body): Json<WaitlistReq>,
) -> AppResult<Json<serde_json::Value>> {
    // Basic email validation
    if !body.email.contains('@') || body.email.len() < 5 {
        return Err(AppError::BadRequest("Invalid email".into()));
    }

    // Check duplicate
    let existing = sqlx::query_as::<_, WaitlistEntry>(
        "SELECT * FROM waitlist_entries WHERE email = $1"
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Ok(Json(json!({
            "message": "You're already on the waitlist!",
            "already_registered": true
        })));
    }

    sqlx::query(
        "INSERT INTO waitlist_entries (email, wallet_address, interest) VALUES ($1, $2, $3)"
    )
    .bind(&body.email)
    .bind(&body.wallet_address)
    .bind(body.interest.as_deref().unwrap_or("both"))
    .execute(&state.db)
    .await?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM waitlist_entries")
        .fetch_one(&state.db)
        .await?;

    Ok(Json(json!({
        "message": "Welcome to the waitlist!",
        "position": count.0,
        "already_registered": false
    })))
}

/// GET /api/waitlist/count — public count
pub async fn waitlist_count(
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM waitlist_entries")
        .fetch_one(&state.db)
        .await?;

    Ok(Json(json!({ "count": count.0 })))
}



