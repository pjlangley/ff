use litesvm::types::{FailedTransactionMetadata, TransactionMetadata};
use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_sdk::{
    instruction::Instruction, signature::Keypair, signer::Signer, transaction::Transaction,
};

pub type BoxedTransactionResult = Result<TransactionMetadata, Box<FailedTransactionMetadata>>;

// Computes Anchor's 8-byte instruction discriminator from the instruction name.
// Anchor uses `sha256("global:<instruction_name>")[..8]`.
pub fn anchor_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{name}"));
    let hash = hasher.finalize();
    hash[..8].try_into().unwrap()
}

// Builds Anchor instruction data: 8-byte discriminator followed by the serialised args.
pub fn anchor_instr_data(name: &str, args: &[u8]) -> Vec<u8> {
    let mut data = anchor_discriminator(name).to_vec();
    data.extend_from_slice(args);
    data
}

pub fn send_instr(
    svm: &mut LiteSVM,
    instr: Instruction,
    payer: &Keypair,
) -> BoxedTransactionResult {
    let blockhash = svm.latest_blockhash();
    let tx =
        Transaction::new_signed_with_payer(&[instr], Some(&payer.pubkey()), &[payer], blockhash);
    svm.send_transaction(tx).map_err(Box::new)
}

pub fn assert_err_logs_contain(result: &BoxedTransactionResult, expected: &str) {
    let err = result.as_ref().expect_err("expected transaction to fail");
    let logs = &err.meta.logs;
    assert!(
        logs.iter().any(|log| log.contains(expected)),
        "expected logs to contain '{expected}', got:\n{}",
        logs.join("\n")
    );
}
