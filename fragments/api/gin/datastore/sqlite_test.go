package datastore_test

import (
	"bytes"
	"encoding/json"
	api "ff/api/gin"
	sqlite_crud "ff/sqlite_db"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

var app = api.BuildApp()

func TestSqliteGetCoins(t *testing.T) {
	req, _ := http.NewRequest("GET", "/sqlite/coins", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body []sqlite_crud.CryptoCoin
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if len(body) == 0 {
		t.Errorf("Expected non-empty list of coins but got empty")
	}
}

func TestSqliteGetCoinByTicker(t *testing.T) {
	req, _ := http.NewRequest("GET", "/sqlite/coins/BTC", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body map[string]any
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if body["ticker"] != "BTC" {
		t.Errorf("Expected ticker BTC but got %s", body["ticker"])
	}
}

func TestSqliteGetCoinByTickerNotFound(t *testing.T) {
	req, _ := http.NewRequest("GET", "/sqlite/coins/UNKNOWN", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestSqliteGetCoinByTickerLowercase(t *testing.T) {
	req, _ := http.NewRequest("GET", "/sqlite/coins/btc", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body map[string]any
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if body["ticker"] != "BTC" {
		t.Errorf("Expected ticker BTC but got %s", body["ticker"])
	}
}

func TestSqliteGetCoinsAfterYear(t *testing.T) {
	req, _ := http.NewRequest("GET", "/sqlite/coins/after/2008", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body []sqlite_crud.CryptoCoin
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	for coin := range body {
		if body[coin].Launched <= 2008 {
			t.Errorf("Expected all coins to be launched after 2008 but got %d", body[coin].Launched)
		}
	}
}

func TestSqliteGetCoinsAfterYearNoResults(t *testing.T) {
	req, _ := http.NewRequest("GET", "/sqlite/coins/after/2050", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body []sqlite_crud.CryptoCoin
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if len(body) != 0 {
		t.Errorf("Expected no coins to be returned but got %d", len(body))
	}
}

func TestSqliteCreateNewCoin(t *testing.T) {
	ticker := randomTicker()
	payload := map[string]any{
		"name":     "Test Coin",
		"launched": 2025,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Errorf("Error marshalling payload: %v", err)
	}

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/sqlite/coins/%s", ticker), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}
}

func TestSqliteCreateNewCoinInvalidPayload(t *testing.T) {
	ticker := randomTicker()
	payload := map[string]any{
		"name": "Incomplete Coin",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Errorf("Error marshalling payload: %v", err)
	}

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/sqlite/coins/%s", ticker), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusUnprocessableEntity != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusUnprocessableEntity, recorder.Code)
	}
}

func TestSqliteDeleteCoin(t *testing.T) {
	deleteReq, _ := http.NewRequest("DELETE", "/sqlite/coins/BTC", nil)
	deleteRecorder := httptest.NewRecorder()
	app.ServeHTTP(deleteRecorder, deleteReq)

	if http.StatusNoContent != deleteRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNoContent, deleteRecorder.Code)
	}
}

func TestSqliteDeleteCoinNonExistent(t *testing.T) {
	ticker := randomTicker()
	deleteReq, _ := http.NewRequest("DELETE", fmt.Sprintf("/sqlite/coins/%s", ticker), nil)
	deleteRecorder := httptest.NewRecorder()
	app.ServeHTTP(deleteRecorder, deleteReq)

	if http.StatusNoContent != deleteRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNoContent, deleteRecorder.Code)
	}
}

func TestSqliteUpdateCoin(t *testing.T) {
	updatePayload := map[string]any{
		"name":     "Bitcoin Updated",
		"launched": 2009,
	}
	updateBody, err := json.Marshal(updatePayload)
	if err != nil {
		t.Errorf("Error marshalling update payload: %v", err)
	}
	updateReq, _ := http.NewRequest("PATCH", "/sqlite/coins/BTC", bytes.NewBuffer(updateBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	app.ServeHTTP(updateRecorder, updateReq)

	if http.StatusOK != updateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, updateRecorder.Code)
	}

	var updateBodyResp map[string]any
	err = json.Unmarshal(updateRecorder.Body.Bytes(), &updateBodyResp)

	if err != nil {
		t.Errorf("Error unmarshalling update response body: %v", err)
	}

	if updateBodyResp["ticker"] != "BTC" {
		t.Errorf("Expected ticker BTC but got %s", updateBodyResp["ticker"])
	}

	if updateBodyResp["name"] != "Bitcoin Updated" {
		t.Errorf("Expected updated name 'Bitcoin Updated' but got %s", updateBodyResp["name"])
	}
}

func TestSqliteUpdateCoinNonExistent(t *testing.T) {
	ticker := randomTicker()
	updatePayload := map[string]any{
		"name":     "Non-Existent Coin",
		"launched": 2026,
	}
	updateBody, err := json.Marshal(updatePayload)
	if err != nil {
		t.Errorf("Error marshalling update payload: %v", err)
	}
	updateReq, _ := http.NewRequest("PATCH", fmt.Sprintf("/sqlite/coins/%s", ticker), bytes.NewBuffer(updateBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	app.ServeHTTP(updateRecorder, updateReq)

	if http.StatusNotFound != updateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, updateRecorder.Code)
	}
}
