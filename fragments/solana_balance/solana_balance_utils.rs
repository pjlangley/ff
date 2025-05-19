use crate::solana_rpc::solana_rpc_utils::init_rpc_client;
use solana_client::client_error::ClientError;
use solana_sdk::pubkey::Pubkey;

pub fn get_balance(pubkey: Pubkey) -> Result<u64, ClientError> {
    let rpc_client = init_rpc_client();
    let balance = rpc_client.get_balance(&pubkey)?;
    Ok(balance)
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_sdk::{signature::Keypair, signer::Signer};

    #[test]
    fn test_get_balance() {
        let address = Keypair::new().pubkey();
        let balance = get_balance(address).unwrap();
        assert_eq!(balance, 0);
    }
}
