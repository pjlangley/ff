use crate::solana_rpc::solana_rpc_utils::init_rpc_client;
use crate::solana_transaction::solana_transaction_utils::confirm_recent_signature;
use num_format::{Locale, ToFormattedString};
use solana_client::client_error::{ClientError, ClientErrorKind};
use solana_sdk::pubkey::Pubkey;

pub fn send_and_confirm_airdrop(pubkey: Pubkey, amount: u64) -> Result<(), ClientError> {
    let client = init_rpc_client();

    println!(
        "Airdropping {} lamports to {}",
        amount.to_formatted_string(&Locale::en_GB),
        pubkey
    );

    let signature = client.request_airdrop(&pubkey, amount)?;
    let is_confirmed = confirm_recent_signature(&signature, None)?;

    if !is_confirmed {
        return Err(ClientError {
            request: Some(solana_client::rpc_request::RpcRequest::Custom {
                method: "ConfirmTransaction",
            }),
            kind: ClientErrorKind::Custom(
                "Airdrop transaction not confirmed within the timeout period".to_string(),
            ),
        });
    }

    println!(
        "Airdrop confirmed for {} with signature {}",
        pubkey, signature
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_sdk::{
        commitment_config::CommitmentConfig, native_token::LAMPORTS_PER_SOL, signature::Keypair,
        signer::Signer,
    };

    #[test]
    fn test_solana_airdrop() {
        let address = Keypair::new().pubkey();
        let rpc_client = init_rpc_client();
        let commitment = CommitmentConfig::confirmed();
        let airdrop_amount = LAMPORTS_PER_SOL;
        let _ = send_and_confirm_airdrop(address, airdrop_amount);

        let balance = rpc_client
            .wait_for_balance_with_commitment(&address, Some(airdrop_amount), commitment)
            .unwrap();

        assert_eq!(balance, airdrop_amount);
    }
}
