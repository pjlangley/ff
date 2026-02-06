package blockchain_test

import (
	"encoding/json"
	api "ff/apis/gin"
	"net/http"
	"net/http/httptest"
	"testing"
)

var balanceApp = api.BuildApp()

func TestSolanaGetBalanceValidAddress(t *testing.T) {
	req, _ := http.NewRequest("GET", "/solana/balance/111111111111111111111111111111aa", nil)
	recorder := httptest.NewRecorder()
	balanceApp.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body map[string]string
	err := json.Unmarshal(recorder.Body.Bytes(), &body)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	balance, ok := body["balance"]
	if !ok {
		t.Errorf("Expected balance in response but got: %v", body)
	}

	if balance != "0" {
		t.Errorf("Expected balance to be \"0\" but got: %v", balance)
	}
}

func TestSolanaGetBalanceInvalidAddress(t *testing.T) {
	req, _ := http.NewRequest("GET", "/solana/balance/22222222222222222222222222222222", nil)
	recorder := httptest.NewRecorder()
	balanceApp.ServeHTTP(recorder, req)

	if http.StatusBadRequest != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusBadRequest, recorder.Code)
	}
}
