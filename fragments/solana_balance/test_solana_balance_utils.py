import unittest
from solders.keypair import Keypair
from fragments.solana_balance import get_balance


class TestSolanaBalance(unittest.TestCase):
    def test_solana_get_balance(self):
        keypair = Keypair()
        address = keypair.pubkey()
        balance = get_balance(address)
        self.assertEqual(balance, 0)


if __name__ == "__main__":
    unittest.main()
