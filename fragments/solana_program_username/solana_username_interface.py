from typing import TypedDict
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.instruction import Instruction, AccountMeta
from solana.constants import SYSTEM_PROGRAM_ID
from construct import Struct, Int32ul, Int64ul, PascalString, Bytes, PrefixedArray
from fragments.solana_program import get_instruction_discriminator, get_program_derived_address
from fragments.solana_rpc import init_rpc_client
from fragments.solana_transaction import create_tx_with_fee_payer_and_lifetime


class Username(TypedDict):
    value: str


class UsernameAccount(TypedDict):
    authority: Pubkey
    username: Username
    change_count: int
    username_recent_history: list[Username]


class UsernameRecordAccount(TypedDict):
    authority: Pubkey
    old_username: Username
    change_index: int


username_schema = Struct("value" / PascalString(Int32ul, encoding="utf-8"))

username_account_schema = Struct(
    "authority" / Bytes(32),
    "username" / username_schema,
    "change_count" / Int64ul,
    "username_recent_history" / PrefixedArray(Int32ul, username_schema),
)

username_record_account_schema = Struct(
    "authority" / Bytes(32),
    "old_username" / username_schema,
    "change_index" / Int64ul,
)


async def initialise_username(user_keypair: Keypair, program_address: Pubkey, username: str) -> Signature:
    discriminator = get_instruction_discriminator("initialize_username", "username")
    username_pda = get_program_derived_address(user_keypair.pubkey(), program_address, "user_account")
    client = init_rpc_client()
    encoded_username = Int32ul.build(len(username)) + username.encode("utf-8")
    instruction = Instruction(
        program_id=program_address,
        data=discriminator + encoded_username,
        accounts=[
            AccountMeta(pubkey=user_keypair.pubkey(), is_signer=True, is_writable=True),
            AccountMeta(pubkey=username_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ],
    )
    tx = await create_tx_with_fee_payer_and_lifetime(user_keypair, instruction)
    response = await client.send_transaction(tx)
    return response.value


async def get_username_account(user_keypair: Keypair, program_address: Pubkey) -> UsernameAccount:
    client = init_rpc_client()
    pda = get_program_derived_address(user_keypair.pubkey(), program_address, "user_account")
    response = await client.get_account_info(pda)
    account_info = response.value

    if account_info is None:
        raise ValueError(f"Account {pda} does not exist")

    raw_bytes = bytes(account_info.data)[8:]  # removes the discriminator from the account data
    parsed = username_account_schema.parse(raw_bytes)

    authority = Pubkey.from_bytes(parsed.authority)
    username_history = parsed.get("username_recent_history", [])

    return UsernameAccount(
        authority=authority,
        username=parsed.username,
        change_count=parsed.change_count,
        username_recent_history=username_history,
    )


def get_username_record_pda(user_address: Pubkey, program_address: Pubkey, change_index: int) -> Pubkey:
    pda, _ = Pubkey.find_program_address(
        seeds=[b"username_record", bytes(user_address), change_index.to_bytes(8, "little")],
        program_id=program_address,
    )
    return pda


async def update_username(user_keypair: Keypair, program_address: Pubkey, username: str) -> Signature:
    username_account = await get_username_account(user_keypair, program_address)
    change_count = username_account["change_count"]
    discriminator = get_instruction_discriminator("update_username", "username")
    username_account_pda = get_program_derived_address(user_keypair.pubkey(), program_address, "user_account")
    username_record_account_pda = get_username_record_pda(user_keypair.pubkey(), program_address, change_count)
    encoded_username = Int32ul.build(len(username)) + username.encode("utf-8")
    client = init_rpc_client()
    instruction = Instruction(
        program_id=program_address,
        data=discriminator + encoded_username,
        accounts=[
            AccountMeta(pubkey=user_keypair.pubkey(), is_signer=True, is_writable=True),
            AccountMeta(pubkey=username_account_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=username_record_account_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ],
    )
    tx = await create_tx_with_fee_payer_and_lifetime(user_keypair, instruction)
    response = await client.send_transaction(tx)
    return response.value


async def get_username_record_account(
    user_address: Pubkey, program_address: Pubkey, change_index: int
) -> UsernameRecordAccount:
    client = init_rpc_client()
    pda = get_username_record_pda(user_address, program_address, change_index)
    response = await client.get_account_info(pda)
    account_info = response.value

    if account_info is None:
        raise ValueError(f"Account {pda} does not exist")

    raw_bytes = bytes(account_info.data)[8:]  # removes the discriminator from the account data
    parsed = username_record_account_schema.parse(raw_bytes)

    return UsernameRecordAccount(
        authority=Pubkey.from_bytes(parsed.authority),
        old_username=parsed.old_username,
        change_index=parsed.change_index,
    )
