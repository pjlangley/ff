from fragments.env_vars import get_env_var

get_env_var_output = get_env_var("REPO_NAME")
print(f"fragment 'env_vars' output: {get_env_var_output}")
