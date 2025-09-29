package postgres_crud

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
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
	coin, err := GetItemByTicker(randomTicker())

	if err != nil {
		t.Error("expected no error if coin wasn't found")
	}

	if coin != nil {
		t.Error("expected coin to be 'nil'")
	}
}

func TestGetItemsAfterLaunchYear(t *testing.T) {
	coins, _ := GetItemsAfterLaunchYear(2000)

	if len(coins) < 3 {
		t.FailNow()
	}
}

func TestGetItemsAfterLaunchYear_NoResults(t *testing.T) {
	coins, _ := GetItemsAfterLaunchYear(2050)

	if len(coins) != 0 {
		t.FailNow()
	}
}

func TestGetAllItems(t *testing.T) {
	coins, _ := GetAllItems()

	if len(coins) < 3 {
		t.FailNow()
	}
}

func TestCreateItem(t *testing.T) {
	ticker := randomTicker()
	result, _ := CreateItem(CryptoCoinWithoutId{Ticker: ticker, Name: "Newcoin", Launched: 2025})

	if result != "ok" {
		t.FailNow()
	}

	t.Cleanup(func() {
		_, err := DeleteItem(ticker)
		if err != nil {
			t.Logf("failed to delete item '%s': %v", ticker, err)
		}
	})
}

func TestUpdateItem(t *testing.T) {
	ticker := randomTicker()
	_, err := CreateItem(CryptoCoinWithoutId{Ticker: ticker, Name: "Newcoin", Launched: 2025})
	if err != nil {
		t.FailNow()
	}
	coin, _ := UpdateItem(CryptoCoinWithoutId{Ticker: ticker, Name: "Newcoin2", Launched: 2009})

	if coin.ticker != ticker {
		t.FailNow()
	}
}

func TestUpdateItem_NotFound(t *testing.T) {
	coin, err := UpdateItem(CryptoCoinWithoutId{Ticker: randomTicker(), Name: "Unknown", Launched: 2025})
	if coin != nil {
		t.Error("expected coin to be 'nil'")
	}
	if err == nil {
		t.Errorf("expected error %v", err)
	}
}

func TestDeleteItem(t *testing.T) {
	ticker := randomTicker()
	_, err := CreateItem(CryptoCoinWithoutId{Ticker: ticker, Name: "Rando", Launched: 2012})
	if err != nil {
		t.Logf("failed to create item '%s': %v", ticker, err)
	}

	coin, _ := DeleteItem(ticker)
	if coin == nil {
		t.FailNow()
	}
}

func TestDeleteItem_NotFound(t *testing.T) {
	ticker := randomTicker()
	coin, _ := DeleteItem(ticker)
	if coin != nil {
		t.FailNow()
	}
}

func randomTicker() string {
	bytes := make([]byte, 6)
	_, err := rand.Read(bytes)
	if err != nil {
		panic(err)
	}
	return strings.ToUpper(hex.EncodeToString(bytes)[:6])
}
