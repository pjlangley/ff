import unittest
from .redis_crud import redis_ping, redis_create, redis_read, redis_update, redis_delete


class TestRedisCrud(unittest.TestCase):
    def test_redis_ping(self):
        self.assertTrue(redis_ping())

    def test_redis_create(self):
        self.assertEqual(redis_create("python", "bitcoin"), "OK")

    def test_redis_read(self):
        result = redis_read("python")
        self.assertIsInstance(result, dict)
        self.assertIn("favourite_coin", result)
        self.assertEqual(result["favourite_coin"], "bitcoin")

    def test_redis_update(self):
        self.assertEqual(redis_update("python", "pepe"), "OK")
        updated = redis_read("python")
        self.assertEqual(updated["favourite_coin"], "pepe")

    def test_redis_delete(self):
        redis_create("python_test_del", "bitcoin")

        result = redis_read("python_test_del")
        self.assertIn("favourite_coin", result)

        self.assertEqual(redis_delete("python_test_del"), "OK")
        deleted = redis_read("python_test_del")
        self.assertNotIn("favourite_coin", deleted)


if __name__ == "__main__":
    unittest.main()
