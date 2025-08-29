import unittest
from solders.keypair import Keypair
from solana.constants import LAMPORTS_PER_SOL
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_balance import get_balance


class TestSolanaAirdrop(unittest.TestCase):
    def test_solana_airdrop(self):
        keypair = Keypair()
        address = keypair.pubkey()
        initial_balance = get_balance(address)
        self.assertEqual(initial_balance, 0)

        send_and_confirm_airdrop(address, LAMPORTS_PER_SOL)

        latest_balance = get_balance(address)
        self.assertEqual(latest_balance, LAMPORTS_PER_SOL)
