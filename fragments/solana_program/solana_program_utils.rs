use std::collections::HashMap;

use once_cell::sync::Lazy;
use serde::Deserialize;
use solana_sdk::pubkey::Pubkey;

#[derive(Deserialize, Debug)]
struct IdlInstruction {
    name: String,
    discriminator: Vec<u8>,
}

#[derive(Deserialize, Debug)]
struct Idl {
    instructions: Vec<IdlInstruction>,
}

static COUNTER_IDL_JSON: &str =
    include_str!("../../fragments/blockchain/solana/target/idl/counter.json");
static ROUND_IDL_JSON: &str =
    include_str!("../../fragments/blockchain/solana/target/idl/round.json");
static USERNAME_IDL_JSON: &str =
    include_str!("../../fragments/blockchain/solana/target/idl/username.json");

static PROGRAM_ID_MAP: Lazy<HashMap<String, Idl>> = Lazy::new(|| {
    let mut program_id_map: HashMap<String, Idl> = HashMap::new();
    let idls: &[(&str, &str)] = &[
        ("counter", COUNTER_IDL_JSON),
        ("round", ROUND_IDL_JSON),
        ("username", USERNAME_IDL_JSON),
    ];

    for (name, idl_json) in idls {
        let idl: Idl = serde_json::from_str(idl_json)
            .unwrap_or_else(|err| panic!("Failed to parse IDL for {}: {}", name, err));

        program_id_map.insert(name.to_string(), idl);
    }

    program_id_map
});

pub fn get_instruction_discriminator(instruction_name: &str, program_name: &str) -> Vec<u8> {
    let discriminator = PROGRAM_ID_MAP.get(program_name).and_then(|idl| {
        idl.instructions
            .iter()
            .find(|instr| instr.name == instruction_name)
            .map(|instr| instr.discriminator.clone())
    });

    discriminator.unwrap_or_else(|| {
        panic!(
            "Instruction {} not found in program {} IDL",
            instruction_name, program_name
        )
    })
}

pub fn get_program_derived_address(
    user_address: &Pubkey,
    program_address: &Pubkey,
    account_name: &str,
) -> Pubkey {
    let seed1 = account_name.as_bytes();
    let seed2 = user_address.as_ref();
    let (pda, _) = Pubkey::find_program_address(&[seed1, seed2], program_address);
    pda
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solana_program_get_instruction_discriminator() {
        let discriminator = get_instruction_discriminator("initialize", "counter");
        assert_eq!(discriminator, vec![175, 175, 109, 31, 13, 152, 155, 237]);
    }

    #[test]
    #[should_panic(expected = "Instruction invalid not found in program counter IDL")]
    fn test_solana_program_get_instruction_discriminator_invalid() {
        get_instruction_discriminator("invalid", "counter");
    }

    #[test]
    fn test_solana_program_get_program_derived_address() {
        let user_pubkey = Pubkey::from_str_const("71jvqeEzwVnz6dpo2gZAKbCZkq6q6bpt9nkHZvBiia4Z");
        let program_pubkey = Pubkey::from_str_const("23Ww1C2uzCiH9zjmfhG6QmkopkeanZM87mjDHu8MMwXY");
        let pda = get_program_derived_address(&user_pubkey, &program_pubkey, "counter");
        assert_eq!(
            pda.to_string(),
            "9yFnCu3Nyr4aa7kdd4ckAyPKABQyTPLX2Xm4Aj2MXsLc"
        );
    }
}
