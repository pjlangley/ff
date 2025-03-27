import unittest
import base58
from fragments.solana_key_pair.solana_key_pair_utils import create_key_pair, get_address


class TestSolanaKeyPair(unittest.TestCase):

    def _is_base58(self, s: str) -> bool:
        try:
            base58.b58decode(s)
            return True
        except ValueError:
            return False

    def test_solana_create_key_pair(self):
        keypair = create_key_pair()
        self.assertTrue(self._is_base58(str(keypair)))

    def test_solana_get_address(self):
        keypair = create_key_pair()
        address = get_address(keypair)
        self.assertEqual(address, keypair.pubkey())


if __name__ == "__main__":
    unittest.main()
