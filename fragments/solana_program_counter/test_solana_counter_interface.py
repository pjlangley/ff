import unittest
from pathlib import Path
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.rpc.core import RPCException
from dotenv import load_dotenv
from fragments.solana_program_counter import initialize_account, get_count, increment_counter
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_transaction import confirm_recent_signature
from fragments.env_vars import get_env_var


class TestSolanaCounterInterface(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script_dir = Path(__file__).resolve().parent
        program_keys_file = script_dir / "../../solana_program_keys/solana_program_keys.env"

        if program_keys_file.exists():
            loaded = load_dotenv(dotenv_path=program_keys_file)
            if not loaded:
                cls.fail(f"Failed to load environment variables from {program_keys_file}")
            print(f"Environment variables loaded from {program_keys_file}")

        program_id = get_env_var("counter_PROGRAM_ID")

        if program_id is None:
            cls.fail("Environment variable 'counter_PROGRAM_ID' is not set")

        cls.program_id = Pubkey.from_string(program_id)

    def test_solana_initialize_account(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), 1_000_000_000)

        initialize_signature = initialize_account(user_keypair, self.program_id)
        instruction_confirmed = confirm_recent_signature(initialize_signature)

        if not instruction_confirmed:
            self.fail("Initialize instruction failed")

        count = get_count(user_keypair, self.program_id)
        self.assertEqual(count, 0, "Count should be zero after initialization")

    def test_solana_initialize_account_and_increment(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), 1_000_000_000)

        initialize_signature = initialize_account(user_keypair, self.program_id)
        instruction_confirmed = confirm_recent_signature(initialize_signature)

        if not instruction_confirmed:
            self.fail("Initialize instruction failed")

        count = get_count(user_keypair, self.program_id)
        self.assertEqual(count, 0, "Count should be zero after initialization")

        increment_signature = increment_counter(user_keypair, self.program_id)
        increment_confirmed = confirm_recent_signature(increment_signature)

        if not increment_confirmed:
            self.fail("Increment instruction failed")

        latest_count = get_count(user_keypair, self.program_id)
        self.assertEqual(latest_count, 1, "Count should be 1 after incrementing")

    def test_solana_increment_before_initialize(self):
        user_keypair = Keypair()
        send_and_confirm_airdrop(user_keypair.pubkey(), 1_000_000_000)

        with self.assertRaises(RPCException) as cm:
            increment_counter(user_keypair, self.program_id)

        error_str = str(cm.exception)
        self.assertIn("The program expected this account to be already initialized", error_str)

    def test_solana_get_count_before_initialize(self):
        user_keypair = Keypair()

        with self.assertRaises(ValueError) as cm:
            get_count(user_keypair, self.program_id)

        error_str = str(cm.exception)
        self.assertRegex(error_str, r"Account .* does not exist")


if __name__ == "__main__":
    unittest.main()
