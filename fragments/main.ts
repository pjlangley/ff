import { getEnvVar } from "./env_vars/env_vars_utils";
import { redisCreate, redisDelete, redisPing, redisRead, redisUpdate } from "./redis_db/redis_crud";
import { getItemByTicker, getItemsAfterLaunchYear, getAllItems, addItem } from "./sqlite_db/sqlite_crud";
import {
  getItemByTicker as pgGetItemByTicker,
  getItemsAfterLaunchYear as pgGetItemsAfterLaunchYear,
  getAllItems as pgGetAllItems,
  addItem as pgAddItem,
  removeItem as pgRemoveItem,
  updateItem as pgUpdateItem,
} from "./postgres_db/postgres_crud";

(async () => {
  // env vars
  console.log('fragment "env_vars/getEnvVar" output:', getEnvVar("REPO_NAME"));

  // sqlite
  console.log('fragment "sqlite_db/getItemByTicker" output:', await getItemByTicker("BTC"));
  console.log('fragment "sqlite_db/getItemsAfterLaunchYear" output:', await getItemsAfterLaunchYear(2010));
  console.log('fragment "sqlite_db/getAllItems" output:', await getAllItems());
  console.log('fragment "sqlite_db/addItem" output:', await addItem({ ticker: "PEPE", name: "Pepe", launched: 2023 }));

  // redis
  console.log('fragment "redis_db/redisPing" output:', await redisPing());
  console.log('fragment "redis_db/redisCreate" output:', await redisCreate("nodejs", "bitcoin"));
  console.log('fragment "redis_db/redisRead" output:', await redisRead("nodejs"));
  console.log('fragment "redis_db/redisUpdate" output:', await redisUpdate("nodejs", "pepe"));
  console.log('fragment "redis_db/redisDelete" output:', await redisDelete("nodejs"));

  // postgres
  console.log('fragment "postgres_db/getItemByTicker" output:', await pgGetItemByTicker("BTC"));
  console.log('fragment "postgres_db/getItemsAfterLaunchYear" output:', await pgGetItemsAfterLaunchYear(2010));
  console.log('fragment "postgres_db/getAllItems" output:', await pgGetAllItems());
  console.log(
    'fragment "postgres_db/addItem" output:',
    await pgAddItem({ ticker: "PEPE", name: "Pepe", launched: 2023 }),
  );
  console.log('fragment "postgres_db/removeItem" output:', await pgRemoveItem("PEPE"));
  console.log(
    'fragment "postgres_db/updateItem" output:',
    await pgUpdateItem({ ticker: "ETH", name: "Ethereum", launched: 2015 }),
  );
})();
