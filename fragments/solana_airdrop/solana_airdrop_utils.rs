use crate::solana_rpc::solana_rpc_utils::init_rpc_client;
use num_format::{Locale, ToFormattedString};
use solana_client::client_error::ClientError;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signature;

pub fn airdrop(pubkey: Pubkey, amount: u64) -> Result<Signature, ClientError> {
    let rpc_client = init_rpc_client();

    println!(
        "Airdropping {} lamports to {}",
        amount.to_formatted_string(&Locale::en_GB),
        pubkey
    );

    let signature = rpc_client.request_airdrop(&pubkey, amount)?;
    Ok(signature)
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_sdk::{commitment_config::CommitmentConfig, signature::Keypair, signer::Signer};

    #[test]
    fn test_solana_airdrop() {
        let address = Keypair::new().pubkey();
        let rpc_client = init_rpc_client();
        let commitment = CommitmentConfig::confirmed();
        let airdrop_amount = 1_000_000_000;

        airdrop(address, airdrop_amount).unwrap();

        let balance = rpc_client
            .wait_for_balance_with_commitment(&address, Some(airdrop_amount), commitment)
            .unwrap();

        assert_eq!(balance, airdrop_amount);
    }
}
