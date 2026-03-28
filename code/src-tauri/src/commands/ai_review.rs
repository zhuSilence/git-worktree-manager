use crate::models::{AIConfig, AIProvider, AIReviewRequest, AIReviewResponse, DetailedDiffResponse, AITestConnectionResponse};
use crate::services::ai_service::AIService;
use crate::services::{get_diff, get_detailed_diff};
use crate::utils::validation::validate_path;
use base64::{Engine as _, engine::general_purpose};
use log::debug;

const OBFUSCATION_KEY: &[u8] = b"git-worktree-manager-secret-key!"; // 32字节

/// 混淆加密（Base64 + XOR）
fn obfuscate(data: &str) -> String {
    let bytes: Vec<u8> = data.bytes()
        .enumerate()
        .map(|(i, b)| b ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.len()])
        .collect();
    general_purpose::STANDARD.encode(&bytes)
}

/// 解混淆（Base64 + XOR）
fn deobfuscate(encoded: &str) -> Result<String, String> {
    let bytes = general_purpose::STANDARD.decode(encoded)
        .map_err(|e| format!("Decode error: {}", e))?;
    let original: Vec<u8> = bytes.iter()
        .enumerate()
        .map(|(i, &b)| b ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.len()])
        .collect();
    String::from_utf8(original).map_err(|e| format!("UTF8 error: {}", e))
}

/// 保存 AI 配置
#[tauri::command]
pub async fn save_ai_config(config: AIConfig) -> Result<(), String> {
    // 存储配置到本地文件，对 api_key 进行加密
    let config_path = get_config_path()?;

    // 克隆配置并加密 api_key
    let mut config_to_save = config.clone();
    if !config_to_save.api_key.is_empty() {
        config_to_save.api_key = obfuscate(&config_to_save.api_key);
    }

    let json = serde_json::to_string(&config_to_save).map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || std::fs::write(&config_path, json))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 获取 AI 配置
