use std::{
    thread::sleep,
    time::{Duration, Instant},
};

use solana_client::client_error::Result as ClientResult;
use solana_sdk::{
    instruction::Instruction,
    message::{v0::Message, VersionedMessage},
    signature::{Keypair, Signature},
    signer::Signer,
    transaction::VersionedTransaction,
};

use crate::solana_rpc::solana_rpc_utils::init_rpc_client;

pub async fn confirm_recent_signature(
    signature: &Signature,
    timeout: Option<u64>,
) -> ClientResult<bool> {
    let client = init_rpc_client();
    let start = Instant::now();
    let deadline = Duration::from_millis(timeout.unwrap_or(5000));

    loop {
        let is_confirmed = client.confirm_transaction(signature).await?;

        if is_confirmed {
            return Ok(true);
        }

        if start.elapsed() >= deadline {
            return Ok(false);
        }

        sleep(Duration::from_millis(100));
    }
}

pub async fn create_tx_with_fee_payer_and_lifetime(
    user_keypair: &Keypair,
    instruction: Instruction,
) -> VersionedTransaction {
    let client = init_rpc_client();
    let latest_blockhash = client
        .get_latest_blockhash()
        .await
        .unwrap_or_else(|err| panic!("Failed to get latest blockhash: {}", err));
    let msg = Message::try_compile(
        &user_keypair.pubkey(),
        &[instruction],
        &[],
        latest_blockhash,
    )
    .unwrap_or_else(|err| panic!("Failed to compile message: {}", err));

    VersionedTransaction::try_new(VersionedMessage::V0(msg), &[&user_keypair])
        .unwrap_or_else(|err| panic!("Failed to sign transaction: {}", err))
}

#[cfg(test)]
mod tests {
    use crate::solana_airdrop::solana_airdrop_utils::send_and_confirm_airdrop;

    use super::*;
    use solana_sdk::{
        native_token::LAMPORTS_PER_SOL, signature::Keypair, signer::Signer, system_instruction,
        transaction::VersionedTransaction,
    };

    async fn create_test_transaction(user_keypair: Keypair) -> VersionedTransaction {
        let instr = system_instruction::transfer(&user_keypair.pubkey(), &user_keypair.pubkey(), 0);
        create_tx_with_fee_payer_and_lifetime(&user_keypair, instr).await
    }

    #[tokio::test]
    async fn test_solana_confirm_recent_signature_success() {
        let client = init_rpc_client();
        let user_keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL).await;

        let tx = create_test_transaction(user_keypair).await;
        let sig = client.send_transaction(&tx).await.unwrap();
        let is_confirmed = confirm_recent_signature(&sig, None).await.unwrap();

        assert_eq!(is_confirmed, true);
    }

    #[tokio::test]
    async fn test_solana_confirm_recent_signature_failure() {
        let user_keypair = Keypair::new();
        let tx = create_test_transaction(user_keypair).await;
        let is_confirmed = confirm_recent_signature(&tx.signatures[0], Some(10))
            .await
            .unwrap();

        assert_eq!(is_confirmed, false);
    }
}
