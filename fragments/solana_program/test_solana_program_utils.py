import unittest
from fragments.solana_program import get_instruction_discriminator


class TestSolanaProgramUtils(unittest.TestCase):
    def test_solana_get_instruction_discriminator(self):
        discriminator = get_instruction_discriminator("initialize", "counter")

        self.assertEqual(discriminator.hex(), "afaf6d1f0d989bed")

    def test_solana_get_instruction_discriminator_invalid_instruction(self):
        with self.assertRaises(ValueError) as cm:
            get_instruction_discriminator("invalid_instr", "counter")

        error_str = str(cm.exception)
        self.assertIn("Instruction invalid_instr not found in program counter IDL", error_str)


if __name__ == "__main__":
    unittest.main()
