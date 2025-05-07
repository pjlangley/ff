import unittest
from solders.keypair import Keypair
from fragments.solana_airdrop import airdrop
from fragments.solana_transaction import confirm_recent_signature


class TestSolanaTransactionUtils(unittest.TestCase):

    def test_solana_confirm_recent_signature(self):
        user_keypair = Keypair()
        airdrop_signature = airdrop(user_keypair.pubkey(), 1_000_000_000)
        is_confirmed = confirm_recent_signature(airdrop_signature)

        self.assertTrue(is_confirmed)


if __name__ == "__main__":
    unittest.main()
