import unittest
from pathlib import Path
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app
from fragments.solana_rpc import wait_for_slot


class TestSolanaRoundRoutes(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        script_dir = Path(__file__).resolve().parent
        program_keys_file = script_dir / "../../../../solana_program_keys/solana_program_keys.env"
        load_dotenv(dotenv_path=program_keys_file)

        app = build_app()
        cls.client = TestClient(app)

    def test_initialise_round(self):
        response = self.client.post("/solana/round/initialise")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("address", body)
        self.assertIsInstance(body["address"], str)
        self.assertIn("start_slot", body)
        self.assertIsInstance(body["start_slot"], str)

    def test_get_pending_round(self):
        init_response = self.client.post("/solana/round/initialise")
        self.assertEqual(init_response.status_code, 200)
        init_body = init_response.json()

        get_response = self.client.get(f"/solana/round/{init_body['address']}")
        self.assertEqual(get_response.status_code, 200)
        get_body = get_response.json()
        self.assertIsNotNone(get_body["start_slot"])
        self.assertIsNotNone(get_body["authority"])
        self.assertIsNone(get_body["activated_at"])
        self.assertIsNone(get_body["activated_by"])
        self.assertIsNone(get_body["completed_at"])

    async def test_activate_round(self):
        init_response = self.client.post("/solana/round/initialise")
        self.assertEqual(init_response.status_code, 200)
        init_body = init_response.json()

        at_slot = await wait_for_slot(int(init_body["start_slot"]))
        self.assertTrue(at_slot, f"Round start slot {init_body['start_slot']} not reached within timeout")

        patch_response = self.client.patch(f"/solana/round/{init_body['address']}/activate")
        self.assertEqual(patch_response.status_code, 200)

        get_response = self.client.get(f"/solana/round/{init_body['address']}")
        self.assertEqual(get_response.status_code, 200)
        get_body = get_response.json()
        self.assertIsNotNone(get_body["start_slot"])
        self.assertIsNotNone(get_body["authority"])
        self.assertIsNotNone(get_body["activated_at"])
        self.assertIsNotNone(get_body["activated_by"])
        self.assertIsNone(get_body["completed_at"])

    async def test_complete_round(self):
        init_response = self.client.post("/solana/round/initialise")
        self.assertEqual(init_response.status_code, 200)
        init_body = init_response.json()

        at_slot = await wait_for_slot(int(init_body["start_slot"]))
        self.assertTrue(at_slot, f"Round start slot {init_body['start_slot']} not reached within timeout")

        activate_response = self.client.patch(f"/solana/round/{init_body['address']}/activate")
        self.assertEqual(activate_response.status_code, 200)

        complete_response = self.client.patch(f"/solana/round/{init_body['address']}/complete")
        self.assertEqual(complete_response.status_code, 200)

        get_response = self.client.get(f"/solana/round/{init_body['address']}")
        self.assertEqual(get_response.status_code, 200)
        get_body = get_response.json()
        self.assertIsNotNone(get_body["start_slot"])
        self.assertIsNotNone(get_body["authority"])
        self.assertIsNotNone(get_body["activated_at"])
        self.assertIsNotNone(get_body["activated_by"])
        self.assertIsNotNone(get_body["completed_at"])

    def test_get_round_returns_404_for_non_existent_round(self):
        response = self.client.get("/solana/round/11111111111111111111111111111111")
        self.assertEqual(response.status_code, 404)
