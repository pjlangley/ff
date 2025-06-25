import unittest
from pathlib import Path
from dotenv import load_dotenv
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solana.constants import LAMPORTS_PER_SOL
from solana.rpc.core import RPCException
from fragments.env_vars import get_env_var
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_program_username import (
    initialise_username,
    get_username_account,
    update_username,
    get_username_record_account,
)
from fragments.solana_transaction import confirm_recent_signature


class TestSolanaUsernameInterface(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script_dir = Path(__file__).resolve().parent
        program_keys_file = script_dir / "../../solana_program_keys/solana_program_keys.env"
        load_dotenv(dotenv_path=program_keys_file)

        program_id = get_env_var("username_PROGRAM_ID")

        if program_id is None:
            cls.fail("Environment variable 'username_PROGRAM_ID' is not set")

        cls.program_id = Pubkey.from_string(program_id)

    def test_solana_initialise_username(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        sig = initialise_username(user_keypair=user_keypair, program_address=self.program_id, username="my_username")
        instr_confirmed = confirm_recent_signature(sig)

        if not instr_confirmed:
            self.fail("Initialise username instruction failed")

        user_account = get_username_account(user_keypair=user_keypair, program_address=self.program_id)
        self.assertEqual(user_account["username"]["value"], "my_username")
        self.assertEqual(user_account["authority"], user_keypair.pubkey())
        self.assertEqual(user_account["change_count"], 0)
        self.assertEqual(len(user_account["username_recent_history"]), 0)

    def test_solana_init_username_update_username(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        sig = initialise_username(user_keypair=user_keypair, program_address=self.program_id, username="my_username")
        instr_confirmed = confirm_recent_signature(sig)

        if not instr_confirmed:
            self.fail("Initialise username instruction failed")

        user_account = get_username_account(user_keypair=user_keypair, program_address=self.program_id)
        self.assertEqual(user_account["username"]["value"], "my_username")

        update_sig = update_username(
            user_keypair=user_keypair, program_address=self.program_id, username="new_username"
        )
        update_instr_confirmed = confirm_recent_signature(update_sig)

        if not update_instr_confirmed:
            self.fail("update username instruction failed")

        updated_user_account = get_username_account(user_keypair=user_keypair, program_address=self.program_id)
        self.assertEqual(updated_user_account["username"]["value"], "new_username")

    def test_solana_update_username_multiple_times(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        sig = initialise_username(user_keypair=user_keypair, program_address=self.program_id, username="username_0")
        instr_confirmed = confirm_recent_signature(sig)

        if not instr_confirmed:
            self.fail("Initialise username instruction failed")

        for i in range(4):
            update_sig = update_username(
                user_keypair=user_keypair, program_address=self.program_id, username=f"username_{i + 1}"
            )
            update_instr_confirmed = confirm_recent_signature(update_sig)

            if not update_instr_confirmed:
                self.fail("update username instruction failed")

        for i in range(4):
            user_record_account = get_username_record_account(
                user_address=user_keypair.pubkey(), program_address=self.program_id, change_index=i
            )
            self.assertEqual(user_record_account["authority"], user_keypair.pubkey())
            self.assertEqual(user_record_account["old_username"]["value"], f"username_{i}")
            self.assertEqual(user_record_account["change_index"], i)

    def test_solana_update_username_before_init(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        with self.assertRaises(ValueError) as cm:
            update_username(user_keypair=user_keypair, program_address=self.program_id, username="my_username")

        error_str = str(cm.exception)
        self.assertRegex(error_str, r"Account .* does not exist")

    def test_solana_get_username_account_before_init(self):
        user_keypair = Keypair()

        with self.assertRaises(ValueError) as cm:
            get_username_account(user_keypair=user_keypair, program_address=self.program_id)

        error_str = str(cm.exception)
        self.assertRegex(error_str, r"Account .* does not exist")

    def test_solana_get_username_record_account_before_init(self):
        user_keypair = Keypair()

        with self.assertRaises(ValueError) as cm:
            get_username_record_account(
                user_address=user_keypair.pubkey(), program_address=self.program_id, change_index=0
            )

        error_str = str(cm.exception)
        self.assertRegex(error_str, r"Account .* does not exist")

    def test_solana_invalid_username_at_init(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        with self.assertRaises(RPCException) as cm:
            initialise_username(user_keypair=user_keypair, program_address=self.program_id, username="my_username!!!")

        error_str = str(cm.exception)
        self.assertIn("UsernameInvalidCharacters", error_str)

    def test_solana_invalid_username_at_update(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), LAMPORTS_PER_SOL)

        sig = initialise_username(user_keypair=user_keypair, program_address=self.program_id, username="my_username")
        instr_confirmed = confirm_recent_signature(sig)

        if not instr_confirmed:
            self.fail("Initialise username instruction failed")

        with self.assertRaises(RPCException) as cm:
            update_username(user_keypair=user_keypair, program_address=self.program_id, username="z")

        error_str = str(cm.exception)
        self.assertIn("UsernameTooShort", error_str)
