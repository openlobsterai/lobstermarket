use axum::{extract::State, Json};

use crate::auth::middleware::AdminUser;
use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::AppState;

/// POST /api/admin/moderate-review — hide or adjust weight of a review
pub async fn moderate_review(
    State(state): State<AppState>,
    AdminUser(claims): AdminUser,
    Json(body): Json<AdminModerateReviewReq>,
) -> AppResult<Json<Review>> {
    let review = sqlx::query_as::<_, Review>("SELECT * FROM reviews WHERE id = $1")
        .bind(body.review_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Review not found".into()))?;

    let is_hidden = body.is_hidden.unwrap_or(review.is_hidden);
    let weight = body.weight.unwrap_or(review.weight);

    let updated = sqlx::query_as::<_, Review>(
        "UPDATE reviews SET is_hidden = $1, weight = $2 WHERE id = $3 RETURNING *"
    )
    .bind(is_hidden)
    .bind(weight)
    .bind(body.review_id)
    .fetch_one(&state.db)
    .await?;

    sqlx::query(
        r#"INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'moderate_review', 'review', $2, $3)"#,
    )
    .bind(claims.sub)
    .bind(body.review_id)
    .bind(serde_json::json!({"is_hidden": is_hidden, "weight": weight}))
    .execute(&state.db)
    .await?;

    Ok(Json(updated))
}

/// POST /api/admin/suspend-user — suspend or unsuspend a user
pub async fn suspend_user(
    State(state): State<AppState>,
    AdminUser(claims): AdminUser,
    Json(body): Json<AdminSuspendReq>,
) -> AppResult<Json<User>> {
    let updated = sqlx::query_as::<_, User>(
        "UPDATE users SET is_suspended = $1, updated_at = now() WHERE id = $2 RETURNING *"
    )
    .bind(body.suspended)
    .bind(body.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    sqlx::query(
        r#"INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'suspend_user', 'user', $2, $3)"#,
    )
    .bind(claims.sub)
    .bind(body.user_id)
    .bind(serde_json::json!({"suspended": body.suspended}))
    .execute(&state.db)
    .await?;

    Ok(Json(updated))
}

/// GET /api/admin/audit-logs — recent audit logs
pub async fn get_audit_logs(
    State(state): State<AppState>,
    AdminUser(_claims): AdminUser,
) -> AppResult<Json<Vec<AuditLog>>> {
    let logs = sqlx::query_as::<_, AuditLog>(
        "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(logs))
}

/// GET /api/admin/disputes — all open disputes
pub async fn get_disputes(
    State(state): State<AppState>,
    AdminUser(_claims): AdminUser,
) -> AppResult<Json<Vec<Dispute>>> {
    let disputes = sqlx::query_as::<_, Dispute>(
        "SELECT * FROM disputes WHERE status IN ('open', 'under_review') ORDER BY created_at ASC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(disputes))
}



