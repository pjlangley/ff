#[cfg(test)]
use std::{
    thread::sleep,
    time::{Duration, Instant},
};

use crate::env_vars::env_vars_utils::get_env_var;
#[cfg(test)]
use solana_client::client_error::Result as ClientResult;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;

pub fn init_rpc_client() -> RpcClient {
    let host = get_env_var("SOLANA_HOST");
    let rpc_url = if host.is_empty() {
        "http://127.0.0.1:8899".to_string()
    } else {
        format!("http://{}:8899", host)
    };

    RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed())
}

#[cfg(test)]
pub async fn wait_for_slot(slot: u64, timeout: Option<u64>) -> ClientResult<bool> {
    let client = init_rpc_client();
    let deadline = Instant::now() + Duration::from_millis(timeout.unwrap_or(5000));

    loop {
        let current_slot = client.get_slot().await?;

        if current_slot >= slot {
            return Ok(true);
        }

        if Instant::now() >= deadline {
            return Ok(false);
        }

        sleep(Duration::from_millis(200));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_solana_init_rpc_client() {
        let client = init_rpc_client();
        let min_expected_version = semver::Version::new(2, 1, 9);
        let version_info = client.get_version().await.unwrap();
        let solana_version = semver::Version::parse(&version_info.solana_core).unwrap();

        assert!(
            solana_version >= min_expected_version,
            "Solana version is not as expected"
        );
    }

    #[tokio::test]
    async fn test_solana_wait_for_slot_success() {
        let client = init_rpc_client();
        let current_slot = client.get_slot().await.unwrap();
        let result = wait_for_slot(current_slot + 1, None).await.unwrap();
        assert_eq!(
            result, true,
            "Expected to wait for the next slot successfully"
        );
    }

    #[tokio::test]
    async fn test_solana_wait_for_slot_failure() {
        let client = init_rpc_client();
        let current_slot = client.get_slot().await.unwrap();
        let result = wait_for_slot(current_slot + 50, Some(10)).await.unwrap();
        assert_eq!(
            result, false,
            "Expected to fail waiting for a slot that is too far in the future"
        );
    }
}
