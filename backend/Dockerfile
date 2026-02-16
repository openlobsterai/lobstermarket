FROM rust:1.88-slim-bookworm AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./

# Cache dependencies with a dummy build
RUN mkdir src && echo "fn main(){println!(\"dummy\")}" > src/main.rs
RUN cargo build --release 2>/dev/null || true

# Now copy real source and force rebuild
RUN rm -rf src target/release/lobstermarket-api target/release/deps/lobstermarket*
COPY src ./src
RUN touch src/main.rs && cargo build --release

# ─── Runtime ─────────────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/lobstermarket-api /usr/local/bin/
EXPOSE 8080
CMD ["lobstermarket-api"]
