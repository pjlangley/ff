package blockchain_test

import (
	"encoding/json"
	api "ff/apis/gin"
	"ff/solana_rpc"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

var roundApp = api.BuildApp()

func TestGetRoundNotFound(t *testing.T) {
	req, _ := http.NewRequest("GET", "/solana/round/11111111111111111111111111111111", nil)
	recorder := httptest.NewRecorder()
	roundApp.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestActivateRoundNotFound(t *testing.T) {
	req, _ := http.NewRequest("PATCH", "/solana/round/11111111111111111111111111111111/activate", nil)
	recorder := httptest.NewRecorder()
	roundApp.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestCompleteRoundNotFound(t *testing.T) {
	req, _ := http.NewRequest("PATCH", "/solana/round/11111111111111111111111111111111/complete", nil)
	recorder := httptest.NewRecorder()
	roundApp.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestInitialiseRound(t *testing.T) {
	req, _ := http.NewRequest("POST", "/solana/round/initialise", nil)
	recorder := httptest.NewRecorder()
	roundApp.ServeHTTP(recorder, req)

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

	startSlot, ok := initBody["start_slot"]
	if !ok || startSlot == "" {
		t.Errorf("Expected start_slot in response but got: %v", initBody)
	}

	// Verify round was initialised in pending state
	getReq, _ := http.NewRequest("GET", "/solana/round/"+address, nil)
	getRecorder := httptest.NewRecorder()
	roundApp.ServeHTTP(getRecorder, getReq)

	if http.StatusOK != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, getRecorder.Code)
	}

	var getBody map[string]interface{}
	err = json.Unmarshal(getRecorder.Body.Bytes(), &getBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if getBody["start_slot"] == nil || getBody["start_slot"] == "" {
		t.Errorf("Expected start_slot in response but got: %v", getBody)
	}
	if getBody["authority"] == nil || getBody["authority"] == "" {
		t.Errorf("Expected authority in response but got: %v", getBody)
	}
	if getBody["activated_at"] != nil {
		t.Errorf("Expected activated_at to be null but got: %v", getBody["activated_at"])
	}
	if getBody["activated_by"] != nil {
		t.Errorf("Expected activated_by to be null but got: %v", getBody["activated_by"])
	}
	if getBody["completed_at"] != nil {
		t.Errorf("Expected completed_at to be null but got: %v", getBody["completed_at"])
	}
}

func TestActivateRound(t *testing.T) {
	// First initialise a round
	initReq, _ := http.NewRequest("POST", "/solana/round/initialise", nil)
	initRecorder := httptest.NewRecorder()
	roundApp.ServeHTTP(initRecorder, initReq)

	if http.StatusOK != initRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, initRecorder.Code)
	}

	var initBody map[string]string
	err := json.Unmarshal(initRecorder.Body.Bytes(), &initBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	address := initBody["address"]
	startSlotStr := initBody["start_slot"]
	startSlot, err := strconv.ParseUint(startSlotStr, 10, 64)
	if err != nil {
		t.Errorf("Error parsing start_slot: %v", err)
	}

	// Wait for the start slot to be reached
	atSlot, err := solana_rpc.WaitForSlot(startSlot, nil)
	if err != nil {
		t.Errorf("Error waiting for slot: %v", err)
	}
	if !atSlot {
		t.Errorf("Round start slot %d not reached within timeout", startSlot)
	}

	// Activate the round
	activateReq, _ := http.NewRequest("PATCH", "/solana/round/"+address+"/activate", nil)
	activateRecorder := httptest.NewRecorder()
	roundApp.ServeHTTP(activateRecorder, activateReq)

	if http.StatusOK != activateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, activateRecorder.Code)
	}

	// Verify the round is now activated
	getReq, _ := http.NewRequest("GET", "/solana/round/"+address, nil)
	getRecorder := httptest.NewRecorder()
	roundApp.ServeHTTP(getRecorder, getReq)

	if http.StatusOK != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, getRecorder.Code)
	}

	var getBody map[string]interface{}
	err = json.Unmarshal(getRecorder.Body.Bytes(), &getBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if getBody["activated_at"] == nil {
		t.Errorf("Expected activated_at to be set but got nil")
	}
	if getBody["activated_by"] == nil {
		t.Errorf("Expected activated_by to be set but got nil")
	}
	if getBody["completed_at"] != nil {
		t.Errorf("Expected completed_at to be null but got: %v", getBody["completed_at"])
	}
}

func TestCompleteRound(t *testing.T) {
	// First initialise a round
	initReq, _ := http.NewRequest("POST", "/solana/round/initialise", nil)
	initRecorder := httptest.NewRecorder()
	roundApp.ServeHTTP(initRecorder, initReq)

	if http.StatusOK != initRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, initRecorder.Code)
	}

	var initBody map[string]string
	err := json.Unmarshal(initRecorder.Body.Bytes(), &initBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	address := initBody["address"]
	startSlotStr := initBody["start_slot"]
	startSlot, err := strconv.ParseUint(startSlotStr, 10, 64)
	if err != nil {
		t.Errorf("Error parsing start_slot: %v", err)
	}

	// Wait for the start slot to be reached
	atSlot, err := solana_rpc.WaitForSlot(startSlot, nil)
	if err != nil {
		t.Errorf("Error waiting for slot: %v", err)
	}
	if !atSlot {
		t.Errorf("Round start slot %d not reached within timeout", startSlot)
	}

	// Activate the round
	activateReq, _ := http.NewRequest("PATCH", "/solana/round/"+address+"/activate", nil)
	activateRecorder := httptest.NewRecorder()
	roundApp.ServeHTTP(activateRecorder, activateReq)

	if http.StatusOK != activateRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, activateRecorder.Code)
	}

	// Complete the round
	completeReq, _ := http.NewRequest("PATCH", "/solana/round/"+address+"/complete", nil)
	completeRecorder := httptest.NewRecorder()
	roundApp.ServeHTTP(completeRecorder, completeReq)

	if http.StatusOK != completeRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, completeRecorder.Code)
	}

	// Verify the round is now completed
	getReq, _ := http.NewRequest("GET", "/solana/round/"+address, nil)
	getRecorder := httptest.NewRecorder()
	roundApp.ServeHTTP(getRecorder, getReq)

	if http.StatusOK != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, getRecorder.Code)
	}

	var getBody map[string]interface{}
	err = json.Unmarshal(getRecorder.Body.Bytes(), &getBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if getBody["activated_at"] == nil {
		t.Errorf("Expected activated_at to be set but got nil")
	}
	if getBody["activated_by"] == nil {
		t.Errorf("Expected activated_by to be set but got nil")
	}
	if getBody["completed_at"] == nil {
		t.Errorf("Expected completed_at to be set but got nil")
	}
}
