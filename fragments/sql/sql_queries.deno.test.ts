import { add_item, get_all_items, get_item_by_ticker, get_items_after_launch_year } from "./sql_queries.deno.ts";
import { assertEquals, assertThrows } from "std/assert/mod.ts";

Deno.test("sql queries: getting by ticker returns result", () => {
  const result = get_item_by_ticker("BTC");
  assertEquals(result!.ticker, "BTC");
  assertEquals(result!.name, "Bitcoin");
  assertEquals(result!.launched, 2009);
});

Deno.test("sql queries: getting by ticker returns no result", () => {
  assertEquals(get_item_by_ticker("XRP"), undefined);
});

Deno.test("sql queries: get items after launch year returns results", async () => {
  const result = await get_items_after_launch_year(2000);
  assertEquals(result.length, 3);
});

Deno.test("sql queries: get items after launch year returns no results", async () => {
  const result = await get_items_after_launch_year(2020);
  assertEquals(result.length, 0);
});

Deno.test("sql queries: get all items is ordered by launch year", async () => {
  const result = await get_all_items();
  assertEquals(result[0].ticker, "SOL");
  assertEquals(result[1].ticker, "ETH");
  assertEquals(result[2].ticker, "BTC");
});

Deno.test("sql queries: adds an item to the database table", () => {
  assertEquals(add_item({ ticker: "PEPE", name: "Pepe", launched: 2023 }), 1);
});

Deno.test("sql queries: adding an item to the database table fails - ticker exists", () => {
  assertThrows(() => add_item({ ticker: "BTC", name: "Bitcoin", launched: 2009 }));
});
