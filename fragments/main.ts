import { getEnvVar } from "./env_vars/env_vars_utils";
import { redisCreate, redisDelete, redisPing, redisRead, redisUpdate } from "./redis_db/redis_crud";
import { getItemByTicker, getItemsAfterLaunchYear, getAllItems, addItem } from "./sql/sql_queries";

(async () => {
  // env vars
  console.log('fragment "env_vars/getEnvVar" output:', getEnvVar("REPO_NAME"));

  // sql
  console.log('fragment "sql/getItemByTicker" output:', await getItemByTicker("BTC"));
  console.log('fragment "sql/getItemsAfterLaunchYear" output:', await getItemsAfterLaunchYear(2010));
  console.log('fragment "sql/getAllItems" output:', await getAllItems());
  console.log('fragment "sql/addItem" output:', await addItem({ ticker: "PEPE", name: "Pepe", launched: 2023 }));

  // redis
  console.log('fragment "redis_db/redisPing" output:', await redisPing());
  console.log('fragment "redis_db/redisCreate" output:', await redisCreate("nodejs", "bitcoin"));
  console.log('fragment "redis_db/redisRead" output:', await redisRead("nodejs"));
  console.log('fragment "redis_db/redisUpdate" output:', await redisUpdate("nodejs", "pepe"));
  console.log('fragment "redis_db/redisDelete" output:', await redisDelete("nodejs"));
})();
