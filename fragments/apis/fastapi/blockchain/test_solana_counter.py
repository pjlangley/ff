import unittest
from pathlib import Path
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app


class TestSolanaCounterRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script_dir = Path(__file__).resolve().parent
        program_keys_file = script_dir / "../../../../solana_program_keys/solana_program_keys.env"
        load_dotenv(dotenv_path=program_keys_file)

        app = build_app()
        cls.client = TestClient(app)

    def test_get_counter_returns_404_for_non_existent_counter(self):
        response = self.client.get("/solana/counter/11111111111111111111111111111111")
        self.assertEqual(response.status_code, 404)

    def test_increment_counter_returns_404_when_not_initialised(self):
        response = self.client.patch("/solana/counter/11111111111111111111111111111111/increment")
        self.assertEqual(response.status_code, 404)

    def test_initialise_counter(self):
        response = self.client.post("/solana/counter/initialise")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("address", body)
        self.assertIsInstance(body["address"], str)

        get_response = self.client.get(f"/solana/counter/{body['address']}")
        self.assertEqual(get_response.status_code, 200)
        get_body = get_response.json()
        self.assertEqual(get_body["count"], "0")

    def test_increment_counter(self):
        init_response = self.client.post("/solana/counter/initialise")
        self.assertEqual(init_response.status_code, 200)
        init_body = init_response.json()

        increment_response = self.client.patch(f"/solana/counter/{init_body['address']}/increment")
        self.assertEqual(increment_response.status_code, 200)
        increment_body = increment_response.json()
        self.assertEqual(increment_body["new_count"], "1")
