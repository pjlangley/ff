use crate::env_vars::env_vars_utils::get_env_var;
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;

pub fn init_rpc_client() -> RpcClient {
    let rpc_url = if get_env_var("CI").is_empty() {
        "http://127.0.0.1:8899"
    } else {
        "http://solana-validator:8899"
    };

    RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solana_init_rpc_client() {
        let rpc_client = init_rpc_client();
        let min_expected_version = semver::Version::new(2, 1, 9);
        let version_info = rpc_client.get_version().unwrap();
        let solana_version = semver::Version::parse(&version_info.solana_core).unwrap();

        assert!(
            solana_version >= min_expected_version,
            "Solana version is not as expected"
        );
    }
}
