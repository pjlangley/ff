from typing import TypedDict, Optional
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.instruction import Instruction, AccountMeta
from solana.constants import SYSTEM_PROGRAM_ID, BPF_LOADER_PROGRAM_ID
from construct import Struct, Int64ul, Bytes, Flag, If
from fragments.solana_program import get_instruction_discriminator, get_program_derived_address
from fragments.solana_rpc import init_rpc_client
from fragments.solana_transaction import create_tx_with_fee_payer_and_lifetime


class RegistryStateAccount(TypedDict):
    authority: Pubkey
    registration_count: int


class RegistrationAccount(TypedDict):
    registrant: Pubkey
    registration_index: int
    registered_at: int
    confirmed_at: Optional[int]


registry_state_schema = Struct(
    "authority" / Bytes(32),
    "registration_count" / Int64ul,
)

registration_schema = Struct(
    "registrant" / Bytes(32),
    "registration_index" / Int64ul,
    "registered_at" / Int64ul,
    "confirmed_at_present" / Flag,
    "confirmed_at" / If(lambda ctx: ctx.confirmed_at_present, Int64ul),
)


def get_registry_state_pda(program_address: Pubkey) -> Pubkey:
    pda, _ = Pubkey.find_program_address([b"registry_state"], program_address)
    return pda


def get_program_data_address(program_address: Pubkey) -> Pubkey:
    pda, _ = Pubkey.find_program_address([bytes(program_address)], BPF_LOADER_PROGRAM_ID)
    return pda


async def initialise_registry(authority: Keypair, program_address: Pubkey) -> Signature:
    discriminator = get_instruction_discriminator("initialise_registry", "register")
    payer = authority.pubkey()
    registry_state_pda = get_registry_state_pda(program_address)
    program_data_address = get_program_data_address(program_address)
    client = init_rpc_client()
    instruction = Instruction(
        program_id=program_address,
        data=discriminator,
        accounts=[
            AccountMeta(pubkey=payer, is_signer=True, is_writable=True),
            AccountMeta(pubkey=registry_state_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=program_data_address, is_signer=False, is_writable=False),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ],
    )
    tx = await create_tx_with_fee_payer_and_lifetime(authority, instruction)
    response = await client.send_transaction(tx)
    return response.value


async def register(registrant: Keypair, program_address: Pubkey) -> Signature:
    discriminator = get_instruction_discriminator("register", "register")
    payer = registrant.pubkey()
    registry_state_pda = get_registry_state_pda(program_address)
    registration_pda = get_program_derived_address(payer, program_address, "registration")
    client = init_rpc_client()
    instruction = Instruction(
        program_id=program_address,
        data=discriminator,
        accounts=[
            AccountMeta(pubkey=payer, is_signer=True, is_writable=True),
            AccountMeta(pubkey=registry_state_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=registration_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ],
    )
    tx = await create_tx_with_fee_payer_and_lifetime(registrant, instruction)
    response = await client.send_transaction(tx)
    return response.value


async def confirm_registration(authority: Keypair, program_address: Pubkey, registrant_address: Pubkey) -> Signature:
    discriminator = get_instruction_discriminator("confirm_registration", "register")
    registry_state_pda = get_registry_state_pda(program_address)
    registration_pda = get_program_derived_address(registrant_address, program_address, "registration")
    client = init_rpc_client()
    instruction = Instruction(
        program_id=program_address,
        data=discriminator,
        accounts=[
            AccountMeta(pubkey=registry_state_pda, is_signer=False, is_writable=False),
            AccountMeta(pubkey=authority.pubkey(), is_signer=True, is_writable=False),
            AccountMeta(pubkey=registration_pda, is_signer=False, is_writable=True),
        ],
    )
    tx = await create_tx_with_fee_payer_and_lifetime(authority, instruction)
    response = await client.send_transaction(tx)
    return response.value


async def get_registry_state_account(program_address: Pubkey) -> RegistryStateAccount:
    client = init_rpc_client()
    registry_state_pda = get_registry_state_pda(program_address)
    response = await client.get_account_info(registry_state_pda)
    account_info = response.value

    if account_info is None:
        raise ValueError(f"Account {registry_state_pda} does not exist")

    raw_bytes = bytes(account_info.data)[8:]
    parsed = registry_state_schema.parse(raw_bytes)

    return RegistryStateAccount(
        authority=Pubkey.from_bytes(parsed.authority),
        registration_count=parsed.registration_count,
    )


async def get_registration_account(registrant_address: Pubkey, program_address: Pubkey) -> RegistrationAccount:
    client = init_rpc_client()
    registration_pda = get_program_derived_address(registrant_address, program_address, "registration")
    response = await client.get_account_info(registration_pda)
    account_info = response.value

    if account_info is None:
        raise ValueError(f"Account {registration_pda} does not exist")

    raw_bytes = bytes(account_info.data)[8:]
    parsed = registration_schema.parse(raw_bytes)

    return RegistrationAccount(
        registrant=Pubkey.from_bytes(parsed.registrant),
        registration_index=parsed.registration_index,
        registered_at=parsed.registered_at,
        confirmed_at=parsed.confirmed_at,
    )
