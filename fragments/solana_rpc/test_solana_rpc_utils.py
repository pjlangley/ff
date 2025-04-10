import unittest
from fragments.solana_rpc import init_rpc_client


class TestSolanaRpcUtils(unittest.TestCase):
    def test_solana_init_rpc_client(self):
        client = init_rpc_client()
        block_height = client.get_block_height().value
        self.assertGreater(block_height, 0)


if __name__ == "__main__":
    unittest.main()
