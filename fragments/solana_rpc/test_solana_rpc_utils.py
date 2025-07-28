import unittest
from fragments.solana_rpc import init_rpc_client, wait_for_slot


class TestSolanaRpcUtils(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = init_rpc_client()

    def test_solana_init_rpc_client(self):
        block_height = self.client.get_block_height().value
        self.assertGreater(block_height, 0)

    def test_solana_wait_for_slot_success(self):
        current_slot = self.client.get_slot().value
        success = wait_for_slot(current_slot + 1)
        self.assertTrue(success)

    def test_solana_wait_for_slot_failure(self):
        current_slot = self.client.get_slot().value
        success = wait_for_slot(current_slot + 50, timeout=0.5)
        self.assertFalse(success)
