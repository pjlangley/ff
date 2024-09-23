package sql_queries

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
