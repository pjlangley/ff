import unittest
from solders.keypair import Keypair
from solders.message import MessageV0
from solders.transaction import VersionedTransaction
from solders.system_program import transfer, TransferParams
from solana.constants import LAMPORTS_PER_SOL
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_transaction import confirm_recent_signature
from fragments.solana_rpc import init_rpc_client


class TestSolanaTransactionUtils(unittest.TestCase):

    def test_solana_confirm_recent_signature_success(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        client = init_rpc_client()
        latest_blockhash = client.get_latest_blockhash()
        instr = transfer(
            TransferParams(
                from_pubkey=user_keypair.pubkey(),
                to_pubkey=user_keypair.pubkey(),
                lamports=0,
            )
        )
        msg = MessageV0.try_compile(
            payer=user_keypair.pubkey(),
            recent_blockhash=latest_blockhash.value.blockhash,
            instructions=[instr],
            address_lookup_table_accounts=[],
        )
        tx = VersionedTransaction(msg, [user_keypair])
        client.send_transaction(tx)
        is_confirmed = confirm_recent_signature(tx.signatures[0])

        self.assertTrue(is_confirmed)

    def test_solana_confirm_recent_signature_failure(self):
        user_keypair = Keypair()
        client = init_rpc_client()
        latest_blockhash = client.get_latest_blockhash()
        msg = MessageV0.try_compile(
            payer=user_keypair.pubkey(),
            recent_blockhash=latest_blockhash.value.blockhash,
            instructions=[],
            address_lookup_table_accounts=[],
        )
        tx = VersionedTransaction(msg, [user_keypair])
        is_confirmed = confirm_recent_signature(tx.signatures[0], 0.1)

        self.assertFalse(is_confirmed)


if __name__ == "__main__":
    unittest.main()
