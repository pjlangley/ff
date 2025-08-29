import unittest
import os
from fragments.env_vars.env_vars_utils import get_env_var


class TestGetEnvVar(unittest.TestCase):

    def test_env_var_exists(self):
        os.environ["REPO_NAME"] = "ff"
        self.assertEqual(get_env_var("REPO_NAME"), "ff")
        del os.environ["REPO_NAME"]

    def test_env_var_nonexistent(self):
        if "REPO_NAME" in os.environ:
            del os.environ["REPO_NAME"]
        self.assertEqual(get_env_var("REPO_NAME"), None)
