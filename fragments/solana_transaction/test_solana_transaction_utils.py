import unittest
from solders.keypair import Keypair
from solders.system_program import transfer, TransferParams
from solana.constants import LAMPORTS_PER_SOL
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_transaction import confirm_recent_signature, create_tx_with_fee_payer_and_lifetime
from fragments.solana_rpc import init_rpc_client


class TestSolanaTransactionUtils(unittest.TestCase):

    def test_solana_confirm_recent_signature_success(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        instr = transfer(
            TransferParams(
                from_pubkey=user_keypair.pubkey(),
                to_pubkey=user_keypair.pubkey(),
                lamports=0,
            )
        )
        tx = create_tx_with_fee_payer_and_lifetime(user_keypair=user_keypair, instruction=instr)
        client = init_rpc_client()
        client.send_transaction(tx)
        is_confirmed = confirm_recent_signature(tx.signatures[0])

        self.assertTrue(is_confirmed)

    def test_solana_confirm_recent_signature_failure(self):
        user_keypair = Keypair()
        instr = transfer(
            TransferParams(
                from_pubkey=user_keypair.pubkey(),
                to_pubkey=user_keypair.pubkey(),
                lamports=0,
            )
        )
        tx = create_tx_with_fee_payer_and_lifetime(user_keypair=user_keypair, instruction=instr)

        is_confirmed = confirm_recent_signature(tx.signatures[0], 0.1)

        self.assertFalse(is_confirmed)


if __name__ == "__main__":
    unittest.main()
