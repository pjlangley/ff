import unittest
from solders.keypair import Keypair
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_balance import get_balance


class TestSolanaAirdrop(unittest.TestCase):
    def test_solana_airdrop(self):
        keypair = Keypair()
        address = keypair.pubkey()
        initial_balance = get_balance(address)
        self.assertEqual(initial_balance, 0)

        send_and_confirm_airdrop(address, 1_000_000_000)

        latest_balance = get_balance(address)
        self.assertEqual(latest_balance, 1_000_000_000)


if __name__ == "__main__":
    unittest.main()
