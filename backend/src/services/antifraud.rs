use sqlx::PgPool;

use crate::models::Review;

/// Anti-fraud check after a review is created.
/// Flags suspicious patterns and optionally down-weights reviews.
pub async fn check_review(db: &PgPool, review: &Review) -> bool {
    let mut suspicious = false;

    // 1. Collusion check: same reviewer + reviewee appear too often
    let pair_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reviews WHERE reviewer_id = $1 AND reviewee_id = $2"
    )
    .bind(review.reviewer_id)
    .bind(review.reviewee_id)
    .fetch_one(db)
    .await
    .unwrap_or((0,));

    if pair_count.0 > 3 {
        suspicious = true;
        tracing::warn!(
            review_id = %review.id,
            "Collusion signal: reviewer {} and reviewee {} have {} mutual reviews",
            review.reviewer_id, review.reviewee_id, pair_count.0
        );
    }

    // 2. Velocity check: reviewer submitted many reviews in the last hour
    let recent_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reviews WHERE reviewer_id = $1 AND created_at > now() - interval '1 hour'"
    )
    .bind(review.reviewer_id)
    .fetch_one(db)
    .await
    .unwrap_or((0,));

    if recent_count.0 > 5 {
        suspicious = true;
        tracing::warn!(
            review_id = %review.id,
            "Velocity signal: reviewer {} posted {} reviews in the last hour",
            review.reviewer_id, recent_count.0
        );
    }

    // 3. New account check: account age < 24 hours with reviews
    let account: Option<(chrono::DateTime<chrono::Utc>,)> = sqlx::query_as(
        "SELECT created_at FROM users WHERE id = $1"
    )
    .bind(review.reviewer_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    if let Some((created_at,)) = account {
        let age_hours = (chrono::Utc::now() - created_at).num_hours();
        if age_hours < 24 {
            suspicious = true;
            tracing::warn!(
                review_id = %review.id,
                "New account signal: reviewer {} is {} hours old",
                review.reviewer_id, age_hours
            );
        }
    }

    // 4. All-5-star pattern: if last 5 reviews from this reviewer are all 5/5/5
    let perfect_streak: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM (
            SELECT * FROM reviews
            WHERE reviewer_id = $1
            ORDER BY created_at DESC LIMIT 5
        ) r WHERE r.quality = 5 AND r.communication = 5 AND r.timeliness = 5"#,
    )
    .bind(review.reviewer_id)
    .fetch_one(db)
    .await
    .unwrap_or((0,));

    if perfect_streak.0 >= 5 {
        suspicious = true;
        tracing::warn!(
            review_id = %review.id,
            "Perfect-score streak for reviewer {}", review.reviewer_id
        );
    }

    // If suspicious, down-weight the review
    if suspicious {
        let _ = sqlx::query("UPDATE reviews SET weight = 0.3 WHERE id = $1")
            .bind(review.id)
            .execute(db)
            .await;

        // Log suspicious activity
        let _ = sqlx::query(
            r#"INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
               VALUES ($1, 'fraud_flag', 'review', $2, $3)"#,
        )
        .bind(review.reviewer_id)
        .bind(review.id)
        .bind(serde_json::json!({"pair_count": pair_count.0, "velocity": recent_count.0}))
        .execute(db)
        .await;
    }

    suspicious
}

/// Compute suspicious activity score for a user (0-100, higher = more suspicious).
pub async fn suspicious_score(db: &PgPool, user_id: uuid::Uuid) -> f32 {
    let mut score: f32 = 0.0;

    // Fraud flags count
    let flags: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM audit_logs WHERE user_id = $1 AND action = 'fraud_flag'"
    )
    .bind(user_id)
    .fetch_one(db)
    .await
    .unwrap_or((0,));
    score += (flags.0 as f32 * 15.0).min(60.0);

    // Account age factor
    let age: Option<(chrono::DateTime<chrono::Utc>,)> = sqlx::query_as(
        "SELECT created_at FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    if let Some((created_at,)) = age {
        let days = (chrono::Utc::now() - created_at).num_days();
        if days < 7 {
            score += 20.0;
        } else if days < 30 {
            score += 10.0;
        }
    }

    // Dispute ratio
    let disputes: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM disputes WHERE initiator_id = $1"
    )
    .bind(user_id)
    .fetch_one(db)
    .await
    .unwrap_or((0,));

    score += (disputes.0 as f32 * 5.0).min(20.0);

    score.min(100.0)
}

