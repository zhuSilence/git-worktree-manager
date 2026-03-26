use crate::models::{AIConfig, AIProvider, AIReviewRequest, AIReviewResponse, DetailedDiffResponse, AITestConnectionResponse};
use crate::services::ai_service::AIService;
use crate::services::git_service;

/// 保存 AI 配置
#[tauri::command]
pub async fn save_ai_config(config: AIConfig) -> Result<(), String> {
    // 存储配置到本地文件
    let config_path = get_config_path()?;
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || std::fs::write(&config_path, json))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 获取 AI 配置
#[tauri::command]
pub async fn get_ai_config() -> Result<AIConfig, String> {
    let config_path = get_config_path()?;

    let content = tokio::task::spawn_blocking(move || std::fs::read_to_string(&config_path))
        .await
        .map_err(|e| e.to_string())?;

    match content {
        Ok(content) => {
            let config: AIConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            Ok(config)
        }
        Err(_) => Ok(AIConfig::default()),
    }
}

/// 测试 AI 连接
#[tauri::command]
pub async fn test_ai_connection(config: AIConfig) -> Result<AITestConnectionResponse, String> {
    println!("[test_ai_connection] 开始测试连接: provider={:?}, base_url={:?}, model={}",
        config.provider, config.base_url, config.model);

    let service = AIService::new();
    match service.test_connection(&config).await {
        Ok(success) => {
            println!("[test_ai_connection] 测试成功: {}", success);
            Ok(AITestConnectionResponse {
                success,
                error: if success { None } else { Some("连接失败，请检查配置".to_string()) },
            })
        }
        Err(e) => {
            let error_msg = e.to_string();
            println!("[test_ai_connection] 测试失败: {}", error_msg);
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
    println!("[ai_review] 开始评审: worktree_path={}, target_branch={}",
        request.worktree_path, request.target_branch);

    // 1. 获取 AI 配置
    let config = match get_ai_config().await {
        Ok(cfg) => {
            println!("[ai_review] 配置加载成功: provider={:?}, model={}", cfg.provider, cfg.model);
            cfg
        },
        Err(e) => {
            println!("[ai_review] 配置加载失败: {}", e);
            return Ok(AIReviewResponse {
                success: false,
                result: None,
                error: Some(format!("配置加载失败: {}", e)),
            });
        }
    };

    if config.api_key.is_empty() && config.provider != AIProvider::Ollama {
        println!("[ai_review] API Key 未配置");
        return Ok(AIReviewResponse {
            success: false,
            result: None,
            error: Some("请先配置 API Key".to_string()),
        });
    }

    // 2. 获取 Diff 内容
    println!("[ai_review] 获取详细 diff...");
    let detailed_diff = match git_service::get_detailed_diff(&request.worktree_path, &request.target_branch) {
        Ok(diff) => {
            println!("[ai_review] Diff 获取成功: {} 个文件", diff.files.len());
            diff
        },
        Err(e) => {
            println!("[ai_review] Diff 获取失败: {}", e);
            return Ok(AIReviewResponse {
                success: false,
                result: None,
                error: Some(format!("获取代码变更失败: {}", e)),
            });
        }
    };

    // 3. 构造原始 diff 字符串
    let diff_content = build_diff_content(&detailed_diff);
    println!("[ai_review] Diff 内容长度: {} 字符", diff_content.len());

    // 4. 获取 Diff 统计
    println!("[ai_review] 获取 diff 统计...");
    let diff_summary = match git_service::get_diff(&request.worktree_path, &request.target_branch) {
        Ok(summary) => {
            println!("[ai_review] Diff 统计获取成功");
            summary
        },
        Err(e) => {
            println!("[ai_review] Diff 统计获取失败: {}", e);
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
    println!("[ai_review] 统计: +{} -{} 文件数:{}", stats.additions, stats.deletions, stats.changed_files);

    // 5. 调用 AI 服务
    println!("[ai_review] 调用 AI 服务...");
    let service = AIService::new();
    match service.review_code(&config, &diff_content, &stats).await {
        Ok(mut result) => {
            println!("[ai_review] AI 评审成功: {} 个问题", result.issues.len());
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
            println!("[ai_review] AI 评审失败: {}", error_msg);
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
            println!("[build_diff_content] 跳过文档文件: {}", file.path);
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
