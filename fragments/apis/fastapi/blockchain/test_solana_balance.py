import unittest
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app


class TestSolanaBalanceRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = build_app()
        cls.client = TestClient(app)

    def test_valid_address_with_zero_balance(self):
        response = self.client.get("/solana/balance/111111111111111111111111111111aa")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["balance"], "0")

    def test_invalid_address_returns_400(self):
        response = self.client.get("/solana/balance/22222222222222222222222222222222")
        self.assertEqual(response.status_code, 400)
