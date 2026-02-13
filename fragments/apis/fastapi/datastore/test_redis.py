import unittest
import uuid
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app


def short_uuid() -> str:
    return str(uuid.uuid4())[:8]


class TestRedisRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = build_app()
        cls.client = TestClient(app)

    def test_ping(self):
        response = self.client.get("/redis/ping")
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["message"], "PONG")

    def test_get_favourite(self):
        namespace = short_uuid()

        self.client.put(
            f"/redis/favourites/{namespace}",
            json={"favourite_coin": "BTC"},
        )

        response = self.client.get(f"/redis/favourites/{namespace}")
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["favourite_coin"], "BTC")

    def test_get_favourite_not_found(self):
        namespace = short_uuid()
        response = self.client.get(f"/redis/favourites/{namespace}")
        self.assertEqual(response.status_code, 404)

    def test_create_favourite(self):
        namespace = short_uuid()
        response = self.client.put(
            f"/redis/favourites/{namespace}",
            json={"favourite_coin": "SOL"},
        )
        self.assertEqual(response.status_code, 200)

        get_response = self.client.get(f"/redis/favourites/{namespace}")
        self.assertEqual(get_response.status_code, 200)
        result = get_response.json()
        self.assertEqual(result["favourite_coin"], "SOL")

    def test_create_favourite_invalid_payload(self):
        namespace = short_uuid()
        response = self.client.put(
            f"/redis/favourites/{namespace}",
            json={"invalidField": "SOL"},
        )
        self.assertEqual(response.status_code, 422)

    def test_create_favourite_missing_payload(self):
        namespace = short_uuid()
        response = self.client.put(
            f"/redis/favourites/{namespace}",
            json={},
        )
        self.assertEqual(response.status_code, 422)

    def test_update_favourite(self):
        namespace = short_uuid()

        create_response = self.client.put(
            f"/redis/favourites/{namespace}",
            json={"favourite_coin": "SOL"},
        )
        self.assertEqual(create_response.status_code, 200)

        update_response = self.client.patch(
            f"/redis/favourites/{namespace}",
            json={"favourite_coin": "BTC"},
        )
        self.assertEqual(update_response.status_code, 200)

        get_response = self.client.get(f"/redis/favourites/{namespace}")
        result = get_response.json()
        self.assertEqual(result["favourite_coin"], "BTC")

    def test_update_nonexistent_favourite(self):
        namespace = short_uuid()
        response = self.client.patch(
            f"/redis/favourites/{namespace}",
            json={"favourite_coin": "BTC"},
        )
        self.assertEqual(response.status_code, 200)

        get_response = self.client.get(f"/redis/favourites/{namespace}")
        result = get_response.json()
        self.assertEqual(result["favourite_coin"], "BTC")

    def test_update_invalid_payload(self):
        namespace = short_uuid()
        response = self.client.patch(
            f"/redis/favourites/{namespace}",
            json={"wrongField": "BTC"},
        )
        self.assertEqual(response.status_code, 422)

    def test_delete_favourite(self):
        namespace = short_uuid()

        create_response = self.client.put(
            f"/redis/favourites/{namespace}",
            json={"favourite_coin": "BTC"},
        )
        self.assertEqual(create_response.status_code, 200)

        delete_response = self.client.delete(f"/redis/favourites/{namespace}")
        self.assertEqual(delete_response.status_code, 204)

        get_response = self.client.get(f"/redis/favourites/{namespace}")
        self.assertEqual(get_response.status_code, 404)

    def test_delete_nonexistent(self):
        namespace = short_uuid()
        response = self.client.delete(f"/redis/favourites/{namespace}")
        self.assertEqual(response.status_code, 204)
