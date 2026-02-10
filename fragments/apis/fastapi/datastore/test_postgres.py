import unittest
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app


class TestPostgresRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = build_app()
        cls.client = TestClient(app)

    def test_ping(self):
        response = self.client.get("/postgres/ping")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "pong"})
