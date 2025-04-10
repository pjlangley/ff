import unittest
from fragments.solana_airdrop import airdrop
from fragments.solana_key_pair import create_key_pair, get_address
from fragments.solana_balance import get_balance
from fragments.solana_rpc import init_rpc_client


class TestSolanaAirdrop(unittest.TestCase):
    def test_airdrop(self):
        client = init_rpc_client()
        keypair = create_key_pair()
        address = get_address(keypair)
        initial_balance = get_balance(address)
        self.assertEqual(initial_balance, 0)

        airdrop_signature = airdrop(address, 1_000_000)
        client.confirm_transaction(airdrop_signature)

        latest_balance = get_balance(address)
        self.assertEqual(latest_balance, 1_000_000)


if __name__ == "__main__":
    unittest.main()
