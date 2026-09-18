from typing import TypedDict, Optional
import base58
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.instruction import Instruction, AccountMeta
from solana.constants import SYSTEM_PROGRAM_ID, BPF_LOADER_PROGRAM_ID
from solana.rpc.types import MemcmpOpts
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

# Byte layout of a `Registration` account, mirroring the Rust struct in `programs/register/src/lib.rs`:
#
#   0..8    anchor account discriminator
#   8..40   registrant           Pubkey
#   40..48  registration_index   u64 (little-endian)
#   48..56  registered_at        u64 (little-endian)
#   56..65  confirmed_at         Option<u64> (1 discriminant byte + 8 payload, per Anchor's InitSpace)
#
# Both constants live here, beside the schema, so the raw-byte filter below (`get_program_accounts` +
# `memcmp` lookup by index) cannot drift from the layout the schema assumes.
REGISTRATION_INDEX_OFFSET = 40
REGISTRATION_ACCOUNT_SIZE = 65


def registration_index_filters(index: int) -> list[int | MemcmpOpts]:
    """Server-side filters that isolate the single `Registration` account at `index`.

    `memcmp` compares raw account bytes, so the index is encoded exactly as the account stores it —
    a little-endian u64 at offset 40 — and then base58-encoded because that is the wire format the
    filter takes. The bare int is a `dataSize` filter, keeping the scan off every other account the
    program owns.
    """
    return [
        REGISTRATION_ACCOUNT_SIZE,
        MemcmpOpts(
            offset=REGISTRATION_INDEX_OFFSET,
            bytes=base58.b58encode(index.to_bytes(8, "little")).decode(),
        ),
    ]


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


async def get_registration_account_by_index(index: int, program_address: Pubkey) -> Optional[RegistrationAccount]:
    """Look a `Registration` account up by the index the program assigned it, rather than by registrant.

    The index is not part of the PDA seeds, so there is no address to derive; instead the program's
    accounts are scanned server-side with `registration_index_filters`. Unlike the PDA getters, absence
    is an ordinary outcome of a filtered scan, so it is reported as `None` rather than raised.
    """
    client = init_rpc_client()
    response = await client.get_program_accounts(
        program_address,
        encoding="base64",
        filters=registration_index_filters(index),
    )

    if not response.value:
        return None

    raw_bytes = bytes(response.value[0].account.data)[8:]
    parsed = registration_schema.parse(raw_bytes)

    return RegistrationAccount(
        registrant=Pubkey.from_bytes(parsed.registrant),
        registration_index=parsed.registration_index,
        registered_at=parsed.registered_at,
        confirmed_at=parsed.confirmed_at,
    )
