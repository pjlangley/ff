import unittest
import os
from fragments.env_vars.env_vars_utils import get_env_var


class TestGetEnvVar(unittest.TestCase):

    def test_env_var_exists(self):
        os.environ["REPO_NAME"] = "fullstack_fragments"
        self.assertEqual(get_env_var("REPO_NAME"), "fullstack_fragments")
        del os.environ["REPO_NAME"]

    def test_env_var_nonexistent(self):
        if "REPO_NAME" in os.environ:
            del os.environ["REPO_NAME"]
        self.assertEqual(get_env_var("REPO_NAME"), None)


if __name__ == "__main__":
    unittest.main()
