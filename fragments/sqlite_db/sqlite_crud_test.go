package sqlite_crud

import (
	"testing"
)

func TestGetItemByTicker(t *testing.T) {
	result := GetItemByTicker("BTC")

	if result == nil {
		t.Error("Expected coin 'BTC' to exist")
	}
}

func TestGetItemByTicker_NotFound(t *testing.T) {
	result := GetItemByTicker("XRP")

	if result != nil {
		t.Error("Expected query for XRP to be 'nil'")
	}
}

func TestGetItemsAfterLaunchYear(t *testing.T) {
	result := GetItemsAfterLaunchYear(2000)

	if len(result) != 3 {
		t.Errorf("Expected 3 results, but got %d", len(result))
	}
}

func TestGetItemsAfterLaunchYear_NoResults(t *testing.T) {
	result := GetItemsAfterLaunchYear(2020)

	if len(result) != 0 {
		t.Errorf("Expected 0 results, but got %d", len(result))
	}
}

func TestGetAllItems(t *testing.T) {
	result := GetAllItems()

	if result[0].ticker != "SOL" {
		t.Errorf("Expected first item to be SOL, but got %s", result[0].ticker)
	}
	if result[1].ticker != "ETH" {
		t.Errorf("Expected first item to be ETH, but got %s", result[1].ticker)
	}
	if result[2].ticker != "BTC" {
		t.Errorf("Expected first item to be BTC, but got %s", result[2].ticker)
	}
}

func TestAddItem(t *testing.T) {
	coin := CryptoCoinWithoutId{Ticker: "PEPE", Name: "Pepe", Launched: 2023}
	_, newId := AddItem(coin)

	if newId != 4 {
		t.Errorf("Expected 'newId' to be 4, but got %d instead", newId)
	}
}

func TestAddItemDuplicate(t *testing.T) {
	coin := CryptoCoinWithoutId{Ticker: "BTC", Name: "Bitcoin", Launched: 2009}
	_, newId := AddItem(coin)

	if newId != 3 {
		t.Errorf("Expected 'newId' to be 3, but got %d instead", newId)
	}
}

func TestUpdateItem(t *testing.T) {
	coin := CryptoCoinWithoutId{Ticker: "BTC", Name: "Bitcoin", Launched: 2008}
	result := UpdateItem(coin)

	if result == nil {
		t.Error("Expected update to return coin")
		t.FailNow()
	}

	if result.ticker != "BTC" {
		t.Errorf("Expected ticker to be BTC, but got %s", result.ticker)
	}
}

func TestUpdateItem_NotFound(t *testing.T) {
	coin := CryptoCoinWithoutId{Ticker: "XRP", Name: "Ripple", Launched: 2012}
	result := UpdateItem(coin)

	if result != nil {
		t.FailNow()
	}
}

func TestDeleteItem(t *testing.T) {
	result := DeleteItem("ETH")

	if result == nil {
		t.Error("Expected delete to return coin")
		t.FailNow()
	}

	if result.ticker != "ETH" {
		t.Errorf("Expected ticker to be ETH, but got %s", result.ticker)
	}
}

func TestDeleteItem_NotFound(t *testing.T) {
	result := DeleteItem("XRP")

	if result != nil {
		t.FailNow()
	}
}
