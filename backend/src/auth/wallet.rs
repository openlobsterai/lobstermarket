use ed25519_dalek::{Signature, Verifier, VerifyingKey};

use crate::error::{AppError, AppResult};

/// Verify an Ed25519 signature from a Solana wallet.
/// - `pubkey_b58`: base58-encoded 32-byte public key
/// - `signature_b58`: base58-encoded 64-byte signature
/// - `message`: the exact UTF-8 message that was signed
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

/// Build the domain-bound sign-in message.
pub fn build_sign_message(domain: &str, nonce: &str, wallet: &str) -> String {
    format!(
        "LobsterMarket.ai wants you to sign in with your Solana wallet.\n\n\
         Domain: {domain}\n\
         Wallet: {wallet}\n\
         Nonce: {nonce}\n\n\
         By signing, you agree to the LobsterMarket Terms of Service."
    )
}

