use axum::{extract::Path, extract::Query, extract::State, Json};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::AppState;

/// POST /api/favorites — add a favorite
pub async fn add_favorite(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<FavoriteReq>,
) -> AppResult<Json<Favorite>> {
    if body.entity_type != "agent" && body.entity_type != "job" {
        return Err(AppError::BadRequest("entity_type must be 'agent' or 'job'".into()));
    }

    // Check entity exists
    match body.entity_type.as_str() {
        "agent" => {
            sqlx::query("SELECT id FROM agents WHERE id = $1")
                .bind(body.entity_id)
                .fetch_optional(&state.db)
                .await?
                .ok_or_else(|| AppError::NotFound("Agent not found".into()))?;
        }
        "job" => {
            sqlx::query("SELECT id FROM jobs WHERE id = $1")
                .bind(body.entity_id)
                .fetch_optional(&state.db)
                .await?
                .ok_or_else(|| AppError::NotFound("Job not found".into()))?;
        }
        _ => {}
    }

    // Upsert (ignore conflict)
    let fav = sqlx::query_as::<_, Favorite>(
        r#"INSERT INTO favorites (user_id, entity_type, entity_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET created_at = favorites.created_at
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&body.entity_type)
    .bind(body.entity_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(fav))
}

/// DELETE /api/favorites/:entity_type/:entity_id — remove a favorite
pub async fn remove_favorite(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query(
        "DELETE FROM favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3"
    )
    .bind(claims.sub)
    .bind(&entity_type)
    .bind(entity_id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({"removed": true})))
}

/// GET /api/favorites — get all my favorites
pub async fn list_favorites(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Query(filter): Query<FavoritesFilter>,
) -> AppResult<Json<Vec<Favorite>>> {
    let favs = if let Some(et) = &filter.entity_type {
        sqlx::query_as::<_, Favorite>(
            "SELECT * FROM favorites WHERE user_id = $1 AND entity_type = $2 ORDER BY created_at DESC"
        )
        .bind(claims.sub)
        .bind(et)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, Favorite>(
            "SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC"
        )
        .bind(claims.sub)
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(favs))
}

/// GET /api/favorites/agents — get favorite agents with full agent data
pub async fn list_favorite_agents(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Vec<Agent>>> {
    let agents = sqlx::query_as::<_, Agent>(
        r#"SELECT a.* FROM agents a
           JOIN favorites f ON f.entity_id = a.id
           WHERE f.user_id = $1 AND f.entity_type = 'agent'
           ORDER BY f.created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(agents))
}

/// GET /api/favorites/jobs — get favorite jobs with full job data
pub async fn list_favorite_jobs(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Vec<Job>>> {
    let jobs = sqlx::query_as::<_, Job>(
        r#"SELECT j.* FROM jobs j
           JOIN favorites f ON f.entity_id = j.id
           WHERE f.user_id = $1 AND f.entity_type = 'job'
           ORDER BY f.created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(jobs))
}

/// GET /api/favorites/check/:entity_type/:entity_id — check if favorited
pub async fn check_favorite(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let exists = sqlx::query_as::<_, Favorite>(
        "SELECT * FROM favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3"
    )
    .bind(claims.sub)
    .bind(&entity_type)
    .bind(entity_id)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(serde_json::json!({"favorited": exists.is_some()})))
}

#[derive(Debug, Deserialize)]
pub struct FavoritesFilter {
    pub entity_type: Option<String>,
}

