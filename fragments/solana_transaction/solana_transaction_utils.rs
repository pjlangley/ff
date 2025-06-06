use std::{
    thread::sleep,
    time::{Duration, Instant},
};

use solana_client::client_error::Result as ClientResult;
use solana_sdk::signature::Signature;

use crate::solana_rpc::solana_rpc_utils::init_rpc_client;

pub fn confirm_recent_signature(signature: &Signature, timeout: Option<u64>) -> ClientResult<bool> {
    let client = init_rpc_client();
    let start = Instant::now();
    let deadline = Duration::from_millis(timeout.unwrap_or(5000));

    loop {
        let is_confirmed = client.confirm_transaction(signature)?;

        if is_confirmed {
            return Ok(true);
        }

        if start.elapsed() >= deadline {
            return Ok(false);
        }

        sleep(Duration::from_millis(100));
    }
}

#[cfg(test)]
mod tests {
    use crate::solana_airdrop::solana_airdrop_utils::send_and_confirm_airdrop;

    use super::*;
    use solana_sdk::{
        message::{v0::Message, VersionedMessage},
        native_token::LAMPORTS_PER_SOL,
        signature::Keypair,
        signer::Signer,
        system_instruction,
        transaction::VersionedTransaction,
    };

    fn create_test_transaction(user_keypair: Keypair) -> VersionedTransaction {
        let client = init_rpc_client();
        let latest_blockhash = client.get_latest_blockhash().unwrap();
        let instr = system_instruction::transfer(&user_keypair.pubkey(), &user_keypair.pubkey(), 0);
        let message =
            Message::try_compile(&user_keypair.pubkey(), &[instr], &[], latest_blockhash).unwrap();
        let tx =
            VersionedTransaction::try_new(VersionedMessage::V0(message), &[&user_keypair]).unwrap();
        return tx;
    }

    #[test]
    fn test_solana_confirm_recent_signature_success() {
        let client = init_rpc_client();
        let user_keypair = Keypair::new();
        let _ = send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL);

        let tx = create_test_transaction(user_keypair);
        let sig = client.send_transaction(&tx).unwrap();
        let is_confirmed = confirm_recent_signature(&sig, None).unwrap();

        assert_eq!(is_confirmed, true);
    }

    #[test]
    fn test_solana_confirm_recent_signature_failure() {
        let user_keypair = Keypair::new();
        let tx = create_test_transaction(user_keypair);
        let is_confirmed = confirm_recent_signature(&tx.signatures[0], Some(10)).unwrap();

        assert_eq!(is_confirmed, false);
    }
}
