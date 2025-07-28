import unittest
from pathlib import Path
from dotenv import load_dotenv
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solana.constants import LAMPORTS_PER_SOL
from solana.rpc.core import RPCException
from fragments.env_vars import get_env_var
from fragments.solana_rpc import init_rpc_client, wait_for_slot
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_program_round import (
    initialise_round,
    get_round_account,
    activate_round,
    complete_round,
)
from fragments.solana_transaction import confirm_recent_signature


class TestSolanaRoundInterface(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script_dir = Path(__file__).resolve().parent
        program_keys_file = script_dir / "../../solana_program_keys/solana_program_keys.env"
        load_dotenv(dotenv_path=program_keys_file)

        program_id = get_env_var("round_PROGRAM_ID")

        if program_id is None:
            cls.fail("Environment variable 'round_PROGRAM_ID' is not set")

        cls.program_id = Pubkey.from_string(program_id)
        cls.client = init_rpc_client()

    def test_solana_initialise_activate_complete_round(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)
        recent_slot = self.client.get_slot().value

        sig = initialise_round(authority=user_keypair, program_address=self.program_id, start_slot=recent_slot + 3)
        instr_confirmed = confirm_recent_signature(sig)
        if not instr_confirmed:
            self.fail("Initialise round instruction failed")

        round_account = get_round_account(user_keypair.pubkey(), self.program_id)
        self.assertEqual(round_account["start_slot"], recent_slot + 3)
        self.assertEqual(round_account["authority"], user_keypair.pubkey())
        self.assertIsNone(round_account["activated_at"])
        self.assertIsNone(round_account["activated_by"])
        self.assertIsNone(round_account["completed_at"])

        at_slot = wait_for_slot(recent_slot + 3)

        if not at_slot:
            self.fail("Failed to reach slot in time")

        activate_sig = activate_round(
            payer=user_keypair, program_address=self.program_id, authority=user_keypair.pubkey()
        )
        activate_confirmed = confirm_recent_signature(activate_sig)
        if not activate_confirmed:
            self.fail("Activate round instruction failed")

        round_account = get_round_account(user_keypair.pubkey(), self.program_id)
        self.assertIsNotNone(round_account["activated_at"])
        self.assertEqual(round_account["activated_by"], user_keypair.pubkey())

        complete_sig = complete_round(authority=user_keypair, program_address=self.program_id)
        complete_confirmed = confirm_recent_signature(complete_sig)
        if not complete_confirmed:
            self.fail("Complete round instruction failed")

        round_account = get_round_account(user_keypair.pubkey(), self.program_id)
        self.assertIsNotNone(round_account["completed_at"])

    def test_solana_initialise_round_invalid_slot(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        with self.assertRaises(RPCException) as cm:
            initialise_round(authority=user_keypair, program_address=self.program_id, start_slot=0)

        error_str = str(cm.exception)
        self.assertIn("InvalidStartSlot", error_str)

    def test_solana_activate_round_without_initialise(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        with self.assertRaises(RPCException) as cm:
            activate_round(payer=user_keypair, program_address=self.program_id, authority=user_keypair.pubkey())

        error_str = str(cm.exception)
        self.assertIn("AccountNotInitialized", error_str)

    def test_solana_activate_round_invalid_slot(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)
        recent_slot = self.client.get_slot().value

        sig = initialise_round(authority=user_keypair, program_address=self.program_id, start_slot=recent_slot + 50)
        instr_confirmed = confirm_recent_signature(sig)
        if not instr_confirmed:
            self.fail("Initialise round instruction failed")

        with self.assertRaises(RPCException) as cm:
            activate_round(payer=user_keypair, program_address=self.program_id, authority=user_keypair.pubkey())

        error_str = str(cm.exception)
        self.assertIn("InvalidRoundActivationSlot", error_str)

    def test_solana_complete_round_without_initialise(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        with self.assertRaises(RPCException) as cm:
            complete_round(authority=user_keypair, program_address=self.program_id)

        error_str = str(cm.exception)
        self.assertIn("AccountNotInitialized", error_str)
