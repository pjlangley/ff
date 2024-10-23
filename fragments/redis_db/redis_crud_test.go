package redis_crud

import (
	"testing"
)

func TestRedisPing(t *testing.T) {
	result := RedisPing()

	if result != "PONG" {
		t.Errorf("Expected PONG, but got %s", result)
	}
}

func TestRedisCreate(t *testing.T) {
	result := RedisCreate("go", "bitcoin")

	if result != "ok" {
		t.Errorf("Expected ok, but got %s", result)
	}
}

func TestRedisRead(t *testing.T) {
	RedisCreate("go_read", "bitcoin")
	result := RedisRead("go_read")

	if result["favourite_coin"] != "bitcoin" {
		t.Errorf("Expected favourite coin to be bitcoin, but got %s", result["favourite_coin"])
	}
}

func TestRedisUpdate(t *testing.T) {
	RedisUpdate("go_update", "pepe")
	result := RedisRead("go_update")

	if result["favourite_coin"] != "pepe" {
		t.Errorf("Expected favourite coin to be pepe, but got %s", result["favourite_coin"])
	}
}

func TestRedisDelete(t *testing.T) {
	RedisCreate("go_del", "bitcoin")
	deleteResult := RedisDelete("go_del")

	if deleteResult != "ok" {
		t.Errorf("Expected ok, but got %s", deleteResult)
	}

	readResult := RedisRead("go_del")

	if len(readResult) != 0 {
		t.Errorf("Expected empty result")
	}
}
