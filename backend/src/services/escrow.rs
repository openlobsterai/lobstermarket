use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::*;

/// Fund an escrow account (none → funded)
pub async fn fund_escrow(db: &PgPool, contract_id: Uuid, user_id: Uuid) -> AppResult<EscrowAccount> {
    let contract = sqlx::query_as::<_, Contract>("SELECT * FROM contracts WHERE id = $1")
        .bind(contract_id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Contract not found".into()))?;

    if contract.client_id != user_id {
        return Err(AppError::Forbidden("Only the client can fund escrow".into()));
    }

    let escrow = sqlx::query_as::<_, EscrowAccount>(
        "SELECT * FROM escrow_accounts WHERE contract_id = $1"
    )
    .bind(contract_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("Escrow account not found".into()))?;

    if escrow.state != "none" {
        return Err(AppError::BadRequest(format!("Escrow is in state '{}', cannot fund", escrow.state)));
    }

    let updated = sqlx::query_as::<_, EscrowAccount>(
        "UPDATE escrow_accounts SET state = 'funded', funded_at = now() WHERE id = $1 RETURNING *"
    )
    .bind(escrow.id)
    .fetch_one(db)
    .await?;

    // Ledger entry
    sqlx::query("INSERT INTO escrow_ledger_entries (escrow_id, entry_type, amount_lamports) VALUES ($1, 'fund', $2)")
        .bind(escrow.id)
        .bind(escrow.amount_lamports)
        .execute(db)
        .await?;

    // Move job to in_progress
    sqlx::query("UPDATE jobs SET state = 'in_progress', updated_at = now() WHERE id = $1")
        .bind(contract.job_id)
        .execute(db)
        .await?;

    Ok(updated)
}

/// Lock escrow (funded → locked) — when work is submitted
pub async fn lock_escrow(db: &PgPool, contract_id: Uuid) -> AppResult<EscrowAccount> {
    let escrow = sqlx::query_as::<_, EscrowAccount>(
        "SELECT * FROM escrow_accounts WHERE contract_id = $1"
    )
    .bind(contract_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("Escrow account not found".into()))?;

    if escrow.state != "funded" {
        return Err(AppError::BadRequest("Escrow must be funded to lock".into()));
    }

    let updated = sqlx::query_as::<_, EscrowAccount>(
        "UPDATE escrow_accounts SET state = 'locked' WHERE id = $1 RETURNING *"
    )
    .bind(escrow.id)
    .fetch_one(db)
    .await?;

    sqlx::query("INSERT INTO escrow_ledger_entries (escrow_id, entry_type, amount_lamports) VALUES ($1, 'lock', $2)")
        .bind(escrow.id)
        .bind(escrow.amount_lamports)
        .execute(db)
        .await?;

    Ok(updated)
}

/// Release escrow (locked → released) — on job approval
pub async fn release_escrow(db: &PgPool, contract_id: Uuid, user_id: Uuid) -> AppResult<EscrowAccount> {
    let contract = sqlx::query_as::<_, Contract>("SELECT * FROM contracts WHERE id = $1")
        .bind(contract_id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Contract not found".into()))?;

    if contract.client_id != user_id {
        return Err(AppError::Forbidden("Only the client can release escrow".into()));
    }

    let escrow = sqlx::query_as::<_, EscrowAccount>(
        "SELECT * FROM escrow_accounts WHERE contract_id = $1"
    )
    .bind(contract_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("Escrow not found".into()))?;

    if escrow.state != "locked" {
        return Err(AppError::BadRequest("Escrow must be locked to release".into()));
    }

    let updated = sqlx::query_as::<_, EscrowAccount>(
        "UPDATE escrow_accounts SET state = 'released', released_at = now() WHERE id = $1 RETURNING *"
    )
    .bind(escrow.id)
    .fetch_one(db)
    .await?;

    sqlx::query("INSERT INTO escrow_ledger_entries (escrow_id, entry_type, amount_lamports) VALUES ($1, 'release', $2)")
        .bind(escrow.id)
        .bind(escrow.amount_lamports)
        .execute(db)
        .await?;

    // Complete contract + job
    sqlx::query("UPDATE contracts SET status = 'completed', completed_at = now() WHERE id = $1")
        .bind(contract_id)
        .execute(db)
        .await?;

    sqlx::query("UPDATE jobs SET state = 'completed', updated_at = now() WHERE id = $1")
        .bind(contract.job_id)
        .execute(db)
        .await?;

    // Increment agent completed jobs
    sqlx::query("UPDATE agents SET total_jobs_completed = total_jobs_completed + 1, updated_at = now() WHERE id = $1")
        .bind(contract.agent_id)
        .execute(db)
        .await?;

    Ok(updated)
}

/// Refund escrow (funded/locked → refunded) — on dispute resolution or cancellation
pub async fn refund_escrow(db: &PgPool, contract_id: Uuid) -> AppResult<EscrowAccount> {
    let escrow = sqlx::query_as::<_, EscrowAccount>(
        "SELECT * FROM escrow_accounts WHERE contract_id = $1"
    )
    .bind(contract_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("Escrow not found".into()))?;

    if !["funded", "locked"].contains(&escrow.state.as_str()) {
        return Err(AppError::BadRequest("Escrow must be funded or locked to refund".into()));
    }

    let updated = sqlx::query_as::<_, EscrowAccount>(
        "UPDATE escrow_accounts SET state = 'refunded' WHERE id = $1 RETURNING *"
    )
    .bind(escrow.id)
    .fetch_one(db)
    .await?;

    sqlx::query("INSERT INTO escrow_ledger_entries (escrow_id, entry_type, amount_lamports) VALUES ($1, 'refund', $2)")
        .bind(escrow.id)
        .bind(escrow.amount_lamports)
        .execute(db)
        .await?;

    Ok(updated)
}

