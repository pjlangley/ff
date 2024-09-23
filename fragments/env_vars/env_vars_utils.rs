use std::env;

pub fn get_env_var(name: &str) -> String {
    env::var(name).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_returns_env_var_if_exists() {
        env::set_var("REPO_NAME", "ff");
        assert_eq!(get_env_var("REPO_NAME"), "ff");
        env::remove_var("REPO_NAME");
    }

    #[test]
    fn test_nonexistent_env_var() {
        env::remove_var("REPO_NAME_2");
        let var = get_env_var("REPO_NAME_2");
        assert!(var.is_empty());
    }
}
