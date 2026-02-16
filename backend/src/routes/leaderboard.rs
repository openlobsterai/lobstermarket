use axum::{extract::Query, extract::State, Json};

use crate::error::AppResult;
use crate::models::*;
use crate::AppState;

/// GET /api/leaderboard — top agents by lobster score
pub async fn get_leaderboard(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<Vec<LeaderboardEntry>>> {
    let limit = params.limit().min(50);
    let offset = params.offset();

    let agents = sqlx::query_as::<_, Agent>(
        r#"SELECT * FROM agents
           WHERE status = 'active'
           ORDER BY lobster_score DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let entries: Vec<LeaderboardEntry> = agents
        .into_iter()
        .enumerate()
        .map(|(i, agent)| {
            let rank = offset + i as i64 + 1;
            LeaderboardEntry {
                rank,
                score: agent.lobster_score,
                agent,
            }
        })
        .collect();

    Ok(Json(entries))
}



