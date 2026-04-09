import os
import unittest
from pathlib import Path
from dotenv import load_dotenv
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solana.constants import LAMPORTS_PER_SOL
from solana.rpc.core import RPCException
from fragments.env_vars import get_env_var
from fragments.solana_airdrop import send_and_confirm_airdrop
from fragments.solana_program_register import (
    initialise_registry,
    register,
    confirm_registration,
    get_registry_state_account,
    get_registration_account,
)
from fragments.solana_transaction import confirm_recent_signature


def load_keypair_from_file(path: str) -> Keypair:
    with open(path, encoding="utf-8") as f:
        return Keypair.from_json(f.read())


class TestSolanaRegisterInterface(unittest.IsolatedAsyncioTestCase):
    _registry_initialised = False

    @classmethod
    def setUpClass(cls):
        script_dir = Path(__file__).resolve().parent
        program_keys_file = script_dir / "../../solana_program_keys/solana_program_keys.env"
        load_dotenv(dotenv_path=program_keys_file)

        program_id = get_env_var("register_PROGRAM_ID")

        if program_id is None:
            cls.fail("Environment variable 'register_PROGRAM_ID' is not set")

        cls.program_id = Pubkey.from_string(program_id)

        keypair_path = os.environ.get("SOLANA_KEYPAIR_PATH", "./solana_program_keys/solana_deployer.json")
        cls.authority = load_keypair_from_file(keypair_path)

    async def asyncSetUp(self):
        if not TestSolanaRegisterInterface._registry_initialised:
            await send_and_confirm_airdrop(self.authority.pubkey(), LAMPORTS_PER_SOL)
            try:
                tx_sig = await initialise_registry(self.authority, self.program_id)
                await confirm_recent_signature(tx_sig)
            except RPCException as e:
                error_str = str(e)
                self.assertIn("already in use", error_str)
            TestSolanaRegisterInterface._registry_initialised = True

    async def test_initialise_registry(self):
        registry_state = await get_registry_state_account(self.program_id)
        self.assertEqual(registry_state["authority"], self.authority.pubkey())
        self.assertGreaterEqual(registry_state["registration_count"], 0)

    async def test_register_and_verify_registration(self):
        registrant = Keypair()
        await send_and_confirm_airdrop(registrant.pubkey(), LAMPORTS_PER_SOL)

        register_tx_sig = await register(registrant, self.program_id)
        instr_confirmed = await confirm_recent_signature(register_tx_sig)
        if not instr_confirmed:
            self.fail("Register instruction failed")

        registration = await get_registration_account(registrant.pubkey(), self.program_id)
        self.assertEqual(registration["registrant"], registrant.pubkey())
        self.assertGreater(registration["registered_at"], 0)
        self.assertIsNone(registration["confirmed_at"])

    async def test_confirm_registration(self):
        registrant = Keypair()
        await send_and_confirm_airdrop(registrant.pubkey(), LAMPORTS_PER_SOL)

        register_tx_sig = await register(registrant, self.program_id)
        instr_confirmed = await confirm_recent_signature(register_tx_sig)
        if not instr_confirmed:
            self.fail("Register instruction failed")

        confirm_tx_sig = await confirm_registration(self.authority, self.program_id, registrant.pubkey())
        confirm_confirmed = await confirm_recent_signature(confirm_tx_sig)
        if not confirm_confirmed:
            self.fail("Confirm registration instruction failed")

        registration = await get_registration_account(registrant.pubkey(), self.program_id)
        self.assertIsNotNone(registration["confirmed_at"])

    async def test_register_multiple_registrants(self):
        registry_state_before = await get_registry_state_account(self.program_id)
        count_before = registry_state_before["registration_count"]

        registrant_a = Keypair()
        registrant_b = Keypair()
        await send_and_confirm_airdrop(registrant_a.pubkey(), LAMPORTS_PER_SOL)
        await send_and_confirm_airdrop(registrant_b.pubkey(), LAMPORTS_PER_SOL)

        reg_tx_sig_a = await register(registrant_a, self.program_id)
        instr_confirmed_a = await confirm_recent_signature(reg_tx_sig_a)
        if not instr_confirmed_a:
            self.fail("Register A instruction failed")

        reg_tx_sig_b = await register(registrant_b, self.program_id)
        instr_confirmed_b = await confirm_recent_signature(reg_tx_sig_b)
        if not instr_confirmed_b:
            self.fail("Register B instruction failed")

        registry_state_after = await get_registry_state_account(self.program_id)
        self.assertEqual(registry_state_after["registration_count"], count_before + 2)

        registration_a = await get_registration_account(registrant_a.pubkey(), self.program_id)
        registration_b = await get_registration_account(registrant_b.pubkey(), self.program_id)
        self.assertEqual(registration_b["registration_index"], registration_a["registration_index"] + 1)

    async def test_confirm_already_confirmed_registration(self):
        registrant = Keypair()
        await send_and_confirm_airdrop(registrant.pubkey(), LAMPORTS_PER_SOL)

        register_tx_sig = await register(registrant, self.program_id)
        instr_confirmed = await confirm_recent_signature(register_tx_sig)
        if not instr_confirmed:
            self.fail("Register instruction failed")

        confirm_tx_sig = await confirm_registration(self.authority, self.program_id, registrant.pubkey())
        confirm_confirmed = await confirm_recent_signature(confirm_tx_sig)
        if not confirm_confirmed:
            self.fail("Confirm registration instruction failed")

        with self.assertRaises(RPCException) as cm:
            await confirm_registration(self.authority, self.program_id, registrant.pubkey())

        error_str = str(cm.exception)
        self.assertIn("RegistrationAlreadyConfirmed", error_str)

    async def test_get_registration_before_it_exists(self):
        registrant = Keypair()

        with self.assertRaises(ValueError) as cm:
            await get_registration_account(registrant.pubkey(), self.program_id)

        error_str = str(cm.exception)
        self.assertRegex(error_str, r"Account .* does not exist")
