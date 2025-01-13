package postgres_crud

import (
	"testing"
)

func TestGetItemByTicker(t *testing.T) {
	coin, err := GetItemByTicker("BTC")

	if err != nil {
		t.Error("expected coin 'BTC' to exist")
	}

	if coin.ticker != "BTC" {
		t.Error("Expected coin with ticker 'BTC'")
	}
}

func TestGetItemByTicker_NotFound(t *testing.T) {
	coin, err := GetItemByTicker("FAKECOIN")

	if err != nil {
		t.Error("expected no error if coin wasn't found")
	}

	if coin != nil {
		t.Error("expected coin to be 'nil'")
	}
}

func TestGetItemsAfterLaunchYear(t *testing.T) {
	coins, _ := GetItemsAfterLaunchYear(2010)

	if len(coins) != 2 {
		t.FailNow()
	}
}

func TestGetItemsAfterLaunchYear_NoResults(t *testing.T) {
	coins, _ := GetItemsAfterLaunchYear(2025)

	if len(coins) != 0 {
		t.FailNow()
	}
}

func TestGetAllItems(t *testing.T) {
	coins, _ := GetAllItems()

	if coins[0].ticker != "SOL" {
		t.Error("expected first item to be 'SOL'")
	}
	if coins[1].ticker != "ETH" {
		t.Error("expected second item to be 'ETH'")
	}
	if coins[2].ticker != "BTC" {
		t.Error("expected third item to be 'BTC'")
	}
}

func TestCreateItem(t *testing.T) {
	result, _ := CreateItem(CryptoCoinWithoutId{Ticker: "NEWCOIN", Name: "Newcoin", Launched: 2025})

	if result != "ok" {
		t.FailNow()
	}

	t.Cleanup(func() {
		_, err := DeleteItem("NEWCOIN")
		if err != nil {
			t.Logf("failed to delete item 'NEWCOIN': %v", err)
		}
	})
}

func TestUpdateItem(t *testing.T) {
	coin, _ := UpdateItem(CryptoCoinWithoutId{Ticker: "BTC", Name: "Bitcoin", Launched: 2009})

	if coin.ticker != "BTC" {
		t.FailNow()
	}
}

func TestUpdateItem_NotFound(t *testing.T) {
	coin, err := UpdateItem(CryptoCoinWithoutId{Ticker: "UNKNOWN", Name: "Unknown", Launched: 2025})
	if coin != nil {
		t.Error("expected coin to be 'nil'")
	}
	if err == nil {
		t.Errorf("expected error %v", err)
	}
}

func TestDeleteItem(t *testing.T) {
	_, err := CreateItem(CryptoCoinWithoutId{Ticker: "XRP", Name: "Ripple", Launched: 2012})
	if err != nil {
		t.Logf("failed to create item 'XRP': %v", err)
	}

	coin, _ := DeleteItem("XRP")
	if coin == nil {
		t.FailNow()
	}
}

func TestDeleteItem_NotFound(t *testing.T) {
	coin, _ := DeleteItem("XRP")
	if coin != nil {
		t.FailNow()
	}
}
