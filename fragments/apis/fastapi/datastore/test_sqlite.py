import unittest
import uuid
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app


def short_uuid() -> str:
    return str(uuid.uuid4())[:6].upper()


class TestSqliteRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = build_app()
        cls.client = TestClient(app)

    def test_get_all_coins(self):
        response = self.client.get("/sqlite/coins")
        self.assertEqual(response.status_code, 200)
        coins = response.json()
        self.assertIsInstance(coins, list)
        self.assertGreater(len(coins), 0)

    def test_get_coin_by_ticker(self):
        response = self.client.get("/sqlite/coins/BTC")
        self.assertEqual(response.status_code, 200)
        coin = response.json()
        self.assertEqual(coin["ticker"], "BTC")

    def test_get_coin_by_ticker_lowercase(self):
        response = self.client.get("/sqlite/coins/btc")
        self.assertEqual(response.status_code, 200)
        coin = response.json()
        self.assertEqual(coin["ticker"], "BTC")

    def test_get_coin_by_ticker_not_found(self):
        response = self.client.get("/sqlite/coins/UNKNOWN")
        self.assertEqual(response.status_code, 404)

    def test_get_coins_after_year(self):
        response = self.client.get("/sqlite/coins/after/2008")
        self.assertEqual(response.status_code, 200)
        coins = response.json()
        self.assertIsInstance(coins, list)
        self.assertGreater(len(coins), 0)
        for coin in coins:
            self.assertGreater(coin["launched"], 2008)

    def test_get_coins_after_year_empty(self):
        response = self.client.get("/sqlite/coins/after/2050")
        self.assertEqual(response.status_code, 200)
        coins = response.json()
        self.assertIsInstance(coins, list)
        self.assertEqual(len(coins), 0)

    def test_create_coin(self):
        ticker = short_uuid()
        response = self.client.put(
            f"/sqlite/coins/{ticker}",
            json={"name": "Test coin", "launched": 2025},
        )
        self.assertEqual(response.status_code, 200)

    def test_create_coin_invalid_payload(self):
        ticker = short_uuid()
        response = self.client.put(
            f"/sqlite/coins/{ticker}",
            json={"name": "Invalid coin"},
        )
        self.assertEqual(response.status_code, 422)

    def test_delete_coin(self):
        delete_response = self.client.delete("/sqlite/coins/eth")
        self.assertEqual(delete_response.status_code, 204)

    def test_delete_nonexistent_coin(self):
        ticker = short_uuid()
        response = self.client.delete(f"/sqlite/coins/{ticker}")
        self.assertEqual(response.status_code, 204)

    def test_update_coin(self):
        update_response = self.client.patch(
            "/sqlite/coins/BTC",
            json={"name": "Updated Bitcoin", "launched": 2009},
        )
        self.assertEqual(update_response.status_code, 200)
        updated_coin = update_response.json()
        self.assertEqual(updated_coin["name"], "Updated Bitcoin")

    def test_update_nonexistent_coin(self):
        ticker = short_uuid()
        response = self.client.patch(
            f"/sqlite/coins/{ticker}",
            json={"name": "Non-existent coin", "launched": 2025},
        )
        self.assertEqual(response.status_code, 404)
