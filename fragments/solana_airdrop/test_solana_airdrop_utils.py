import unittest
from solders.keypair import Keypair
from fragments.solana_airdrop import airdrop
from fragments.solana_balance import get_balance
from fragments.solana_transaction import confirm_recent_signature


class TestSolanaAirdrop(unittest.TestCase):
    def test_solana_airdrop(self):
        keypair = Keypair()
        address = keypair.pubkey()
        initial_balance = get_balance(address)
        self.assertEqual(initial_balance, 0)

        airdrop_signature = airdrop(address, 1_000_000)
        airdrop_confirmed = confirm_recent_signature(airdrop_signature)
        self.assertTrue(airdrop_confirmed)

        latest_balance = get_balance(address)
        self.assertEqual(latest_balance, 1_000_000)


if __name__ == "__main__":
    unittest.main()
