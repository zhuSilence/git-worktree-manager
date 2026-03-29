use serde::{Deserialize, Serialize};

/// AI 提供商
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum AIProvider {
    #[default]
    OpenAI,
    Claude,
    Ollama,
    Custom,
}

/// AI 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIConfig {
    pub provider: AIProvider,
    pub api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    pub model: String,
    pub language: String,
    pub auto_review: bool,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            provider: AIProvider::OpenAI,
            api_key: String::new(),
            base_url: None,
            model: "gpt-4o-mini".to_string(),
            language: "zh".to_string(),
            auto_review: false,
        }
    }
}

/// 问题严重程度
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

/// 评审问题项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewIssue {
    pub severity: Severity,
    pub file: String,
    pub line: u32,
    pub message: String,
    pub suggestion: String,
    #[serde(default)]
    pub ignored: bool,
}

/// 改进建议
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewImprovement {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<String>>,
}

/// 代码亮点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewHighlight {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<String>>,
}

/// AI 评审结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIReviewResult {
    pub id: String,
    pub timestamp: u64,
    pub worktree_path: String,
    pub target_branch: String,
    pub issues: Vec<ReviewIssue>,
    pub improvements: Vec<ReviewImprovement>,
    pub highlights: Vec<ReviewHighlight>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_response: Option<String>,
}

/// AI 评审请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIReviewRequest {
    pub worktree_path: String,
    pub target_branch: String,
    #[serde(default)]
    pub force: bool,
}

/// AI 评审响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIReviewResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<AIReviewResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// AI 测试连接响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AITestConnectionResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// AI 评审用的 Diff 统计
#[derive(Debug, Clone)]
pub struct ReviewDiffStats {
    pub additions: u32,
    pub deletions: u32,
    pub changed_files: u32,
}

/// AI 命名建议请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AINamingRequest {
    /// 仓库路径
    pub repo_path: String,
    /// 用户输入（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_input: Option<String>,
    /// 最近提交数量
    #[serde(default = "default_commit_count")]
    pub commit_count: u32,
}

fn default_commit_count() -> u32 {
    10
}

/// AI 命名建议
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AINamingSuggestion {
    /// 建议的名称
    pub name: String,
    /// 建议类型
    pub suggestion_type: String,
    /// 理由/说明
    pub reason: String,
}

/// AI 命名建议响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AINamingResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestions: Option<Vec<AINamingSuggestion>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
