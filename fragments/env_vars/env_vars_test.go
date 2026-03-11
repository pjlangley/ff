package env_vars

import (
	"testing"
)

func TestGetEnvVar_Set(t *testing.T) {
	t.Setenv("REPO_NAME_1", "ff")
	result := GetEnvVar("REPO_NAME_1")

	if result != "ff" {
		t.Errorf("Expected 'ff', but got '%s'", result)
	}
}

func TestGetEnvVar_Unset(t *testing.T) {
	result := GetEnvVar("REPO_NAME_1")

	if result != "" {
		t.Errorf("Expected empty string, but got '%s'", result)
	}
}
