use serde::Serialize;
use std::fmt;

/// 统一的应用错误类型
#[derive(Debug, Serialize)]
pub struct AppError {
    /// 错误代码
    pub code: ErrorCode,
    /// 用户友好的错误消息
    pub message: String,
    /// 详细的错误信息（用于调试）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

/// 错误代码枚举
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    // Git 相关错误
    GitRepoNotFound,
    GitBranchNotFound,
    GitWorktreeNotFound,
    GitWorktreeExists,
    GitMergeConflict,
    GitOperationFailed,

    // 文件系统错误
    PathNotFound,
    PathAlreadyExists,
    InvalidPath,
    PermissionDenied,

    // 验证错误
    InvalidInput,
    ValidationFailed,

    // 系统错误
    InternalError,
    ExternalCommandFailed,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }

    // 常用错误构造器
    pub fn git_repo_not_found(path: &str) -> Self {
        Self::new(
            ErrorCode::GitRepoNotFound,
            format!("未找到 Git 仓库: {}", path),
        )
    }

    pub fn git_branch_not_found(branch: &str) -> Self {
        Self::new(
            ErrorCode::GitBranchNotFound,
            format!("未找到分支: {}", branch),
        )
    }

    pub fn git_worktree_not_found(path: &str) -> Self {
        Self::new(
            ErrorCode::GitWorktreeNotFound,
            format!("未找到 Worktree: {}", path),
        )
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidInput, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InternalError, message)
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

// 从常见错误类型转换
impl From<git2::Error> for AppError {
    fn from(err: git2::Error) -> Self {
        let code = match err.class() {
            git2::ErrorClass::Repository => ErrorCode::GitRepoNotFound,
            git2::ErrorClass::Reference => ErrorCode::GitBranchNotFound,
            git2::ErrorClass::Worktree => ErrorCode::GitWorktreeNotFound,
            git2::ErrorClass::Merge => ErrorCode::GitMergeConflict,
            _ => ErrorCode::GitOperationFailed,
        };
        Self::new(code, err.message()).with_details(format!("git2 错误: {:?}", err.class()))
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        let code = match err.kind() {
            std::io::ErrorKind::NotFound => ErrorCode::PathNotFound,
            std::io::ErrorKind::AlreadyExists => ErrorCode::PathAlreadyExists,
            std::io::ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
            _ => ErrorCode::InternalError,
        };
        Self::new(code, err.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        Self::new(ErrorCode::InternalError, err.to_string())
    }
}

/// 用于 Tauri 命令的结果类型别名
pub type AppResult<T> = Result<T, AppError>;
