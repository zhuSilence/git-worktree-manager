use reqwest::{
    Client,
    header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE},
};
use serde_json::{json, Value};

use crate::models::{AIConfig, AIProvider, AIReviewResult, ReviewIssue, ReviewImprovement, ReviewHighlight};

const MAX_DIFF_TOKENS: usize = 8000;
const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";
const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const OLLAMA_API_URL: &str = "http://localhost:11434/api/generate";

/// AI 服务
pub struct AIService {
    client: Client,
}

impl AIService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// 测试 AI 连接
    pub async fn test_connection(&self, config: &AIConfig) -> anyhow::Result<bool> {
        let prompt = "Hello, this is a test. Please respond with 'OK' only.";

        match config.provider {
            AIProvider::OpenAI => {
                let response = self.call_openai(config, prompt).await?;
                Ok(response.to_lowercase().contains("ok"))
            }
            AIProvider::Claude => {
                let response = self.call_claude(config, prompt).await?;
                Ok(response.to_lowercase().contains("ok"))
            }
            AIProvider::Ollama => {
                let response = self.call_ollama(config, prompt).await?;
                Ok(!response.is_empty())
            }
            AIProvider::Custom => {
                let response = self.call_custom(config, prompt).await?;
                Ok(!response.is_empty())
            }
        }
    }

    /// 执行代码评审
    pub async fn review_code(
        &self,
        config: &AIConfig,
        diff: &str,
        stats: &crate::models::ReviewDiffStats,
    ) -> anyhow::Result<AIReviewResult> {
        // 截断过长的 diff
        let truncated_diff = self.truncate_diff(diff);

        // 构建 prompt
        let prompt = self.build_review_prompt(&truncated_diff, stats, &config.language);

        // 调用 AI API
        let response = match config.provider {
            AIProvider::OpenAI => self.call_openai(config, &prompt).await?,
            AIProvider::Claude => self.call_claude(config, &prompt).await?,
            AIProvider::Ollama => self.call_ollama(config, &prompt).await?,
            AIProvider::Custom => self.call_custom(config, &prompt).await?,
        };

        // 解析响应
        let result = self.parse_review_response(&response)?;

        Ok(result)
    }

    /// 调用 OpenAI API
    async fn call_openai(&self, config: &AIConfig, prompt: &str) -> anyhow::Result<String> {
        let url = OPENAI_API_URL;

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", config.api_key))?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let body = json!({
            "model": config.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 4000
        });

        let response = self
            .client
            .post(url)
            .headers(headers)
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        let json: Value = response.json().await?;
        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or_default()
            .to_string();

        Ok(content)
    }

    /// 调用 Claude API
    async fn call_claude(&self, config: &AIConfig, prompt: &str) -> anyhow::Result<String> {
        let url = CLAUDE_API_URL;

        let mut headers = HeaderMap::new();
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&config.api_key)?,
        );
        headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let body = json!({
            "model": config.model,
            "max_tokens": 4000,
            "messages": [{"role": "user", "content": prompt}]
        });

        let response = self
            .client
            .post(url)
            .headers(headers)
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Claude API error: {}", error_text));
        }

        let json: Value = response.json().await?;
        let content = json["content"][0]["text"]
            .as_str()
            .unwrap_or_default()
            .to_string();

        Ok(content)
    }

    /// 调用 Ollama API
    async fn call_ollama(&self, config: &AIConfig, prompt: &str) -> anyhow::Result<String> {
        let url = OLLAMA_API_URL;

        let body = json!({
            "model": config.model,
            "prompt": prompt,
            "stream": false
        });

        let response = self.client.post(url).json(&body).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Ollama API error: {}", error_text));
        }

        let json: Value = response.json().await?;
        let content = json["response"].as_str().unwrap_or_default().to_string();

        Ok(content)
    }

    /// 调用自定义 API
    async fn call_custom(&self, config: &AIConfig, prompt: &str) -> anyhow::Result<String> {
        let base_url = config
            .base_url
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Custom API URL not set"))?
            .trim_end_matches('/');

        // 自动补全路径：如果 URL 以 /v1 结尾，添加 /chat/completions
        let url = if base_url.ends_with("/v1") {
            format!("{}/chat/completions", base_url)
        } else {
            base_url.to_string()
        };

        println!("[call_custom] 请求 URL: {}", url);
        println!("[call_custom] 模型: {}", config.model);

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", config.api_key))?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let body = json!({
            "model": config.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 4000
        });

        println!("[call_custom] 请求体: {}", body);

        let response = self
            .client
            .post(url)
            .headers(headers)
            .json(&body)
            .send()
            .await?;

        let status = response.status();
        println!("[call_custom] 响应状态码: {}", status);

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "API 请求失败 ({}): {}",
                status,
                error_text
            ));
        }

        let response_text = response.text().await?;
        println!("[call_custom] 响应内容: {}", response_text);

        let json: Value = serde_json::from_str(&response_text)
            .map_err(|e| anyhow::anyhow!("JSON 解析失败: {}. 响应内容: {}", e, response_text))?;

        // 尝试 OpenAI 兼容格式
        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| {
                let error_detail = format!(
                    "无法从响应中提取内容。响应结构: {:?}",
                    json
                );
                anyhow::anyhow!("{}", error_detail)
            })?
            .to_string();

        Ok(content)
    }

    /// 截断过长的 diff
    fn truncate_diff(&self, diff: &str) -> String {
        // 简单估算：1 token ≈ 4 字符
        let max_chars = MAX_DIFF_TOKENS * 4;

        if diff.len() <= max_chars {
            return diff.to_string();
        }

        // 截断并添加提示
        let mut result = diff[..max_chars].to_string();
        result.push_str("\n\n[... 内容已截断，仅显示部分变更 ...]");
        result
    }

    /// 构建评审 prompt
    fn build_review_prompt(&self, diff: &str, stats: &crate::models::ReviewDiffStats, language: &str) -> String {
        let lang_text = if language == "zh" { "中文" } else { "English" };

        format!(
            r#"你是一位资深代码审查专家。请对以下代码变更进行专业评审。

## 重要说明
1. 只评审**实际的源代码文件**（如 .rs, .ts, .tsx, .js, .py 等）
2. **忽略**以下文件类型中的代码：
   - Markdown 文档（.md 文件）中的代码示例
   - 文档中的注释或说明性代码块
   - 测试数据文件中的代码片段
3. 如果发现问题在文档中，请忽略它，不要报告

## 评审维度
1. **代码质量**: 可读性、可维护性、代码规范
2. **安全性**: 潜在安全漏洞、输入验证、敏感信息泄露
3. **性能**: 算法复杂度、资源使用、潜在性能瓶颈
4. **正确性**: 逻辑错误、边界条件、异常处理
5. **最佳实践**: 设计模式、框架特性使用

## 输出要求
1. 用{lang}回复
2. 给出具体的文件路径和行号（必须是真实代码文件，不是文档）
3. 提供可执行的改进建议
4. 按 JSON 格式输出

## 代码变更统计
- 新增: {additions} 行
- 删除: {deletions} 行
- 修改文件: {changed_files} 个

## Diff 内容
```diff
{diff}
```

## 输出格式
请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：
{{
  "issues": [
    {{
      "severity": "warning" | "error" | "info",
      "file": "文件路径（真实代码文件）",
      "line": 行号,
      "message": "问题描述",
      "suggestion": "改进建议"
    }}
  ],
  "improvements": [
    {{
      "message": "改进建议",
      "files": ["相关文件（真实代码文件）"]
    }}
  ],
  "highlights": [
    {{
      "message": "亮点描述",
      "files": ["相关文件"]
    }}
  ]
}}"#,
            lang = lang_text,
            additions = stats.additions,
            deletions = stats.deletions,
            changed_files = stats.changed_files,
            diff = diff
        )
    }

    /// 解析评审响应
    fn parse_review_response(&self, response: &str) -> anyhow::Result<AIReviewResult> {
        // 尝试提取 JSON
        let json_str = self.extract_json(response);

        let parsed: Value = serde_json::from_str(&json_str)?;

        let issues: Vec<ReviewIssue> = parsed["issues"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .filter(|issue: &ReviewIssue| {
                // 过滤掉指向文档文件的问题，只保留真实代码文件的问题
                !issue.file.ends_with(".md")
                    && !issue.file.ends_with(".markdown")
                    && !issue.file.is_empty()
            })
            .collect();

        let improvements: Vec<ReviewImprovement> = parsed["improvements"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();

        let highlights: Vec<ReviewHighlight> = parsed["highlights"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();

        // 生成 UUID
        let id = format!("{}-{:x}", now, rand::random::<u64>());

        Ok(AIReviewResult {
            id,
            timestamp: now,
            worktree_path: String::new(), // 由调用方填充
            target_branch: String::new(), // 由调用方填充
            issues,
            improvements,
            highlights,
            raw_response: Some(response.to_string()),
        })
    }

    /// 从响应中提取 JSON
    fn extract_json(&self, response: &str) -> String {
        // 尝试找到 JSON 块
        if let Some(start) = response.find('{') {
            if let Some(end) = response.rfind('}') {
                return response[start..=end].to_string();
            }
        }
        response.to_string()
    }
}

impl Default for AIService {
    fn default() -> Self {
        Self::new()
    }
}
