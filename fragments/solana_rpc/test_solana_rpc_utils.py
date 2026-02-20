import unittest
from fragments.solana_rpc import init_rpc_client, wait_for_slot


class TestSolanaRpcUtils(unittest.IsolatedAsyncioTestCase):
    async def test_solana_init_rpc_client(self):
        client = init_rpc_client()
        block_height = (await client.get_block_height()).value
        self.assertGreater(block_height, 0)

    async def test_solana_wait_for_slot_success(self):
        client = init_rpc_client()
        current_slot = (await client.get_slot()).value
        success = await wait_for_slot(current_slot + 1)
        self.assertTrue(success)

    async def test_solana_wait_for_slot_failure(self):
        client = init_rpc_client()
        current_slot = (await client.get_slot()).value
        success = await wait_for_slot(current_slot + 50, timeout=0.5)
        self.assertFalse(success)
