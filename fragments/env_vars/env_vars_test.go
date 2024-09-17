package env_vars

import (
	"os"
	"testing"
)

func TestGetEnvVar_Set(t *testing.T) {
	os.Setenv("REPO_NAME_1", "ff")
	result := GetEnvVar("REPO_NAME_1")

	if result != "ff" {
		t.Errorf("Expected 'ff', but got '%s'", result)
	}

	os.Unsetenv("REPO_NAME_1")
}

func TestGetEnvVar_Unset(t *testing.T) {
	result := GetEnvVar("REPO_NAME_1")

	if result != "" {
		t.Errorf("Expected empty string, but got '%s'", result)
	}
}