#[tauri::command]
pub async fn get_ai_config() -> Result<AIConfig, String> {
    let config_path = get_config_path()?;

    let content = tokio::task::spawn_blocking(move || std::fs::read_to_string(&config_path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?;

    match content {
        Ok(content) => {
            let mut config: AIConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;

            // 尝试解密 api_key（如果看起来像加密数据则解密，否则保持原样）
            if !config.api_key.is_empty() {
                // 检查是否是 Base64 编码的加密数据（向后兼容：如果解密失败则保持原值）
                if let Ok(decrypted) = deobfuscate(&config.api_key) {
                    config.api_key = decrypted;
                }
                // 如果解密失败，说明是旧版明文配置，保持原值，下次保存时会自动加密
            }

            Ok(config)
        }
        Err(_) => Ok(AIConfig::default()),
    }
}

/// 测试 AI 连接
#[tauri::command]
pub async fn test_ai_connection(config: AIConfig) -> Result<AITestConnectionResponse, String> {
    debug!("[test_ai_connection] 开始测试连接: provider={:?}, base_url={:?}, model={}",
        config.provider, config.base_url, config.model);

    let service = AIService::new();
    match service.test_connection(&config).await {
        Ok(success) => {
            debug!("[test_ai_connection] 测试成功: {}", success);
            Ok(AITestConnectionResponse {
                success,
                error: if success { None } else { Some("连接失败，请检查配置".to_string()) },
            })
        }
        Err(e) => {
            let error_msg = e.to_string();
            debug!("[test_ai_connection] 测试失败: {}", error_msg);
            Ok(AITestConnectionResponse {
                success: false,
                error: Some(error_msg),
            })
        }
    }
}

/// 执行 AI 评审
#[tauri::command]
pub async fn ai_review(request: AIReviewRequest) -> Result<AIReviewResponse, String> {
    // 验证路径参数
    validate_path(&request.worktree_path).map_err(|e| e.to_string())?;

    debug!("[ai_review] 开始评审: worktree_path={}, target_branch={}",
        request.worktree_path, request.target_branch);

    // 1. 获取 AI 配置
    let config = match get_ai_config().await {
        Ok(cfg) => {
            debug!("[ai_review] 配置加载成功: provider={:?}, model={}", cfg.provider, cfg.model);
            cfg
        },
        Err(e) => {
            debug!("[ai_review] 配置加载失败: {}", e);
            return Ok(AIReviewResponse {
                success: false,
                result: None,
                error: Some(format!("配置加载失败: {}", e)),
            });
        }
    };

    if config.api_key.is_empty() && config.provider != AIProvider::Ollama {
        debug!("[ai_review] API Key 未配置");
        return Ok(AIReviewResponse {
            success: false,
            result: None,
            error: Some("请先配置 API Key".to_string()),
        });
    }

    // 2. 获取 Diff 内容
    debug!("[ai_review] 获取详细 diff...");
    let detailed_diff = match get_detailed_diff(&request.worktree_path, &request.target_branch) {
        Ok(diff) => {
            debug!("[ai_review] Diff 获取成功: {} 个文件", diff.files.len());
            diff
        },
        Err(e) => {
            debug!("[ai_review] Diff 获取失败: {}", e);
            return Ok(AIReviewResponse {
                success: false,
                result: None,
                error: Some(format!("获取代码变更失败: {}", e)),
            });
        }
    };

    // 3. 构造原始 diff 字符串
    let diff_content = build_diff_content(&detailed_diff);
    debug!("[ai_review] Diff 内容长度: {} 字符", diff_content.len());

    // 4. 获取 Diff 统计
    debug!("[ai_review] 获取 diff 统计...");
    let diff_summary = match get_diff(&request.worktree_path, &request.target_branch) {
        Ok(summary) => {
            debug!("[ai_review] Diff 统计获取成功");
            summary
        },
        Err(e) => {
            debug!("[ai_review] Diff 统计获取失败: {}", e);
            return Ok(AIReviewResponse {
                success: false,
                result: None,
                error: Some(format!("获取代码统计失败: {}", e)),
            });
        }
    };

    let stats = crate::models::ReviewDiffStats {
        additions: diff_summary.total_additions as u32,
        deletions: diff_summary.total_deletions as u32,
        changed_files: diff_summary.files.len() as u32,
    };
    debug!("[ai_review] 统计: +{} -{} 文件数:{}", stats.additions, stats.deletions, stats.changed_files);

    // 5. 调用 AI 服务
    debug!("[ai_review] 调用 AI 服务...");
    let service = AIService::new();
    match service.review_code(&config, &diff_content, &stats).await {
        Ok(mut result) => {
            debug!("[ai_review] AI 评审成功: {} 个问题", result.issues.len());
            // 6. 填充元数据
            result.worktree_path = request.worktree_path.clone();
            result.target_branch = request.target_branch.clone();

            Ok(AIReviewResponse {
                success: true,
                result: Some(result),
                error: None,
            })
        }
        Err(e) => {
            let error_msg = e.to_string();
            debug!("[ai_review] AI 评审失败: {}", error_msg);
            Ok(AIReviewResponse {
                success: false,
                result: None,
                error: Some(format!("AI 服务调用失败: {}", error_msg)),
            })
        }
    }
}

/// 从 DetailedDiffResponse 构造 diff 内容
fn build_diff_content(diff: &DetailedDiffResponse) -> String {
    let mut output = String::new();

    for file in &diff.files {
        // 跳过 markdown 文档和不需要评审的文件
        if file.path.ends_with(".md") || file.path.ends_with(".markdown") {
            debug!("[build_diff_content] 跳过文档文件: {}", file.path);
            continue;
        }

        // 文件头
        output.push_str(&format!("diff --git a/{} b/{}\n", file.path, file.path));

        if file.status == "added" {
            output.push_str("new file mode 100644\n");
            output.push_str(&format!("--- /dev/null\n+++ b/{}\n", file.path));
        } else if file.status == "deleted" {
            output.push_str("deleted file mode 100644\n");
            output.push_str(&format!("--- a/{}\n+++ /dev/null\n", file.path));
        } else if file.status == "renamed" {
            if let Some(old_path) = &file.old_path {
                output.push_str(&format!("rename from {}\nrename to {}\n", old_path, file.path));
            }
            output.push_str(&format!("--- a/{}\n+++ b/{}\n", file.old_path.as_ref().unwrap_or(&file.path), file.path));
        } else {
            output.push_str(&format!("--- a/{}\n+++ b/{}\n", file.path, file.path));
        }

        // Hunks
        for hunk in &file.hunks {
            output.push_str(&format!(
                "@@ -{},{} +{},{} @@\n",
                hunk.old_start, hunk.old_lines,
                hunk.new_start, hunk.new_lines
            ));

            for line in &hunk.lines {
                match line.line_type.as_str() {
                    "context" => output.push_str(&format!(" {}\n", line.content)),
                    "addition" => output.push_str(&format!("+{}\n", line.content)),
                    "deletion" => output.push_str(&format!("-{}\n", line.content)),
                    _ => {}
                }
            }
        }

        output.push('\n');
    }

    output
}

/// 获取配置路径
fn get_config_path() -> Result<std::path::PathBuf, String> {
    let home = dirs::config_dir().ok_or_else(|| "无法获取配置目录".to_string())?;
    let dir = home.join("git-worktree-manager");
    // 确保目录存在
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir.join("ai-config.json"))
}
