from solders.pubkey import Pubkey
from solders.message import MessageV0
from solders.instruction import Instruction, AccountMeta
from solders.transaction import VersionedTransaction
from solders.signature import Signature
from solders.keypair import Keypair
from solana.constants import SYSTEM_PROGRAM_ID
from construct import Struct, Int64ul
from fragments.solana_rpc import init_rpc_client
from fragments.solana_program import get_instruction_discriminator, get_program_derived_address


def initialize_account(user_keypair: Keypair, program_id: Pubkey) -> Signature:
    discriminator = get_instruction_discriminator("initialize", "counter")
    counter_pda = get_program_derived_address(user_keypair.pubkey(), program_id, "counter")
    client = init_rpc_client()
    instruction = Instruction(
        program_id,
        discriminator,
        [
            AccountMeta(pubkey=user_keypair.pubkey(), is_signer=True, is_writable=True),
            AccountMeta(pubkey=counter_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ],
    )
    msg = create_transaction_message(user_keypair, instruction)
    tx = VersionedTransaction(msg, [user_keypair])
    response = client.send_transaction(tx)
    return response.value


def get_count(user_keypair: Keypair, program_id: Pubkey) -> int:
    client = init_rpc_client()
    counter_pda = get_program_derived_address(user_keypair.pubkey(), program_id, "counter")
    response = client.get_account_info(counter_pda)
    account_info = response.value

    if account_info is None:
        raise ValueError(f"Account {counter_pda} does not exist")

    # removes the discriminator from the account data
    raw_bytes = bytes(account_info.data)[8:]
    schema = Struct("count" / Int64ul)
    parsed = schema.parse(raw_bytes)

    return parsed.count


def increment_counter(user_keypair: Keypair, program_id: Pubkey) -> Signature:
    discriminator = get_instruction_discriminator("increment", "counter")
    counter_pda = get_program_derived_address(user_keypair.pubkey(), program_id, "counter")
    client = init_rpc_client()
    instruction = Instruction(
        program_id,
        discriminator,
        [
            AccountMeta(pubkey=counter_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=user_keypair.pubkey(), is_signer=True, is_writable=True),
        ],
    )
    msg = create_transaction_message(user_keypair, instruction)
    tx = VersionedTransaction(msg, [user_keypair])
    response = client.send_transaction(tx)
    return response.value


def create_transaction_message(user_keypair: Keypair, instruction: Instruction) -> MessageV0:
    client = init_rpc_client()
    latest_blockhash = client.get_latest_blockhash().value.blockhash

    return MessageV0.try_compile(
        payer=user_keypair.pubkey(),
        recent_blockhash=latest_blockhash,
        instructions=[instruction],
        address_lookup_table_accounts=[],
    )
