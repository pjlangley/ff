import unittest
from pathlib import Path
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app


class TestSolanaUsernameRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script_dir = Path(__file__).resolve().parent
        program_keys_file = script_dir / "../../../../solana_program_keys/solana_program_keys.env"
        load_dotenv(dotenv_path=program_keys_file)

        app = build_app()
        cls.client = TestClient(app)

    def test_initialise_username(self):
        response = self.client.post("/solana/username/initialise", json={"username": "alice"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("address", body)
        self.assertIsInstance(body["address"], str)

    def test_get_username(self):
        init_response = self.client.post("/solana/username/initialise", json={"username": "alice"})
        self.assertEqual(init_response.status_code, 200)
        init_body = init_response.json()

        get_response = self.client.get(f"/solana/username/{init_body['address']}")
        self.assertEqual(get_response.status_code, 200)
        get_body = get_response.json()
        self.assertEqual(get_body["username"], "alice")

    def test_get_username_returns_404_for_non_existent_address(self):
        response = self.client.get("/solana/username/11111111111111111111111111111111")
        self.assertEqual(response.status_code, 404)

    def test_update_username(self):
        init_response = self.client.post("/solana/username/initialise", json={"username": "alice"})
        self.assertEqual(init_response.status_code, 200)
        init_body = init_response.json()

        patch_response = self.client.patch(f"/solana/username/{init_body['address']}", json={"username": "bob"})
        self.assertEqual(patch_response.status_code, 200)

        get_response = self.client.get(f"/solana/username/{init_body['address']}")
        self.assertEqual(get_response.status_code, 200)
        get_body = get_response.json()
        self.assertEqual(get_body["username"], "bob")

    def test_update_username_returns_404_for_non_existent_address(self):
        response = self.client.patch("/solana/username/11111111111111111111111111111111", json={"username": "alice"})
        self.assertEqual(response.status_code, 404)

    def test_get_username_record(self):
        init_response = self.client.post("/solana/username/initialise", json={"username": "alice"})
        self.assertEqual(init_response.status_code, 200)
        init_body = init_response.json()

        patch_response = self.client.patch(f"/solana/username/{init_body['address']}", json={"username": "bob"})
        self.assertEqual(patch_response.status_code, 200)

        record_response = self.client.get(f"/solana/username/{init_body['address']}/record/0")
        self.assertEqual(record_response.status_code, 200)
        record_body = record_response.json()
        self.assertEqual(record_body["old_username"], "alice")
        self.assertEqual(record_body["change_index"], "0")
        self.assertEqual(record_body["authority"], init_body["address"])

    def test_get_username_record_returns_404_for_non_existent_address(self):
        response = self.client.get("/solana/username/11111111111111111111111111111111/record/0")
        self.assertEqual(response.status_code, 404)

    def test_get_username_record_returns_404_for_non_existent_record(self):
        init_response = self.client.post("/solana/username/initialise", json={"username": "alice"})
        self.assertEqual(init_response.status_code, 200)
        init_body = init_response.json()

        patch_response = self.client.patch(f"/solana/username/{init_body['address']}", json={"username": "bob"})
        self.assertEqual(patch_response.status_code, 200)

        record_response = self.client.get(f"/solana/username/{init_body['address']}/record/1")
        self.assertEqual(record_response.status_code, 404)
