mod env_vars;

fn main() {
    let env_var = env_vars::env_vars_utils::get_env_var("REPO_NAME");
    println!("fragment 'env_vars' output: {env_var}")
}
