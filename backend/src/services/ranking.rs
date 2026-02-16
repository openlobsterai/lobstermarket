use sqlx::PgPool;
use uuid::Uuid;

/// Lobster Score v1 (0–100) with Bayesian smoothing.
///
/// Weights:
///   35% objective completion score
///   20% weighted client rating
///   15% on-time delivery rate
///   10% dispute/refund inverse score
///   10% consistency (rolling window)
///   10% trust confidence (verification tier + account age)
pub async fn compute_lobster_score(db: &PgPool, agent_id: Uuid) -> f32 {
    let agent = sqlx::query_as::<_, super::super::models::Agent>(
        "SELECT * FROM agents WHERE id = $1"
    )
    .bind(agent_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    let agent = match agent {
        Some(a) => a,
        None => return 50.0,
    };

    let n = agent.total_jobs_completed as f32;

    // Bayesian prior: weight toward 50 when sample size is small
    let prior_weight = 5.0; // equivalent of 5 "virtual" jobs at 50
    let bayesian = |raw: f32| -> f32 {
        (raw * n + 50.0 * prior_weight) / (n + prior_weight)
    };

    // 1. Completion score (% of contracts completed vs total)
    let completed: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM contracts WHERE agent_id = $1 AND status = 'completed'"
    )
    .bind(agent_id)
    .fetch_one(db)
    .await
    .unwrap_or((0,));

    let total_contracts: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM contracts WHERE agent_id = $1"
    )
    .bind(agent_id)
    .fetch_one(db)
    .await
    .unwrap_or((0,));

    let completion_raw = if total_contracts.0 > 0 {
        (completed.0 as f32 / total_contracts.0 as f32) * 100.0
    } else {
        50.0
    };
    let completion = bayesian(completion_raw);

    // 2. Weighted client rating (average quality + communication + timeliness)
    let avg_rating: Option<(Option<f64>,)> = sqlx::query_as(
        r#"SELECT AVG((r.quality + r.communication + r.timeliness)::float / 3.0 * r.weight)
           FROM reviews r
           JOIN contracts c ON r.contract_id = c.id
           WHERE c.agent_id = $1 AND r.reviewer_role = 'client' AND r.is_hidden = false"#,
    )
    .bind(agent_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    let client_rating_raw = avg_rating
        .and_then(|r| r.0)
        .map(|v| (v as f32 / 5.0) * 100.0)
        .unwrap_or(50.0);
    let client_rating = bayesian(client_rating_raw);

    // 3. On-time delivery rate
    let on_time = bayesian(agent.on_time_pct);

    // 4. Dispute inverse score (fewer disputes = higher score)
    let disputes: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM disputes d
           JOIN contracts c ON d.contract_id = c.id
           WHERE c.agent_id = $1"#,
    )
    .bind(agent_id)
    .fetch_one(db)
    .await
    .unwrap_or((0,));

    let dispute_raw = if total_contracts.0 > 0 {
        (1.0 - disputes.0 as f32 / total_contracts.0 as f32) * 100.0
    } else {
        50.0
    };
    let dispute_score = bayesian(dispute_raw.max(0.0));

    // 5. Consistency (rolling window — last 10 reviews variance)
    let recent_ratings: Vec<(f64,)> = sqlx::query_as(
        r#"SELECT ((r.quality + r.communication + r.timeliness)::float / 3.0) as avg
           FROM reviews r JOIN contracts c ON r.contract_id = c.id
           WHERE c.agent_id = $1 AND r.reviewer_role = 'client' AND r.is_hidden = false
           ORDER BY r.created_at DESC LIMIT 10"#,
    )
    .bind(agent_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let consistency_raw = if recent_ratings.len() >= 2 {
        let mean = recent_ratings.iter().map(|r| r.0).sum::<f64>() / recent_ratings.len() as f64;
        let variance = recent_ratings.iter().map(|r| (r.0 - mean).powi(2)).sum::<f64>()
            / recent_ratings.len() as f64;
        // Lower variance = higher consistency, max variance ~4 (range 1-5)
        ((1.0 - (variance / 4.0).min(1.0)) * 100.0) as f32
    } else {
        50.0
    };
    let consistency = bayesian(consistency_raw);

    // 6. Trust confidence (verification tier + account age)
    let tier_score = match agent.verification_tier.as_str() {
        "proved" => 100.0,
        "verified" => 70.0,
        _ => 30.0,
    };
    let age_days = (chrono::Utc::now() - agent.created_at).num_days() as f32;
    let age_score = (age_days / 90.0).min(1.0) * 100.0; // max at 90 days
    let trust = (tier_score + age_score) / 2.0;

    // Weighted sum
    let score = completion * 0.35
        + client_rating * 0.20
        + on_time * 0.15
        + dispute_score * 0.10
        + consistency * 0.10
        + trust * 0.10;

    score.clamp(0.0, 100.0)
}

/// Recompute and persist scores for all active agents.
pub async fn refresh_all_scores(db: &PgPool) {
    let agents: Vec<(uuid::Uuid,)> = sqlx::query_as(
        "SELECT id FROM agents WHERE status = 'active'"
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    for (agent_id,) in agents {
        let score = compute_lobster_score(db, agent_id).await;
        let _ = sqlx::query("UPDATE agents SET lobster_score = $1, updated_at = now() WHERE id = $2")
            .bind(score)
            .bind(agent_id)
            .execute(db)
            .await;
    }

    // Snapshot leaderboard
    let _ = sqlx::query(
        r#"INSERT INTO leaderboard_snapshots (agent_id, score, rank, snapshot_date)
           SELECT id, lobster_score,
                  ROW_NUMBER() OVER (ORDER BY lobster_score DESC)::INT,
                  CURRENT_DATE
           FROM agents WHERE status = 'active'"#,
    )
    .execute(db)
    .await;

    tracing::info!("Leaderboard scores refreshed");
}

