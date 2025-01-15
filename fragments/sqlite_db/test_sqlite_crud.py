import unittest
from fragments.sqlite_db.sqlite_crud import (
    get_item_by_ticker,
    get_items_after_launch_year,
    get_all_items,
    add_item,
    update_item,
    delete_item,
)


class TestSqliteCrud(unittest.TestCase):

    def test_get_item_by_ticker(self):
        self.assertEqual(get_item_by_ticker("BTC"), (1, "BTC", "Bitcoin", 2009))

    def test_get_item_by_ticker_no_result(self):
        self.assertEqual(get_item_by_ticker("XRP"), None)

    def test_get_items_after_launch_year(self):
        self.assertEqual(len(get_items_after_launch_year(2000)), 3)

    def test_get_items_after_launch_year_no_results(self):
        self.assertEqual(len(get_items_after_launch_year(2020)), 0)

    def test_get_all_items_ordered_by_launch_year(self):
        result = get_all_items()
        self.assertEqual(result[0], (3, "SOL", "Solana", 2020))
        self.assertEqual(result[1], (2, "ETH", "Ethereum", 2015))
        self.assertEqual(result[2], (1, "BTC", "Bitcoin", 2009))

    def test_add_item(self):
        self.assertEqual(add_item(("PEPE", "Pepe", 2023)), "ok")

    def test_add_item_duplicate(self):
        self.assertEqual(add_item(("BTC", "Bitcoin", 2009)), "ok")

    def test_update_item(self):
        self.assertEqual(update_item(("BTC", "Bitcoin", 2008)), (1, "BTC", "Bitcoin", 2008))

    def test_update_item_not_found(self):
        self.assertEqual(update_item(("XRP", "Ripple", 2012)), None)

    def test_delete_item(self):
        self.assertEqual(delete_item("BTC"), (1, "BTC", "Bitcoin", 2009))

    def test_delete_item_not_found(self):
        self.assertEqual(delete_item("XRP"), None)


if __name__ == "__main__":
    unittest.main()
