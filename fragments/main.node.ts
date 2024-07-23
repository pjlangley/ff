import { get_env_var } from "./env_vars/env_vars.node";

console.log('fragment "env_vars" output:', get_env_var("REPO_NAME"));
