from typing import TypedDict, Optional
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.instruction import Instruction, AccountMeta
from solana.constants import SYSTEM_PROGRAM_ID
from construct import Struct, Int64ul, Bytes, Flag, If
from fragments.solana_program import get_instruction_discriminator, get_program_derived_address
from fragments.solana_rpc import init_rpc_client
from fragments.solana_transaction import create_tx_with_fee_payer_and_lifetime


class RoundAccount(TypedDict):
    start_slot: int
    authority: Pubkey
    activated_at: Optional[int]
    activated_by: Optional[Pubkey]
    completed_at: Optional[int]


round_account_schema = Struct(
    "start_slot" / Int64ul,
    "authority" / Bytes(32),
    "activated_at_present" / Flag,
    "activated_at" / If(lambda ctx: ctx.activated_at_present, Int64ul),
    "activated_by_present" / Flag,
    "activated_by" / If(lambda ctx: ctx.activated_by_present, Bytes(32)),
    "completed_at_present" / Flag,
    "completed_at" / If(lambda ctx: ctx.activated_by_present, Int64ul),
)


async def initialise_round(authority: Keypair, program_address: Pubkey, start_slot: int) -> Signature:
    discriminator = get_instruction_discriminator("initialise_round", "round")
    payer = authority.pubkey()
    pda = get_program_derived_address(payer, program_address, "round")
    client = init_rpc_client()
    encoded_start_slot = Int64ul.build(start_slot)
    instr = Instruction(
        program_id=program_address,
        data=discriminator + encoded_start_slot,
        accounts=[
            AccountMeta(pubkey=pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=payer, is_signer=True, is_writable=True),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ],
    )
    tx = await create_tx_with_fee_payer_and_lifetime(authority, instr)
    res = await client.send_transaction(tx)
    return res.value


async def get_round_account(authority: Pubkey, program_address: Pubkey) -> RoundAccount:
    pda = get_program_derived_address(authority, program_address, "round")
    client = init_rpc_client()
    res = await client.get_account_info(pda)
    account_info = res.value

    if account_info is None:
        raise ValueError(f"Round account not found for authority {authority} and program {program_address}")

    raw_bytes = bytes(account_info.data)[8:]  # Skip the first 8 bytes (discriminator)
    parsed = round_account_schema.parse(raw_bytes)

    return RoundAccount(
        start_slot=parsed.start_slot,
        authority=Pubkey.from_bytes(parsed.authority),
        activated_at=parsed.activated_at,
        activated_by=Pubkey.from_bytes(parsed.activated_by) if parsed.activated_by else None,
        completed_at=parsed.completed_at,
    )


async def activate_round(payer: Keypair, program_address: Pubkey, authority: Pubkey) -> Signature:
    discriminator = get_instruction_discriminator("activate_round", "round")
    pda = get_program_derived_address(authority, program_address, "round")
    client = init_rpc_client()
    instr = Instruction(
        program_id=program_address,
        data=discriminator,
        accounts=[
            AccountMeta(pubkey=pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=payer.pubkey(), is_signer=True, is_writable=True),
        ],
    )
    tx = await create_tx_with_fee_payer_and_lifetime(payer, instr)
    res = await client.send_transaction(tx)
    return res.value


async def complete_round(authority: Keypair, program_address: Pubkey) -> Signature:
    discriminator = get_instruction_discriminator("complete_round", "round")
    pda = get_program_derived_address(authority.pubkey(), program_address, "round")
    client = init_rpc_client()
    instr = Instruction(
        program_id=program_address,
        data=discriminator,
        accounts=[
            AccountMeta(pubkey=pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=authority.pubkey(), is_signer=True, is_writable=True),
        ],
    )
    tx = await create_tx_with_fee_payer_and_lifetime(authority, instr)
    res = await client.send_transaction(tx)
    return res.value
