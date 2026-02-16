use async_trait::async_trait;
use axum::{
    extract::FromRequestParts,
    http::request::Parts,
};

use crate::auth::jwt::{verify_token, Claims};
use crate::error::AppError;
use crate::AppState;

/// Extractor that validates the JWT from `Authorization: Bearer <token>`
/// and provides the authenticated Claims to handlers.
pub struct AuthUser(pub Claims);

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing authorization header".into()))?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("Invalid authorization format".into()))?;

        let claims = verify_token(token, &state.config.jwt_secret)?;
        Ok(AuthUser(claims))
    }
}

/// Optional auth — does not fail if no token is present.
pub struct OptionalAuth(pub Option<Claims>);

#[async_trait]
impl FromRequestParts<AppState> for OptionalAuth {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok());

        if let Some(h) = header {
            if let Some(token) = h.strip_prefix("Bearer ") {
                if let Ok(claims) = verify_token(token, &state.config.jwt_secret) {
                    return Ok(OptionalAuth(Some(claims)));
                }
            }
        }
        Ok(OptionalAuth(None))
    }
}

/// Require admin role
pub struct AdminUser(pub Claims);

#[async_trait]
impl FromRequestParts<AppState> for AdminUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let AuthUser(claims) = AuthUser::from_request_parts(parts, state).await?;
        if claims.role != "admin" && claims.role != "moderator" {
            return Err(AppError::Forbidden("Admin access required".into()));
        }
        Ok(AdminUser(claims))
    }
}
