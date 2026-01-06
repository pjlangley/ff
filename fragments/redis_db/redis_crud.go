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

func RedisPing() (string, error) {
	client := init_client()
	pong, err := client.Ping(ctx).Result()
	if err != nil {
		log.Printf("Failed to ping: %v", err)
		return "", err
	}
	return pong, nil
}

func RedisCreate(namespace string, favouriteCoin string) (string, error) {
	client := init_client()
	err := client.HSet(ctx, namespace, map[string]string{"favourite_coin": favouriteCoin}).Err()
	if err != nil {
		log.Printf("Failed to set: %v", err)
		return "", err
	}
	return "ok", nil
}

func RedisRead(namespace string) (map[string]string, error) {
	client := init_client()
	item, err := client.HGetAll(ctx, namespace).Result()
	if err != nil {
		log.Printf("Failed to get: %v", err)
		return nil, err
	}
	return item, nil
}

func RedisUpdate(namespace string, favouriteCoin string) (string, error) {
	return RedisCreate(namespace, favouriteCoin)
}

func RedisDelete(namespace string) (string, error) {
	client := init_client()
	err := client.Del(ctx, namespace).Err()
	if err != nil {
		log.Printf("Failed to delete: %v", err)
		return "", err
	}
	return "ok", nil
}
