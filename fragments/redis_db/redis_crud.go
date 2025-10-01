package redis_crud

import (
	"context"
	"ff/env_vars"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()

func init_client() *redis.Client {
	host := env_vars.GetEnvVar("REDIS_HOST")
	url := func() string {
		if len(host) == 0 {
			return "redis://localhost:6379"
		} else {
			return fmt.Sprintf("redis://%s:6379", host)
		}
	}()
	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Fatal("Failed to parse redis url", err)
	}
	return redis.NewClient(opt)
}

func RedisPing() string {
	client := init_client()
	pong, err := client.Ping(ctx).Result()
	if err != nil {
		log.Fatal("Failed to ping:", err)
	}
	return pong
}

func RedisCreate(namespace string, favouriteCoin string) string {
	client := init_client()
	err := client.HSet(ctx, namespace, map[string]string{"favourite_coin": favouriteCoin}).Err()
	if err != nil {
		log.Fatal("Failed to set:", err)
	}
	return "ok"
}

func RedisRead(namespace string) map[string]string {
	client := init_client()
	item, err := client.HGetAll(ctx, namespace).Result()
	if err != nil {
		log.Fatal("Failed to get:", err)
	}
	return item
}

func RedisUpdate(namespace string, favouriteCoin string) string {
	return RedisCreate(namespace, favouriteCoin)
}

func RedisDelete(namespace string) string {
	client := init_client()
	err := client.Del(ctx, namespace).Err()
	if err != nil {
		log.Fatal("Failed to delete:", err)
	}
	return "ok"
}
