import unittest
from solders.pubkey import Pubkey
from fragments.solana_program import get_instruction_discriminator, get_program_derived_address


class TestSolanaProgramUtils(unittest.TestCase):
    def test_solana_get_instruction_discriminator(self):
        discriminator = get_instruction_discriminator("initialize", "counter")

        self.assertEqual(discriminator.hex(), "afaf6d1f0d989bed")

    def test_solana_get_instruction_discriminator_invalid_instruction(self):
        with self.assertRaises(ValueError) as cm:
            get_instruction_discriminator("invalid_instr", "counter")

        error_str = str(cm.exception)
        self.assertIn("Instruction invalid_instr not found in program counter IDL", error_str)

    def test_solana_get_program_derived_address(self):
        user_address = Pubkey.from_string("71jvqeEzwVnz6dpo2gZAKbCZkq6q6bpt9nkHZvBiia4Z")
        program_address = Pubkey.from_string("23Ww1C2uzCiH9zjmfhG6QmkopkeanZM87mjDHu8MMwXY")
        pda = get_program_derived_address(user_address, program_address, "counter")

        self.assertEqual(pda, Pubkey.from_string("9yFnCu3Nyr4aa7kdd4ckAyPKABQyTPLX2Xm4Aj2MXsLc"))
