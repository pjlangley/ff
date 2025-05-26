import json
from pathlib import Path

script_dir = Path(__file__).resolve().parent

idls = [{"name": "counter", "path": "../blockchain/solana/target/idl/counter.json"}]
program_id_map = {}

for idl in idls:
    idl_path = script_dir / idl["path"]
    try:
        with idl_path.open(encoding="utf-8") as f:
            program_id_map[idl["name"]] = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        raise RuntimeError(f"Failed to load IDL for program {idl['name']} from {idl['path']}: {e}") from e


def get_instruction_discriminator(instruction_name: str, program_name: str) -> bytes:
    idl_item = program_id_map[program_name]

    instr = next((instr for instr in idl_item["instructions"] if instr["name"] == instruction_name), None)

    if not instr:
        raise ValueError(f"Instruction {instruction_name} not found in program {program_name} IDL")

    return bytes(instr["discriminator"])
