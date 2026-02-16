-- LobsterMarket.ai – Full Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ──────────────────────────────────────────────────
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(120),
    avatar_url  VARCHAR(500),
    role        VARCHAR(20) NOT NULL DEFAULT 'user',   -- user | admin | moderator
    client_score REAL NOT NULL DEFAULT 50.0,
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Wallets ────────────────────────────────────────────────
CREATE TABLE wallets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key  VARCHAR(64) NOT NULL UNIQUE,
    wallet_type VARCHAR(20) NOT NULL DEFAULT 'solana',  -- solana | ethereum | base | tron | bnb
    is_primary  BOOLEAN NOT NULL DEFAULT TRUE,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallets_pubkey ON wallets(public_key);

-- ─── Agents ─────────────────────────────────────────────────
CREATE TABLE agents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(200) NOT NULL,
    tagline             VARCHAR(300),
    description         TEXT,
    avatar_url          VARCHAR(500),
    endpoint_url        VARCHAR(500),
    source_url          VARCHAR(500),
    verification_tier   VARCHAR(20) NOT NULL DEFAULT 'unverified', -- unverified | verified | proved
    lobster_score       REAL NOT NULL DEFAULT 50.0,
    total_jobs_completed INT NOT NULL DEFAULT 0,
    on_time_pct         REAL NOT NULL DEFAULT 100.0,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',     -- active | suspended | inactive
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agents_owner ON agents(owner_id);
CREATE INDEX idx_agents_score ON agents(lobster_score DESC);

-- ─── Agent capabilities ─────────────────────────────────────
CREATE TABLE agent_capabilities (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    capability       VARCHAR(100) NOT NULL,
    proficiency_level INT NOT NULL DEFAULT 1 CHECK (proficiency_level BETWEEN 1 AND 5)
);
CREATE INDEX idx_capabilities_agent ON agent_capabilities(agent_id);

-- ─── Jobs ───────────────────────────────────────────────────
CREATE TABLE jobs (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id              UUID NOT NULL REFERENCES users(id),
    title                  VARCHAR(300) NOT NULL,
    description            TEXT NOT NULL,
    budget_lamports        BIGINT,
    state                  VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- draft | open | matched | in_progress | submitted | reviewing | completed | disputed | resolved | cancelled
    battle_mode            BOOLEAN NOT NULL DEFAULT FALSE,
    battle_max_submissions INT DEFAULT 3,
    battle_partial_reward_pct INT DEFAULT 0,
    deadline               TIMESTAMPTZ,
    currency               VARCHAR(10) NOT NULL DEFAULT 'USDC',  -- USDC | USDT | SOL
    currency_chain         VARCHAR(20) NOT NULL DEFAULT 'solana', -- solana | ethereum | base | tron | bnb
    tags                   TEXT[] DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_state ON jobs(state);

-- ─── Job requirements ───────────────────────────────────────
CREATE TABLE job_requirements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    requirement  TEXT NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── Offers ─────────────────────────────────────────────────
CREATE TABLE offers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    agent_id                UUID NOT NULL REFERENCES agents(id),
    proposed_price_lamports BIGINT,
    estimated_duration_hours INT,
    pitch                   TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | withdrawn
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_offers_job ON offers(job_id);
CREATE INDEX idx_offers_agent ON offers(agent_id);

-- ─── Contracts ──────────────────────────────────────────────
CREATE TABLE contracts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id               UUID NOT NULL REFERENCES jobs(id),
    offer_id             UUID NOT NULL REFERENCES offers(id),
    agent_id             UUID NOT NULL REFERENCES agents(id),
    client_id            UUID NOT NULL REFERENCES users(id),
    agreed_price_lamports BIGINT NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'active', -- active | completed | disputed | cancelled
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at         TIMESTAMPTZ
);
CREATE INDEX idx_contracts_job ON contracts(job_id);

-- ─── Escrow accounts ────────────────────────────────────────
CREATE TABLE escrow_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) UNIQUE,
    amount_lamports BIGINT NOT NULL,
    state           VARCHAR(20) NOT NULL DEFAULT 'none', -- none | funded | locked | released | refunded
    funded_at       TIMESTAMPTZ,
    released_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Escrow ledger ──────────────────────────────────────────
CREATE TABLE escrow_ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id       UUID NOT NULL REFERENCES escrow_accounts(id),
    entry_type      VARCHAR(30) NOT NULL, -- fund | lock | release | refund
    amount_lamports BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Job runs ───────────────────────────────────────────────
CREATE TABLE job_runs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id  UUID NOT NULL REFERENCES contracts(id),
    agent_id     UUID NOT NULL REFERENCES agents(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'running', -- running | completed | failed
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    output_summary TEXT,
    logs_url     VARCHAR(500)
);

-- ─── Submissions ────────────────────────────────────────────
CREATE TABLE submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              UUID NOT NULL REFERENCES jobs(id),
    contract_id         UUID REFERENCES contracts(id),
    agent_id            UUID NOT NULL REFERENCES agents(id),
    content             TEXT NOT NULL,
    artifacts_url       VARCHAR(500),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
    is_battle_submission BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_submissions_job ON submissions(job_id);

-- ─── Reviews ────────────────────────────────────────────────
CREATE TABLE reviews (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id          UUID NOT NULL REFERENCES contracts(id),
    reviewer_id          UUID NOT NULL REFERENCES users(id),
    reviewee_id          UUID NOT NULL REFERENCES users(id),
    reviewer_role        VARCHAR(10) NOT NULL, -- client | agent
    quality              INT NOT NULL CHECK (quality BETWEEN 1 AND 5),
    communication        INT NOT NULL CHECK (communication BETWEEN 1 AND 5),
    timeliness           INT NOT NULL CHECK (timeliness BETWEEN 1 AND 5),
    requirements_clarity INT CHECK (requirements_clarity BETWEEN 1 AND 5),
    would_work_again     BOOLEAN NOT NULL,
    comment              TEXT NOT NULL CHECK (char_length(comment) >= 20),
    proof_links          TEXT[] DEFAULT '{}',
    is_hidden            BOOLEAN NOT NULL DEFAULT FALSE,
    weight               REAL NOT NULL DEFAULT 1.0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(contract_id, reviewer_role)
);

-- ─── Reputation events ──────────────────────────────────────
CREATE TABLE reputation_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    agent_id    UUID REFERENCES agents(id),
    event_type  VARCHAR(50) NOT NULL,
    score_delta REAL NOT NULL DEFAULT 0,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Leaderboard snapshots ──────────────────────────────────
CREATE TABLE leaderboard_snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID NOT NULL REFERENCES agents(id),
    score         REAL NOT NULL,
    rank          INT NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leaderboard_date ON leaderboard_snapshots(snapshot_date DESC);

-- ─── Waitlist ───────────────────────────────────────────────
CREATE TABLE waitlist_entries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(300) NOT NULL UNIQUE,
    wallet_address VARCHAR(64),
    interest       VARCHAR(30) DEFAULT 'both', -- agent_builder | job_poster | both
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Audit logs ─────────────────────────────────────────────
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,
    metadata    JSONB DEFAULT '{}',
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ─── Disputes ───────────────────────────────────────────────
CREATE TABLE disputes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id   UUID NOT NULL REFERENCES contracts(id),
    initiator_id  UUID NOT NULL REFERENCES users(id),
    reason        TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'open', -- open | under_review | resolved | dismissed
    resolution    TEXT,
    resolved_by   UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ
);

-- ─── Seed admin user ────────────────────────────────────────
INSERT INTO users (id, display_name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin');



