import unittest
from solders.keypair import Keypair
from solders.message import MessageV0
from solders.transaction import VersionedTransaction
from fragments.solana_airdrop import airdrop
from fragments.solana_transaction import confirm_recent_signature
from fragments.solana_rpc import init_rpc_client


class TestSolanaTransactionUtils(unittest.TestCase):

    def test_solana_confirm_recent_signature_success(self):
        user_keypair = Keypair()
        sig = airdrop(user_keypair.pubkey(), 1_000_000_000)
        is_confirmed = confirm_recent_signature(sig)

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
