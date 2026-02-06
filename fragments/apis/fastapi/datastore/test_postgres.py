"""Unit tests for postgres API routes."""
import unittest
from fastapi.testclient import TestClient
from fragments.apis.fastapi.app import build_app


class TestPostgresRoutes(unittest.TestCase):
    """Test cases for postgres API routes."""

    @classmethod
    def setUpClass(cls):
        """Set up test fixtures."""
        cls.app = build_app()
        cls.client = TestClient(cls.app)

    def test_ping(self):
        """Test the ping endpoint."""
        response = self.client.get("/postgres/ping")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "pong"})


if __name__ == "__main__":
    unittest.main()
