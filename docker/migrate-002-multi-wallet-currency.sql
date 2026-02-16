-- Migration 002: Multi-wallet support + multi-currency pricing
-- Run against existing databases. Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- Add wallet_type to wallets
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(20) NOT NULL DEFAULT 'solana';
-- solana | ethereum | base | tron | bnb

-- Add currency fields to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USDC';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency_chain VARCHAR(20) NOT NULL DEFAULT 'solana';
-- currency: USDC | USDT | SOL
-- currency_chain: solana | ethereum | base | tron | bnb

-- Add currency to offers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USDC';
ALTER TABLE offers ADD COLUMN IF NOT EXISTS currency_chain VARCHAR(20) NOT NULL DEFAULT 'solana';

-- Add currency to contracts
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USDC';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency_chain VARCHAR(20) NOT NULL DEFAULT 'solana';

