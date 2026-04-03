use crate::models::{OperationLog, OperationLogListResponse, OperationLogFilter, OperationType, OperationResult};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::PathBuf;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;

/// 操作日志存储目录
fn get_log_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".worktree-manager").join("logs")
}

/// 日志文件路径
fn get_log_file() -> PathBuf {
    get_log_dir().join("operations.jsonl")
}

/// 确保日志目录存在
fn ensure_log_dir() -> anyhow::Result<()> {
    let dir = get_log_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(())
}

/// 生成日志 ID
fn generate_log_id() -> String {
    Uuid::new_v4().to_string()
}

/// 记录操作日志
pub fn record_operation(
    repo_path: &str,
    operation_type: OperationType,
    target: &str,
    details: Option<String>,
    result: OperationResult,
    error_message: Option<String>,
) -> anyhow::Result<OperationLog> {
    ensure_log_dir()?;

    let log = OperationLog {
        id: generate_log_id(),
        operation_type,
        timestamp: Utc::now().to_rfc3339(),
        target: target.to_string(),
        details,
        result,
        error_message,
        repo_path: repo_path.to_string(),
    };

    // 写入日志文件 (JSONL 格式，每行一个 JSON)
    let log_file = get_log_file();
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)?;

    let mut writer = BufWriter::new(file);
    let json = serde_json::to_string(&log)?;
    writer.write_all(json.as_bytes())?;
    writer.write_all(b"\n")?;
    writer.flush()?;

    Ok(log)
}

/// 读取所有日志
fn read_all_logs() -> anyhow::Result<Vec<OperationLog>> {
    let log_file = get_log_file();
    if !log_file.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&log_file)?;
    let reader = BufReader::new(file);

    let logs: Vec<OperationLog> = reader
        .lines()
        .map_while(Result::ok)
        .filter_map(|line| serde_json::from_str(&line).ok())
        .collect();

    Ok(logs)
}

/// 获取操作日志列表
pub fn list_operations(filter: Option<OperationLogFilter>) -> anyhow::Result<OperationLogListResponse> {
    let logs = read_all_logs()?;

    let filtered: Vec<OperationLog> = logs
        .into_iter()
        .filter(|log| {
            if let Some(f) = &filter {
                // 时间筛选
                if let Some(start) = &f.start_time {
                    let start_time = DateTime::parse_from_rfc3339(start).ok();
                    let log_time = DateTime::parse_from_rfc3339(&log.timestamp).ok();
                    if let (Some(s), Some(l)) = (start_time, log_time) {
                        if l < s {
                            return false;
                        }
                    }
                }
                if let Some(end) = &f.end_time {
                    let end_time = DateTime::parse_from_rfc3339(end).ok();
                    let log_time = DateTime::parse_from_rfc3339(&log.timestamp).ok();
                    if let (Some(e), Some(l)) = (end_time, log_time) {
                        if l > e {
                            return false;
                        }
                    }
                }
                // 操作类型筛选
                if let Some(op_type) = &f.operation_type {
                    if log.operation_type != *op_type {
                        return false;
                    }
                }
                // 结果筛选
                if let Some(result) = &f.result {
                    if log.result != *result {
                        return false;
                    }
                }
                // 仓库路径筛选
                if let Some(repo) = &f.repo_path {
                    if log.repo_path != *repo {
                        return false;
                    }
                }
            }
            true
        })
        .collect();

    Ok(OperationLogListResponse {
        logs: filtered.clone(),
        total_count: filtered.len(),
    })
}

/// 导出操作日志为 JSON 文件
pub fn export_operations(output_path: &str) -> anyhow::Result<String> {
    let response = list_operations(None)?;
    let json = serde_json::to_string_pretty(&response)?;

    fs::write(output_path, &json)?;

    Ok(format!("导出 {} 条日志到 {}", response.total_count, output_path))
}

/// 清理过期日志（超过 30 天）
pub fn cleanup_old_logs() -> anyhow::Result<usize> {
    let logs = read_all_logs()?;
    let now = Utc::now();
    let threshold = now - Duration::days(30);

    let remaining: Vec<OperationLog> = logs
        .into_iter()
        .filter(|log| {
            let log_time = DateTime::parse_from_rfc3339(&log.timestamp).ok();
            if let Some(t) = log_time {
                t.with_timezone(&Utc) > threshold
            } else {
                true // 无法解析时间的保留
            }
        })
        .collect();

    let removed_count = read_all_logs()?.len() - remaining.len();

    if removed_count > 0 {
        // 重写日志文件
        let log_file = get_log_file();
        let file = File::create(&log_file)?;
        let mut writer = BufWriter::new(file);

        for log in remaining {
            let json = serde_json::to_string(&log)?;
            writer.write_all(json.as_bytes())?;
            writer.write_all(b"\n")?;
        }
        writer.flush()?;
    }

    Ok(removed_count)
}