use regex::Regex;
use std::path::{Component, PathBuf};
use std::sync::LazyLock;

static BRANCH_NAME_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9_\-/.]+$").unwrap()
});

#[allow(dead_code)]
static REPO_NAME_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9_\-]+$").unwrap()
});

/// 验证分支名是否安全
/// 
/// Git 分支名规则：
/// - 只能包含字母、数字、-、_、/、.
/// - 不能以 . 开头
/// - 不能包含 ..
/// - 长度限制 1-250 字符
pub fn sanitize_branch_name(name: &str) -> Result<String, String> {
    if name.is_empty() {
        return Err("Branch name cannot be empty".to_string());
    }
    
    if name.len() > 250 {
        return Err("Branch name is too long (max 250 characters)".to_string());
    }
    
    // 不能以 . 开头
    if name.starts_with('.') {
        return Err("Branch name cannot start with '.'".to_string());
    }
    
    // 不能包含 ..
    if name.contains("..") {
        return Err("Branch name cannot contain '..'".to_string());
    }
    
    // 不能以 / 结尾
    if name.ends_with('/') {
        return Err("Branch name cannot end with '/'".to_string());
    }
    
    // 不能包含连续的 //
    if name.contains("//") {
        return Err("Branch name cannot contain consecutive slashes".to_string());
    }
    
    // 只允许字母、数字、-、_、/、.
    if !BRANCH_NAME_RE.is_match(name) {
        return Err("Branch name contains invalid characters. Only letters, numbers, '-', '_', '/', and '.' are allowed".to_string());
    }
    
    // 检查是否有保留名称
    let reserved = ["HEAD", "head", "master", "main"];
    let base_name = name.rsplit('/').next().unwrap_or(name);
    if reserved.contains(&base_name) && name == base_name {
        // 允许 main/master 作为普通分支名，但 HEAD 不允许
        if base_name.to_uppercase() == "HEAD" {
            return Err("Branch name cannot be 'HEAD'".to_string());
        }
    }
    
    Ok(name.to_string())
}

/// 验证路径是否安全
/// 
/// 检查：
/// - 路径遍历攻击 (../)
/// - 空字节注入
/// - 路径长度限制
pub fn validate_path(path: &str) -> Result<PathBuf, String> {
    if path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }
    
    // 检查空字节
    if path.contains('\0') {
        return Err("Path contains null byte".to_string());
    }
    
    // 检查路径长度
    if path.len() > 4096 {
        return Err("Path is too long".to_string());
    }
    
    let path_buf = PathBuf::from(path);
    
    // 检查路径遍历
    for component in path_buf.components() {
        if matches!(component, Component::ParentDir) {
            return Err("Path cannot contain '..' (path traversal detected)".to_string());
        }
    }
    
    Ok(path_buf)
}

/// 验证仓库名称是否安全
/// 仍用于 worktree 名称验证等场景
#[allow(dead_code)]
pub fn sanitize_repo_name(name: &str) -> Result<String, String> {
    if name.is_empty() {
        return Err("Repository name cannot be empty".to_string());
    }
    
    if name.len() > 100 {
        return Err("Repository name is too long (max 100 characters)".to_string());
    }
    
    // 只允许字母、数字、-、_
    if !REPO_NAME_RE.is_match(name) {
        return Err("Repository name contains invalid characters. Only letters, numbers, '-', and '_' are allowed".to_string());
    }
    
    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sanitize_branch_name_valid() {
        assert!(sanitize_branch_name("feature/new-feature").is_ok());
        assert!(sanitize_branch_name("bugfix-123").is_ok());
        assert!(sanitize_branch_name("release/v1.0.0").is_ok());
        assert!(sanitize_branch_name("main").is_ok());
    }
    
    #[test]
    fn test_sanitize_branch_name_invalid() {
        assert!(sanitize_branch_name("").is_err());
        assert!(sanitize_branch_name("feature;rm -rf /").is_err());
        assert!(sanitize_branch_name("feature$(whoami)").is_err());
        assert!(sanitize_branch_name("feature../attack").is_err());
        assert!(sanitize_branch_name(".hidden-branch").is_err());
    }
    
    #[test]
    fn test_validate_path_valid() {
        assert!(validate_path("/Users/test/project").is_ok());
        assert!(validate_path("/home/user/repo").is_ok());
    }
    
    #[test]
    fn test_validate_path_invalid() {
        assert!(validate_path("../../../etc/passwd").is_err());
        assert!(validate_path("/test/../../../etc").is_err());
        assert!(validate_path("/test\0/path").is_err());
    }
}