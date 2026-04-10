import unittest
from pathlib import Path
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app


class TestSolanaRegisterRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script_dir = Path(__file__).resolve().parent
        program_keys_file = script_dir / "../../../../solana_program_keys/solana_program_keys.env"
        load_dotenv(dotenv_path=program_keys_file)

        app = build_app()
        cls.client = TestClient(app)

    def test_initialise_registry(self):
        response = self.client.post("/solana/register/initialise")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("authority", body)
        self.assertIsInstance(body["authority"], str)

    def test_initialise_registry_is_idempotent(self):
        response = self.client.post("/solana/register/initialise")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("authority", body)

    def test_register_registrant(self):
        response = self.client.post("/solana/register/register")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("address", body)
        self.assertIsInstance(body["address"], str)

    def test_get_registry_state(self):
        self.client.post("/solana/register/initialise")

        response = self.client.get("/solana/register/registry")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("authority", body)
        self.assertIn("registration_count", body)
        self.assertGreaterEqual(int(body["registration_count"]), 0)

    def test_get_unconfirmed_registration(self):
        self.client.post("/solana/register/initialise")

        register_response = self.client.post("/solana/register/register")
        self.assertEqual(register_response.status_code, 200)
        register_body = register_response.json()

        get_response = self.client.get(f"/solana/register/{register_body['address']}")
        self.assertEqual(get_response.status_code, 200)
        get_body = get_response.json()
        self.assertIsNotNone(get_body["registrant"])
        self.assertIsNotNone(get_body["registration_index"])
        self.assertIsNotNone(get_body["registered_at"])
        self.assertIsNone(get_body["confirmed_at"])

    def test_confirm_registration(self):
        self.client.post("/solana/register/initialise")

        register_response = self.client.post("/solana/register/register")
        self.assertEqual(register_response.status_code, 200)
        register_body = register_response.json()

        confirm_response = self.client.patch(f"/solana/register/{register_body['address']}/confirm")
        self.assertEqual(confirm_response.status_code, 200)

        get_response = self.client.get(f"/solana/register/{register_body['address']}")
        self.assertEqual(get_response.status_code, 200)
        get_body = get_response.json()
        self.assertIsNotNone(get_body["confirmed_at"])

    def test_get_registration_returns_404_for_unknown_address(self):
        response = self.client.get("/solana/register/11111111111111111111111111111111")
        self.assertEqual(response.status_code, 404)

    def test_confirm_registration_returns_404_for_unknown_address(self):
        response = self.client.patch("/solana/register/11111111111111111111111111111111/confirm")
        self.assertEqual(response.status_code, 404)
