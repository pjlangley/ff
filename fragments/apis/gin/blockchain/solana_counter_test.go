package blockchain_test

import (
	"encoding/json"
	api "ff/apis/gin"
	"net/http"
	"net/http/httptest"
	"testing"
)

var app = api.BuildApp()

func TestGetCounterNotFound(t *testing.T) {
	req, _ := http.NewRequest("GET", "/solana/counter/11111111111111111111111111111111", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestIncrementCounterNotFound(t *testing.T) {
	req, _ := http.NewRequest("PATCH", "/solana/counter/11111111111111111111111111111111/increment", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusNotFound != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestInitialiseCounter(t *testing.T) {
	req, _ := http.NewRequest("POST", "/solana/counter/initialise", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

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

	// Verify counter was initialised with count of 0
	getReq, _ := http.NewRequest("GET", "/solana/counter/"+address, nil)
	getRecorder := httptest.NewRecorder()
	app.ServeHTTP(getRecorder, getReq)

	if http.StatusOK != getRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, getRecorder.Code)
	}

	var getBody map[string]string
	err = json.Unmarshal(getRecorder.Body.Bytes(), &getBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if getBody["count"] != "0" {
		t.Errorf("Expected count to be '0' but got '%s'", getBody["count"])
	}
}

func TestIncrementCounter(t *testing.T) {
	// First initialise a counter
	initReq, _ := http.NewRequest("POST", "/solana/counter/initialise", nil)
	initRecorder := httptest.NewRecorder()
	app.ServeHTTP(initRecorder, initReq)

	if http.StatusOK != initRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, initRecorder.Code)
	}

	var initBody map[string]string
	err := json.Unmarshal(initRecorder.Body.Bytes(), &initBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	address := initBody["address"]

	// Increment the counter
	incrementReq, _ := http.NewRequest("PATCH", "/solana/counter/"+address+"/increment", nil)
	incrementRecorder := httptest.NewRecorder()
	app.ServeHTTP(incrementRecorder, incrementReq)

	if http.StatusOK != incrementRecorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, incrementRecorder.Code)
	}

	var incrementBody map[string]string
	err = json.Unmarshal(incrementRecorder.Body.Bytes(), &incrementBody)
	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if incrementBody["new_count"] != "1" {
		t.Errorf("Expected new_count to be '1' but got '%s'", incrementBody["new_count"])
	}
}
