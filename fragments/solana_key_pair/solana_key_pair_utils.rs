use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signer};

pub fn create_key_pair() -> Keypair {
    Keypair::new()
}

pub fn get_address(keypair: &Keypair) -> Pubkey {
    keypair.pubkey()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_key_pair_and_get_address() {
        let keypair = create_key_pair();
        assert_eq!(keypair.pubkey(), get_address(&keypair));
    }
}
