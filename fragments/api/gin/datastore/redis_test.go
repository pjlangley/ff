package datastore_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRedisPing(t *testing.T) {
	req, _ := http.NewRequest("GET", "/redis/ping", nil)
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

	if body["message"] != "PONG" {
		t.Errorf("Expected message PONG but got %s", body["message"])
	}
}

func TestRedisGetFavourite(t *testing.T) {
	namespace := createRandomNamespace(t, "BTC")

	req, _ := http.NewRequest("GET", fmt.Sprintf("/redis/favourites/%s", namespace), nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var responseBody map[string]any
	err := json.Unmarshal(recorder.Body.Bytes(), &responseBody)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if responseBody["favourite_coin"] != "BTC" {
		t.Errorf("Expected favourite_coin BTC but got %s", responseBody["favourite_coin"])
	}
}

func TestRedisGetFavouriteNotFound(t *testing.T) {
	namespace := randomTicker()
	req, _ := http.NewRequest("GET", fmt.Sprintf("/redis/favourites/%s", namespace), nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestRedisCreateFavouriteInvalidPayload(t *testing.T) {
	namespace := randomTicker()
	payload := map[string]any{
		"invalid_field": "value",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Errorf("Error marshalling payload: %v", err)
	}

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/redis/favourites/%s", namespace), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusUnprocessableEntity != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusUnprocessableEntity, recorder.Code)
	}
}

func TestRedisUpdateFavourite(t *testing.T) {
	namespace := createRandomNamespace(t, "BTC")

	updatePayload := map[string]any{
		"favourite_coin": "SOL",
	}
	updateBody, err := json.Marshal(updatePayload)
	if err != nil {
		t.Errorf("Error marshalling update payload: %v", err)
	}
	updateReq, _ := http.NewRequest("PATCH", fmt.Sprintf("/redis/favourites/%s", namespace), bytes.NewBuffer(updateBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	app.ServeHTTP(updateRecorder, updateReq)

	if http.StatusOK != updateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, updateRecorder.Code)
	}

	getReq, _ := http.NewRequest("GET", fmt.Sprintf("/redis/favourites/%s", namespace), nil)
	getRecorder := httptest.NewRecorder()
	app.ServeHTTP(getRecorder, getReq)

	if http.StatusOK != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, getRecorder.Code)
	}

	var getBody map[string]any
	err = json.Unmarshal(getRecorder.Body.Bytes(), &getBody)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if getBody["favourite_coin"] != "SOL" {
		t.Errorf("Expected favourite_coin SOL but got %s", getBody["favourite_coin"])
	}
}

func TestRedisDeleteFavourite(t *testing.T) {
	namespace := createRandomNamespace(t, "BTC")

	deleteReq, _ := http.NewRequest("DELETE", fmt.Sprintf("/redis/favourites/%s", namespace), nil)
	deleteRecorder := httptest.NewRecorder()
	app.ServeHTTP(deleteRecorder, deleteReq)

	if http.StatusNoContent != deleteRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNoContent, deleteRecorder.Code)
	}

	getReq, _ := http.NewRequest("GET", fmt.Sprintf("/redis/favourites/%s", namespace), nil)
	getRecorder := httptest.NewRecorder()
	app.ServeHTTP(getRecorder, getReq)

	if http.StatusNotFound != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, getRecorder.Code)
	}
}

func TestRedisDeleteFavouriteNonExistent(t *testing.T) {
	namespace := randomTicker()
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("/redis/favourites/%s", namespace), nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusNoContent != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNoContent, recorder.Code)
	}
}

func createRandomNamespace(t *testing.T, ticker string) string {
	namespace := randomTicker()
	payload := map[string]any{
		"favourite_coin": ticker,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Errorf("Error marshalling payload: %v", err)
	}

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/redis/favourites/%s", namespace), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	return namespace
}
