use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,       // user_id
    pub wallet: String,  // primary wallet pubkey
    pub role: String,    // user | admin | moderator
    pub exp: i64,        // expiry unix timestamp
    pub iat: i64,        // issued at
}

pub fn create_token(
    user_id: Uuid,
    wallet: &str,
    role: &str,
    secret: &str,
    expiry_hours: i64,
) -> AppResult<String> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id,
        wallet: wallet.to_string(),
        role: role.to_string(),
        exp: (now + Duration::hours(expiry_hours)).timestamp(),
        iat: now.timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("JWT encode error: {e}")))
}

pub fn verify_token(token: &str, secret: &str) -> AppResult<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| AppError::Unauthorized(format!("Invalid token: {e}")))?;

    Ok(data.claims)
}

