package redis_crud

import (
	"testing"
)

func TestRedisPing(t *testing.T) {
	result, err := RedisPing()

	if err != nil {
		t.Errorf("Error pinging Redis: %v", err)
	}

	if result != "PONG" {
		t.Errorf("Expected PONG, but got %s", result)
	}
}

func TestRedisCreate(t *testing.T) {
	result, err := RedisCreate("go", "bitcoin")

	if err != nil {
		t.Errorf("Error creating in Redis: %v", err)
	}

	if result != "ok" {
		t.Errorf("Expected ok, but got %s", result)
	}
}

func TestRedisRead(t *testing.T) {
	_, err := RedisCreate("go_read", "bitcoin")
	if err != nil {
		t.Errorf("Error creating in Redis: %v", err)
	}

	result, err := RedisRead("go_read")
	if err != nil {
		t.Errorf("Error reading from Redis: %v", err)
	}

	if result["favourite_coin"] != "bitcoin" {
		t.Errorf("Expected favourite coin to be bitcoin, but got %s", result["favourite_coin"])
	}
}

func TestRedisUpdate(t *testing.T) {
	_, err := RedisUpdate("go_update", "pepe")
	if err != nil {
		t.Errorf("Error updating in Redis: %v", err)
	}

	result, err := RedisRead("go_update")
	if err != nil {
		t.Errorf("Error reading from Redis: %v", err)
	}

	if result["favourite_coin"] != "pepe" {
		t.Errorf("Expected favourite coin to be pepe, but got %s", result["favourite_coin"])
	}
}

func TestRedisDelete(t *testing.T) {
	_, err := RedisCreate("go_del", "bitcoin")
	if err != nil {
		t.Errorf("Error creating in Redis: %v", err)
	}

	deleteResult, err := RedisDelete("go_del")
	if err != nil {
		t.Errorf("Error deleting from Redis: %v", err)
	}

	if deleteResult != "ok" {
		t.Errorf("Expected ok, but got %s", deleteResult)
	}

	readResult, err := RedisRead("go_del")
	if err != nil {
		t.Errorf("Error reading from Redis: %v", err)
	}

	if len(readResult) != 0 {
		t.Errorf("Expected empty result")
	}
}
