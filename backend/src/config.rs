use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub api_host: String,
    pub api_port: u16,
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,
    pub nonce_ttl_seconds: u64,
    pub domain: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://lobster:lobster@localhost:5432/lobstermarket".into()),
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into()),
            api_host: env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            api_port: env::var("API_PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()
                .expect("API_PORT must be a number"),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-me".into()),
            jwt_expiry_hours: env::var("JWT_EXPIRY_HOURS")
                .unwrap_or_else(|_| "72".into())
                .parse()
                .expect("JWT_EXPIRY_HOURS must be a number"),
            nonce_ttl_seconds: env::var("NONCE_TTL_SECONDS")
                .unwrap_or_else(|_| "300".into())
                .parse()
                .expect("NONCE_TTL_SECONDS must be a number"),
            domain: env::var("DOMAIN").unwrap_or_else(|_| "localhost".into()),
        }
    }
}

