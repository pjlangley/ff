package blockchain_test

import (
	"bytes"
	"encoding/json"
	api "ff/api/gin"
	"net/http"
	"net/http/httptest"
	"testing"
)

var usernameApp = api.BuildApp()

func TestSolanaGetUsernameNotFound(t *testing.T) {
	req, _ := http.NewRequest("GET", "/solana/username/11111111111111111111111111111111", nil)
	recorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestSolanaUpdateUsernameNotFound(t *testing.T) {
	body := []byte(`{"username": "alice"}`)
	req, _ := http.NewRequest("PATCH", "/solana/username/11111111111111111111111111111111", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestSolanaGetUsernameRecordAddressNotFound(t *testing.T) {
	req, _ := http.NewRequest("GET", "/solana/username/11111111111111111111111111111111/record/0", nil)
	recorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestSolanaInitialiseUsername(t *testing.T) {
	body := []byte(`{"username": "alice"}`)
	req, _ := http.NewRequest("POST", "/solana/username/initialise", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var initBody map[string]string
	err := json.Unmarshal(recorder.Body.Bytes(), &initBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	address, ok := initBody["address"]
	if !ok || address == "" {
		t.Errorf("Expected address in response but got: %v", initBody)
	}
}

func TestSolanaGetUsername(t *testing.T) {
	// First initialise a username
	initBody := []byte(`{"username": "alice"}`)
	initReq, _ := http.NewRequest("POST", "/solana/username/initialise", bytes.NewBuffer(initBody))
	initReq.Header.Set("Content-Type", "application/json")
	initRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(initRecorder, initReq)

	if http.StatusOK != initRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, initRecorder.Code)
	}

	var initResponse map[string]string
	err := json.Unmarshal(initRecorder.Body.Bytes(), &initResponse)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	address := initResponse["address"]

	// Then get the username
	getReq, _ := http.NewRequest("GET", "/solana/username/"+address, nil)
	getRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(getRecorder, getReq)

	if http.StatusOK != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, getRecorder.Code)
	}

	var getBody map[string]interface{}
	err = json.Unmarshal(getRecorder.Body.Bytes(), &getBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if getBody["username"] != "alice" {
		t.Errorf("Expected username 'alice' but got: %v", getBody["username"])
	}
	if getBody["change_count"] != "0" {
		t.Errorf("Expected change_count '0' but got: %v", getBody["change_count"])
	}
	if getBody["username_recent_history"] == nil {
		t.Errorf("Expected username_recent_history to be set but got nil")
	}
}

func TestSolanaUpdateUsername(t *testing.T) {
	// First initialise a username
	initBody := []byte(`{"username": "alice"}`)
	initReq, _ := http.NewRequest("POST", "/solana/username/initialise", bytes.NewBuffer(initBody))
	initReq.Header.Set("Content-Type", "application/json")
	initRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(initRecorder, initReq)

	if http.StatusOK != initRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, initRecorder.Code)
	}

	var initResponse map[string]string
	err := json.Unmarshal(initRecorder.Body.Bytes(), &initResponse)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	address := initResponse["address"]

	// Update the username
	updateBody := []byte(`{"username": "bob"}`)
	updateReq, _ := http.NewRequest("PATCH", "/solana/username/"+address, bytes.NewBuffer(updateBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(updateRecorder, updateReq)

	if http.StatusOK != updateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, updateRecorder.Code)
	}

	// Verify the username was updated
	getReq, _ := http.NewRequest("GET", "/solana/username/"+address, nil)
	getRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(getRecorder, getReq)

	if http.StatusOK != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, getRecorder.Code)
	}

	var getBody map[string]interface{}
	err = json.Unmarshal(getRecorder.Body.Bytes(), &getBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if getBody["username"] != "bob" {
		t.Errorf("Expected username 'bob' but got: %v", getBody["username"])
	}
}

func TestSolanaGetUsernameRecord(t *testing.T) {
	// First initialise a username
	initBody := []byte(`{"username": "alice"}`)
	initReq, _ := http.NewRequest("POST", "/solana/username/initialise", bytes.NewBuffer(initBody))
	initReq.Header.Set("Content-Type", "application/json")
	initRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(initRecorder, initReq)

	if http.StatusOK != initRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, initRecorder.Code)
	}

	var initResponse map[string]string
	err := json.Unmarshal(initRecorder.Body.Bytes(), &initResponse)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	address := initResponse["address"]

	// Update the username (this creates a record)
	updateBody := []byte(`{"username": "bob"}`)
	updateReq, _ := http.NewRequest("PATCH", "/solana/username/"+address, bytes.NewBuffer(updateBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(updateRecorder, updateReq)

	if http.StatusOK != updateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, updateRecorder.Code)
	}

	// Get the username record
	recordReq, _ := http.NewRequest("GET", "/solana/username/"+address+"/record/0", nil)
	recordRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(recordRecorder, recordReq)

	if http.StatusOK != recordRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recordRecorder.Code)
	}

	var recordBody map[string]interface{}
	err = json.Unmarshal(recordRecorder.Body.Bytes(), &recordBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if recordBody["old_username"] != "alice" {
		t.Errorf("Expected old_username 'alice' but got: %v", recordBody["old_username"])
	}
	if recordBody["change_index"] != "0" {
		t.Errorf("Expected change_index '0' but got: %v", recordBody["change_index"])
	}
	if recordBody["authority"] != address {
		t.Errorf("Expected authority '%s' but got: %v", address, recordBody["authority"])
	}
}

func TestSolanaGetUsernameRecordNotFound(t *testing.T) {
	// First initialise a username
	initBody := []byte(`{"username": "alice"}`)
	initReq, _ := http.NewRequest("POST", "/solana/username/initialise", bytes.NewBuffer(initBody))
	initReq.Header.Set("Content-Type", "application/json")
	initRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(initRecorder, initReq)

	if http.StatusOK != initRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, initRecorder.Code)
	}

	var initResponse map[string]string
	err := json.Unmarshal(initRecorder.Body.Bytes(), &initResponse)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	address := initResponse["address"]

	// Attempt to get a non-existent username record, but valid address
	recordReq, _ := http.NewRequest("GET", "/solana/username/"+address+"/record/0", nil)
	recordRecorder := httptest.NewRecorder()
	usernameApp.ServeHTTP(recordRecorder, recordReq)

	if http.StatusNotFound != recordRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recordRecorder.Code)
	}
}
