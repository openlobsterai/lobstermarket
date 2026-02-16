use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use k256::ecdsa::{RecoveryId, Signature as EcdsaSignature, VerifyingKey as EcdsaVerifyingKey};
use sha3::{Digest, Keccak256};

use crate::error::{AppError, AppResult};

/// Detect wallet type from address format.
pub fn detect_wallet_type(address: &str) -> &'static str {
    if address.starts_with("0x") && address.len() == 42 {
        "ethereum" // covers MetaMask, Coinbase, Trust, etc.
    } else {
        "solana"
    }
}

/// Verify a wallet signature — dispatches to Solana or EVM based on wallet type.
pub fn verify_wallet_signature(
    wallet_type: &str,
    address: &str,
    signature: &str,
    message: &str,
) -> AppResult<()> {
    match wallet_type {
        "solana" => verify_solana_signature(address, signature, message),
        "ethereum" | "base" | "bnb" | "tron" => verify_evm_signature(address, signature, message),
        _ => Err(AppError::BadRequest(format!("Unsupported wallet type: {wallet_type}"))),
    }
}

/// Verify an Ed25519 signature from a Solana wallet.
pub fn verify_solana_signature(
    pubkey_b58: &str,
    signature_b58: &str,
    message: &str,
) -> AppResult<()> {
    let pubkey_bytes = bs58::decode(pubkey_b58)
        .into_vec()
        .map_err(|_| AppError::BadRequest("Invalid public key encoding".into()))?;

    let sig_bytes = bs58::decode(signature_b58)
        .into_vec()
        .map_err(|_| AppError::BadRequest("Invalid signature encoding".into()))?;

    let pubkey_arr: [u8; 32] = pubkey_bytes
        .try_into()
        .map_err(|_| AppError::BadRequest("Public key must be 32 bytes".into()))?;

    let sig_arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| AppError::BadRequest("Signature must be 64 bytes".into()))?;

    let verifying_key = VerifyingKey::from_bytes(&pubkey_arr)
        .map_err(|_| AppError::BadRequest("Invalid public key".into()))?;

    let signature = Signature::from_bytes(&sig_arr);

    verifying_key
        .verify(message.as_bytes(), &signature)
        .map_err(|_| AppError::Unauthorized("Signature verification failed".into()))?;

    Ok(())
}

/// Verify an EIP-191 personal_sign signature from an EVM wallet (MetaMask, Coinbase, Trust, etc.)
pub fn verify_evm_signature(
    address: &str,
    signature_hex: &str,
    message: &str,
) -> AppResult<()> {
    // EIP-191 prefix
    let prefixed = format!(
        "\x19Ethereum Signed Message:\n{}{}",
        message.len(),
        message
    );
    let hash = Keccak256::digest(prefixed.as_bytes());

    // Parse signature (65 bytes: r[32] + s[32] + v[1])
    let sig_hex = signature_hex.strip_prefix("0x").unwrap_or(signature_hex);
    let sig_bytes = hex::decode(sig_hex)
        .map_err(|_| AppError::BadRequest("Invalid signature hex encoding".into()))?;

    if sig_bytes.len() != 65 {
        return Err(AppError::BadRequest("EVM signature must be 65 bytes".into()));
    }

    let v = sig_bytes[64];
    let recovery_id = RecoveryId::try_from(if v >= 27 { v - 27 } else { v })
        .map_err(|_| AppError::BadRequest("Invalid recovery id".into()))?;

    let ecdsa_sig = EcdsaSignature::try_from(&sig_bytes[..64])
        .map_err(|_| AppError::BadRequest("Invalid ECDSA signature".into()))?;

    // Recover public key from the hash + signature
    let recovered_key =
        EcdsaVerifyingKey::recover_from_prehash(&hash, &ecdsa_sig, recovery_id)
            .map_err(|_| AppError::Unauthorized("EVM signature recovery failed".into()))?;

    // Derive Ethereum address from uncompressed public key
    let pubkey_uncompressed = recovered_key.to_encoded_point(false);
    let pubkey_bytes = pubkey_uncompressed.as_bytes();
    // Skip the 0x04 prefix byte, hash the remaining 64 bytes
    let pubkey_hash = Keccak256::digest(&pubkey_bytes[1..]);
    let recovered_address = format!("0x{}", hex::encode(&pubkey_hash[12..]));

    // Compare addresses (case-insensitive)
    if recovered_address.to_lowercase() != address.to_lowercase() {
        return Err(AppError::Unauthorized(format!(
            "Address mismatch: expected {}, recovered {}",
            address, recovered_address
        )));
    }

    Ok(())
}

/// Build the domain-bound sign-in message (works for all wallet types).
pub fn build_sign_message(domain: &str, nonce: &str, wallet: &str) -> String {
    let wallet_label = if wallet.starts_with("0x") {
        "wallet address"
    } else {
        "Solana wallet"
    };
    format!(
        "LobsterMarket.ai wants you to sign in with your {wallet_label}.\n\n\
         Domain: {domain}\n\
         Wallet: {wallet}\n\
         Nonce: {nonce}\n\n\
         By signing, you agree to the LobsterMarket Terms of Service."
    )
}
