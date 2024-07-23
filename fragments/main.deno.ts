import { get_env_var } from "./env_vars/env_vars.deno.ts";

console.log('fragment "env_vars" output:', get_env_var("REPO_NAME"));
