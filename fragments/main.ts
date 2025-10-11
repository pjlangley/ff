import { getEnvVar } from "./env_vars/env_vars_utils";

(() => {
  // env vars
  console.log('fragment "env_vars/getEnvVar" output:', getEnvVar("REPO_NAME"));
})();
