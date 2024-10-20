extern crate redis;
use std::collections::HashMap;

use redis::Commands;

use crate::env_vars::env_vars_utils::get_env_var;

fn init_connection() -> Result<redis::Connection, redis::RedisError> {
    let url = if get_env_var("CI").is_empty() {
        "redis://127.0.0.1/"
    } else {
        "redis://redis-stack-server:6379"
    };
    let client = redis::Client::open(url)?;
    let connection = client.get_connection()?;
    Ok(connection)
}

pub fn redis_ping() -> redis::RedisResult<String> {
    let mut connection = init_connection()?;
    let pong: String = redis::cmd("PING").query(&mut connection)?;
    Ok(pong)
}

pub fn redis_create(namespace: &str, favourite_coin: &str) -> redis::RedisResult<String> {
    let mut connection = init_connection()?;
    connection.hset(namespace, "favourite_coin", favourite_coin)?;
    Ok("OK".to_string())
}

pub fn redis_read(namespace: &str) -> redis::RedisResult<HashMap<String, String>> {
    let mut connection = init_connection()?;
    let item = connection.hgetall(namespace)?;
    Ok(item)
}

pub fn redis_update(namespace: &str, favourite_coin: &str) -> redis::RedisResult<String> {
    let result = redis_create(namespace, favourite_coin)?;
    Ok(result)
}

pub fn redis_delete(namespace: &str) -> redis::RedisResult<String> {
    let mut connection = init_connection()?;
    connection.del(namespace)?;
    Ok("OK".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redis_ping() {
        let result = redis_ping();
        assert!(result.is_ok_and(|x| x == "PONG"));
    }

    #[test]
    fn test_redis_create() {
        let result = redis_create("rust", "bitcoin");
        assert!(result.is_ok_and(|x| x == "OK"));
    }

    #[test]
    fn test_redis_read() {
        let _ = redis_create("rust_read", "bitcoin");
        let result = redis_read("rust_read").unwrap();
        assert_eq!(result["favourite_coin"], "bitcoin");
    }

    #[test]
    fn test_redis_update() {
        let _ = redis_create("rust_update", "bitcoin");
        let result_update = redis_update("rust_update", "pepe");
        assert!(result_update.is_ok_and(|x| x == "OK"));

        let result = redis_read("rust_update").unwrap();
        assert_eq!(result["favourite_coin"], "pepe");
    }

    #[test]
    fn test_redis_delete() {
        let _ = redis_create("rust_delete", "bitcoin");

        let result = redis_delete("rust_delete");
        assert!(result.is_ok_and(|x| x == "OK"));

        let deleted = redis_read("rust_delete").unwrap();
        assert!(deleted.is_empty());
    }
}
