use crate::env_vars::env_vars_utils::get_env_var;
use solana_client::client_error::ClientError;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;

pub fn get_balance(pubkey: Pubkey) -> Result<u64, ClientError> {
    let rpc_url = if get_env_var("CI").is_empty() {
        "http://127.0.0.1:8899"
    } else {
        "http://solana-validator:8899"
    };

    let rpc_client = RpcClient::new(rpc_url);
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
