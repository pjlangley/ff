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
    use crate::solana_key_pair::solana_key_pair_utils::{create_key_pair, get_address};

    #[test]
    fn test_get_balance() {
        let keypair = create_key_pair();
        let address = get_address(&keypair);
        let balance = get_balance(address).unwrap();
        assert_eq!(balance, 0);
    }
}
