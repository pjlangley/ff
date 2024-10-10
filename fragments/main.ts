import { get_env_var } from "./env_vars/env_vars_utils";
import { redisCreate, redisDelete, redisPing, redisRead, redisUpdate } from "./redis_db/redis_crud";
import { get_item_by_ticker, get_items_after_launch_year, get_all_items, add_item } from "./sql/sql_queries";

(async () => {
  // env vars
  console.log('fragment "env_vars" output:', get_env_var("REPO_NAME"));

  // sql
  console.log('fragment "sql/get_item_by_ticker" output:', await get_item_by_ticker("BTC"));
  console.log('fragment "sql/get_items_after_launch_year" output:', await get_items_after_launch_year(2010));
  console.log('fragment "sql/get_all_items" output:', await get_all_items());
  console.log('fragment "sql/add_item" output:', await add_item({ ticker: "PEPE", name: "Pepe", launched: 2023 }));

  // redis
  console.log('fragment "redis_db/redisPing" output:', await redisPing());
  console.log('fragment "redis_db/redisCreate" output:', await redisCreate("nodejs", "bitcoin"));
  console.log('fragment "redis_db/redisRead" output:', await redisRead("nodejs"));
  console.log('fragment "redis_db/redisUpdate" output:', await redisUpdate("nodejs", "pepe"));
  console.log('fragment "redis_db/redisDelete" output:', await redisDelete("nodejs"));
})();
