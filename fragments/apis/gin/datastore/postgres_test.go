package datastore_test

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	postgres_crud "ff/postgres_db"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPostgresGetCoins(t *testing.T) {
	req, _ := http.NewRequest("GET", "/postgres/coins", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body []postgres_crud.CryptoCoin
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if len(body) == 0 {
		t.Errorf("Expected non-empty list of coins but got empty")
	}
}

func TestPostgresGetCoinByTicker(t *testing.T) {
	req, _ := http.NewRequest("GET", "/postgres/coins/BTC", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body postgres_crud.CryptoCoin
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if body.Ticker != "BTC" {
		t.Errorf("Expected ticker BTC but got %s", body.Ticker)
	}
}

func TestPostgresGetCoinByTickerNotFound(t *testing.T) {
	req, _ := http.NewRequest("GET", "/postgres/coins/UNKNOWN", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestPostgresGetCoinByTickerLowercase(t *testing.T) {
	req, _ := http.NewRequest("GET", "/postgres/coins/eth", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body postgres_crud.CryptoCoin
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if body.Ticker != "ETH" {
		t.Errorf("Expected ticker ETH but got %s", body.Ticker)
	}
}

func TestPostgresGetCoinsAfterYear(t *testing.T) {
	req, _ := http.NewRequest("GET", "/postgres/coins/after/2008", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body []postgres_crud.CryptoCoin
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

func TestPostgresGetCoinsAfterYearNoResults(t *testing.T) {
	req, _ := http.NewRequest("GET", "/postgres/coins/after/2050", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body []postgres_crud.CryptoCoin
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if len(body) != 0 {
		t.Errorf("Expected no coins to be returned but got %d", len(body))
	}
}

func TestPostgresCreateNewCoin(t *testing.T) {
	ticker := randomTicker()
	payload := map[string]any{
		"name":     "Test Coin",
		"launched": 2025,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Errorf("Error marshalling payload: %v", err)
	}

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/postgres/coins/%s", ticker), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	getReq, _ := http.NewRequest("GET", fmt.Sprintf("/postgres/coins/%s", ticker), nil)
	getRecorder := httptest.NewRecorder()
	app.ServeHTTP(getRecorder, getReq)

	if http.StatusOK != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, getRecorder.Code)
	}

	var getBody postgres_crud.CryptoCoin
	err = json.Unmarshal(getRecorder.Body.Bytes(), &getBody)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if getBody.Ticker != ticker {
		t.Errorf("Expected ticker %s but got %s", ticker, getBody.Ticker)
	}
}

func TestPostgresCreateNewCoinInvalidPayload(t *testing.T) {
	ticker := randomTicker()
	payload := map[string]any{
		"name": "Incomplete Coin",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Errorf("Error marshalling payload: %v", err)
	}

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/postgres/coins/%s", ticker), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusUnprocessableEntity != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusUnprocessableEntity, recorder.Code)
	}
}

func TestPostgresDeleteCoin(t *testing.T) {
	ticker := randomTicker()
	payload := map[string]any{
		"name":     "Delete Coin",
		"launched": 2025,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Errorf("Error marshalling payload: %v", err)
	}

	createReq, _ := http.NewRequest("PUT", fmt.Sprintf("/postgres/coins/%s", ticker), bytes.NewBuffer(body))
	createReq.Header.Set("Content-Type", "application/json")
	createRecorder := httptest.NewRecorder()
	app.ServeHTTP(createRecorder, createReq)

	if http.StatusOK != createRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, createRecorder.Code)
	}

	deleteReq, _ := http.NewRequest("DELETE", fmt.Sprintf("/postgres/coins/%s", ticker), nil)
	deleteRecorder := httptest.NewRecorder()
	app.ServeHTTP(deleteRecorder, deleteReq)

	if http.StatusNoContent != deleteRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNoContent, deleteRecorder.Code)
	}

	getReq, _ := http.NewRequest("GET", fmt.Sprintf("/postgres/coins/%s", ticker), nil)
	getRecorder := httptest.NewRecorder()
	app.ServeHTTP(getRecorder, getReq)

	if http.StatusNotFound != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, getRecorder.Code)
	}
}

func TestPostgresDeleteCoinNonExistent(t *testing.T) {
	ticker := randomTicker()

	deleteReq, _ := http.NewRequest("DELETE", fmt.Sprintf("/postgres/coins/%s", ticker), nil)
	deleteRecorder := httptest.NewRecorder()
	app.ServeHTTP(deleteRecorder, deleteReq)

	if http.StatusNoContent != deleteRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNoContent, deleteRecorder.Code)
	}
}

func TestPostgresUpdateCoin(t *testing.T) {
	ticker := randomTicker()
	payload := map[string]any{
		"name":     "Update Coin",
		"launched": 2025,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Errorf("Error marshalling payload: %v", err)
	}

	createReq, _ := http.NewRequest("PUT", fmt.Sprintf("/postgres/coins/%s", ticker), bytes.NewBuffer(body))
	createReq.Header.Set("Content-Type", "application/json")
	createRecorder := httptest.NewRecorder()
	app.ServeHTTP(createRecorder, createReq)

	if http.StatusOK != createRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, createRecorder.Code)
	}

	updatePayload := map[string]any{
		"name":     "Updated Coin Name",
		"launched": 2026,
	}
	updateBody, err := json.Marshal(updatePayload)
	if err != nil {
		t.Errorf("Error marshalling update payload: %v", err)
	}
	updateReq, _ := http.NewRequest("PATCH", fmt.Sprintf("/postgres/coins/%s", ticker), bytes.NewBuffer(updateBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	app.ServeHTTP(updateRecorder, updateReq)

	if http.StatusOK != updateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, updateRecorder.Code)
	}

	var updateBodyResp postgres_crud.CryptoCoin
	err = json.Unmarshal(updateRecorder.Body.Bytes(), &updateBodyResp)

	if err != nil {
		t.Errorf("Error unmarshalling update response body: %v", err)
	}

	if updateBodyResp.Name != "Updated Coin Name" {
		t.Errorf("Expected updated name 'Updated Coin Name' but got %s", updateBodyResp.Name)
	}

	if updateBodyResp.Launched != 2026 {
		t.Errorf("Expected updated launched year 2026 but got %d", updateBodyResp.Launched)
	}
}

func TestPostgresUpdateCoinNonExistent(t *testing.T) {
	ticker := randomTicker()

	updatePayload := map[string]any{
		"name":     "Non-Existent Coin",
		"launched": 2026,
	}
	updateBody, err := json.Marshal(updatePayload)
	if err != nil {
		t.Errorf("Error marshalling update payload: %v", err)
	}
	updateReq, _ := http.NewRequest("PATCH", fmt.Sprintf("/postgres/coins/%s", ticker), bytes.NewBuffer(updateBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	app.ServeHTTP(updateRecorder, updateReq)

	if http.StatusNotFound != updateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, updateRecorder.Code)
	}
}

func randomTicker() string {
	buf := make([]byte, 3)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return strings.ToUpper(hex.EncodeToString(buf))
}
