import unittest
from fragments.solana_balance import get_balance
from fragments.solana_key_pair import create_key_pair, get_address


class TestSolanaBalance(unittest.TestCase):
    def test_solana_get_balance(self):
        keypair = create_key_pair()
        address = get_address(keypair)
        balance = get_balance(address)
        self.assertEqual(balance, 0)


if __name__ == "__main__":
    unittest.main()
