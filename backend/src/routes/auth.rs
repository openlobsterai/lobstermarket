use axum::{extract::Query, extract::State, Json};
use chrono::{Duration, Utc};
use rand::Rng;
use redis::AsyncCommands;
use serde::Deserialize;

use crate::auth::wallet::{build_sign_message, verify_solana_signature};
use crate::auth::jwt::create_token;
use crate::error::{AppError, AppResult};
use crate::models::{AuthResponse, NonceResponse, User, VerifyWalletReq};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct NonceQuery {
    pub wallet: String,
}

/// GET /api/auth/nonce?wallet=<pubkey>
pub async fn get_nonce(
    State(state): State<AppState>,
    Query(q): Query<NonceQuery>,
) -> AppResult<Json<NonceResponse>> {
    let nonce: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    let message = build_sign_message(&state.config.domain, &nonce, &q.wallet);
    let ttl = state.config.nonce_ttl_seconds;
    let key = format!("nonce:{}", q.wallet);

    let mut conn = state.redis.get_multiplexed_async_connection().await
        .map_err(|e| AppError::Internal(format!("Redis connection error: {e}")))?;

    conn.set_ex::<_, _, ()>(&key, &nonce, ttl).await
        .map_err(|e| AppError::Internal(format!("Redis set error: {e}")))?;

    Ok(Json(NonceResponse {
        nonce,
        message,
        expires_at: Utc::now() + Duration::seconds(ttl as i64),
    }))
}

/// POST /api/auth/verify
pub async fn verify_wallet(
    State(state): State<AppState>,
    Json(body): Json<VerifyWalletReq>,
) -> AppResult<Json<AuthResponse>> {
    // 1. Retrieve and consume nonce from Redis
    let key = format!("nonce:{}", body.wallet);
    let mut conn = state.redis.get_multiplexed_async_connection().await
        .map_err(|e| AppError::Internal(format!("Redis connection error: {e}")))?;

    let stored_nonce: Option<String> = conn.get(&key).await
        .map_err(|e| AppError::Internal(format!("Redis get error: {e}")))?;

    let stored_nonce = stored_nonce
        .ok_or_else(|| AppError::Unauthorized("Nonce expired or not found".into()))?;

    // Delete nonce so it can't be reused
    let _: () = conn.del(&key).await.unwrap_or(());

    // 2. Rebuild expected message and verify it matches
    let expected_message = build_sign_message(&state.config.domain, &stored_nonce, &body.wallet);
    if body.message != expected_message {
        return Err(AppError::BadRequest("Message mismatch".into()));
    }

    // 3. Verify Ed25519 signature
    verify_solana_signature(&body.wallet, &body.signature, &body.message)?;

    // 4. Find or create user + wallet
    let existing_wallet = sqlx::query_as::<_, crate::models::Wallet>(
        "SELECT * FROM wallets WHERE public_key = $1"
    )
    .bind(&body.wallet)
    .fetch_optional(&state.db)
    .await?;

    let user = if let Some(w) = existing_wallet {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(w.user_id)
            .fetch_one(&state.db)
            .await?
    } else {
        // Create new user + wallet
        let user = sqlx::query_as::<_, User>(
            "INSERT INTO users (display_name) VALUES ($1) RETURNING *"
        )
        .bind(format!("{}…{}", &body.wallet[..4], &body.wallet[body.wallet.len()-4..]))
        .fetch_one(&state.db)
        .await?;

        sqlx::query(
            "INSERT INTO wallets (user_id, public_key, verified_at) VALUES ($1, $2, now())"
        )
        .bind(user.id)
        .bind(&body.wallet)
        .execute(&state.db)
        .await?;

        // Audit log
        sqlx::query(
            "INSERT INTO audit_logs (user_id, action, metadata) VALUES ($1, 'user_created', $2)"
        )
        .bind(user.id)
        .bind(serde_json::json!({"wallet": &body.wallet}))
        .execute(&state.db)
        .await?;

        user
    };

    // 5. Check suspension
    if user.is_suspended {
        return Err(AppError::Forbidden("Account is suspended".into()));
    }

    // 6. Issue JWT
    let token = create_token(
        user.id,
        &body.wallet,
        &user.role,
        &state.config.jwt_secret,
        state.config.jwt_expiry_hours,
    )?;

    Ok(Json(AuthResponse { token, user }))
}

