package datastore_test

import (
	"encoding/json"
	api "ff/api/gin"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPostgresRoutesPing(t *testing.T) {
	app := api.BuildApp()
	req, _ := http.NewRequest("GET", "/postgres/ping", nil)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if http.StatusOK != recorder.Code {
		t.Errorf("Expected status code %d but got %d", http.StatusOK, recorder.Code)
	}

	var body map[string]string
	err := json.Unmarshal(recorder.Body.Bytes(), &body)

	if err != nil {
		t.Errorf("Error unmarshalling response body: %v", err)
	}

	if body["message"] != "PONG" {
		t.Errorf("Expected message PONG but got %s", body["message"])
	}
}
