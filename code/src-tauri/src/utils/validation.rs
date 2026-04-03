use regex::Regex;
use std::path::{Component, PathBuf};
use std::sync::LazyLock;

static BRANCH_NAME_RE: LazyLock<Regex> = LazyLock::new(|| {
    // SAFETY: This is a compile-time constant regex pattern that is always valid
    #[allow(clippy::expect_used)]
    Regex::new(r"^[a-zA-Z0-9_\-/.]+$").expect("valid branch name regex pattern")
});

#[allow(dead_code)]
static REPO_NAME_RE: LazyLock<Regex> = LazyLock::new(|| {
    // SAFETY: This is a compile-time constant regex pattern that is always valid
    #[allow(clippy::expect_used)]
    Regex::new(r"^[a-zA-Z0-9_\-]+$").expect("valid repo name regex pattern")
});

/// Windows 保留名称列表
const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Windows 非法字符（不包括路径分隔符）
const WINDOWS_INVALID_CHARS: &[char] = &['<', '>', ':', '"', '|', '?', '*'];

/// 验证分支名是否安全
///
/// Git 分支名规则：
/// - 只能包含字母、数字、-、_、/、.
/// - 不能以 . 开头
/// - 不能包含 ..
/// - 长度限制 1-250 字符
/// - 不能包含 @{ (reflog 注入)
/// - 不能以 refs/ 开头
/// - 不能包含 Windows 保留名称或非法字符
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

    // 不能包含 .. (git revision range 注入)
    if name.contains("..") {
        return Err("Branch name cannot contain '..'".to_string());
    }

    // 不能包含 @{ (reflog 注入攻击)
    if name.contains("@{") {
        return Err("Branch name cannot contain '@{' (reflog injection)".to_string());
    }

    // 不能以 refs/ 开头
    if name.to_lowercase().starts_with("refs/") {
        return Err("Branch name cannot start with 'refs/'".to_string());
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

    // 检查 Windows 非法字符
    for ch in WINDOWS_INVALID_CHARS {
        if name.contains(*ch) {
            return Err(format!("Branch name cannot contain '{}' (Windows invalid character)", ch));
        }
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

    // 检查 Windows 保留名称
    let upper_base = base_name.to_uppercase();
    // 检查完全匹配或带扩展名的匹配 (如 CON.txt)
    for reserved in WINDOWS_RESERVED_NAMES {
        if upper_base == *reserved || upper_base.starts_with(&format!("{}.", reserved)) {
            return Err(format!("Branch name cannot use Windows reserved name '{}'", reserved));
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
/// - Windows 保留名称
/// - Windows 非法字符
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

    // 检查 Windows 非法字符
    for ch in WINDOWS_INVALID_CHARS {
        if path.contains(*ch) {
            return Err(format!("Path contains invalid character '{}' (Windows restriction)", ch));
        }
    }

    let path_buf = PathBuf::from(path);

    // 检查路径遍历
    for component in path_buf.components() {
        if matches!(component, Component::ParentDir) {
            return Err("Path cannot contain '..' (path traversal detected)".to_string());
        }
    }

    // 检查 Windows 保留名称（检查每个路径组件）
    for component in path_buf.components() {
        if let Component::Normal(os_str) = component {
            if let Some(component_str) = os_str.to_str() {
                let upper_component = component_str.to_uppercase();
                // 检查是否是 Windows 保留名称（不带扩展名或带扩展名）
                for reserved in WINDOWS_RESERVED_NAMES {
                    if upper_component == *reserved || upper_component.starts_with(&format!("{}.", reserved)) {
                        return Err(format!("Path contains Windows reserved name '{}'", reserved));
                    }
                }
            }
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
    fn test_sanitize_branch_name_reflog_injection() {
        // 测试 @{ reflog 注入
        assert!(sanitize_branch_name("feature@{1}").is_err());
        assert!(sanitize_branch_name("test@{").is_err());
        assert!(sanitize_branch_name("branch@{0}").is_err());
    }

    #[test]
    fn test_sanitize_branch_name_refs_prefix() {
        // 测试 refs/ 前缀
        assert!(sanitize_branch_name("refs/heads/main").is_err());
        assert!(sanitize_branch_name("REFS/heads/main").is_err());
        assert!(sanitize_branch_name("refs/tags/v1.0").is_err());
    }

    #[test]
    fn test_sanitize_branch_name_revision_range() {
        // 测试 .. revision range 注入
        assert!(sanitize_branch_name("main..feature").is_err());
        assert!(sanitize_branch_name("test..branch").is_err());
    }

    #[test]
    fn test_sanitize_branch_name_windows_reserved() {
        // 测试 Windows 保留名称
        assert!(sanitize_branch_name("CON").is_err());
        assert!(sanitize_branch_name("PRN").is_err());
        assert!(sanitize_branch_name("AUX").is_err());
        assert!(sanitize_branch_name("NUL").is_err());
        assert!(sanitize_branch_name("COM1").is_err());
        assert!(sanitize_branch_name("LPT1").is_err());
        // 测试带扩展名的保留名称
        assert!(sanitize_branch_name("CON.txt").is_err());
        assert!(sanitize_branch_name("aux.test").is_err());
    }

    #[test]
    fn test_sanitize_branch_name_windows_invalid_chars() {
        // 测试 Windows 非法字符
        assert!(sanitize_branch_name("test<branch").is_err());
        assert!(sanitize_branch_name("test>branch").is_err());
        assert!(sanitize_branch_name("test:branch").is_err());
        assert!(sanitize_branch_name("test\"branch").is_err());
        assert!(sanitize_branch_name("test|branch").is_err());
        assert!(sanitize_branch_name("test?branch").is_err());
        assert!(sanitize_branch_name("test*branch").is_err());
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

    #[test]
    fn test_validate_path_windows_reserved() {
        // 测试路径中的 Windows 保留名称
        assert!(validate_path("/path/to/CON").is_err());
        assert!(validate_path("/path/to/PRN/file").is_err());
        assert!(validate_path("/home/AUX").is_err());
        assert!(validate_path("/test/NUL.txt").is_err());
        assert!(validate_path("/COM1").is_err());
        assert!(validate_path("/LPT1/data").is_err());
    }

    #[test]
    fn test_validate_path_windows_invalid_chars() {
        // 测试路径中的 Windows 非法字符
        assert!(validate_path("/path/to<file").is_err());
        assert!(validate_path("/path/to>file").is_err());
        assert!(validate_path("/path/to:file").is_err());
        assert!(validate_path("/path/to\"file").is_err());
        assert!(validate_path("/path/to|file").is_err());
        assert!(validate_path("/path/to?file").is_err());
        assert!(validate_path("/path/to*file").is_err());
    }
}