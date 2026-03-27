use crate::utils::validation::validate_path;
use std::process::Command;

/// 转义路径中的特殊字符，防止命令注入
///
/// 对不同平台进行不同的转义处理：
/// - Windows: 处理 PowerShell 和 CMD 的特殊字符
/// - Unix (macOS/Linux): 处理 shell 特殊字符
#[allow(dead_code)]
fn escape_path_for_shell(path: &str) -> String {
    // 首先验证路径是合法的
    if validate_path(path).is_err() {
        return path.to_string();
    }

    #[cfg(target_os = "windows")]
    {
        // Windows PowerShell 转义：
        // - 将单引号替换为两个单引号（PowerShell 的转义方式）
        // - 然后用单引号包裹整个路径
        let escaped = path.replace("'", "''");
        format!("'{}'", escaped)
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Unix (macOS/Linux) shell 转义：
        // - 使用单引号包裹，内部单引号用 '\'' 转义
        let escaped = path.replace("'", "'\\''");
        format!("'{}'", escaped)
    }
}

/// 在终端中打开
pub fn open_in_terminal(path: &str, terminal: Option<String>, custom_path: Option<String>) -> anyhow::Result<()> {
    let terminal_type = terminal.unwrap_or_else(|| "terminal".to_string());

    // 验证路径
    validate_path(path).map_err(|e| anyhow::anyhow!(e))?;

    // 如果是 custom 类型，使用自定义路径
    if terminal_type == "custom" {
        let cmd = custom_path.unwrap_or_else(|| "terminal".to_string());
        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .args(["-a", &cmd, path])
                .spawn()?;
        }
        #[cfg(not(target_os = "macos"))]
        {
            Command::new(&cmd).arg(path).spawn()?;
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        match terminal_type.as_str() {
            "iterm2" => {
                Command::new("open")
                    .args(["-a", "iTerm", path])
                    .spawn()?;
            }
            "warp" => {
                Command::new("open")
                    .args(["-a", "Warp", path])
                    .spawn()?;
            }
            _ => {
                // 默认 Terminal
                Command::new("open")
                    .args(["-a", "Terminal", path])
                    .spawn()?;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows 路径转义：使用单引号包裹并转义内部单引号
        let escaped_path = escape_path_for_shell(path);

        match terminal_type.as_str() {
            "powershell" => {
                // PowerShell: 使用转义后的路径
                Command::new("powershell")
                    .args(["-Command", &format!("Start-Process powershell -ArgumentList '-NoExit', '-Command', {}", escaped_path)])
                    .spawn()?;
            }
            "wt" => {
                // Windows Terminal: 使用原始路径（Command API 会自动处理）
                Command::new("wt")
                    .args(["-d", path])
                    .spawn()?;
            }
            _ => {
                // 默认 CMD: 使用转义后的路径
                Command::new("cmd")
                    .args(["/C", "start", "cmd", "/K", &format!("cd {}", escaped_path)])
                    .spawn()?;
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        match terminal_type.as_str() {
            "alacritty" => {
                Command::new("alacritty")
                    .args(["--working-directory", path])
                    .spawn()?;
            }
            _ => {
                // 默认 gnome-terminal
                Command::new("gnome-terminal")
                    .args(["--working-directory", path])
                    .spawn()?;
            }
        }
    }

    Ok(())
}

/// 在编辑器中打开
pub fn open_in_editor(path: &str, editor: Option<String>, custom_path: Option<String>) -> anyhow::Result<()> {
    // 验证路径
    validate_path(path).map_err(|e| anyhow::anyhow!(e))?;

    let editor_type = editor.unwrap_or_else(|| "vscode".to_string());

    // 如果是 custom 类型，使用自定义路径
    if editor_type == "custom" {
        let cmd = custom_path.unwrap_or_else(|| "code".to_string());
        Command::new(&cmd).arg(path).spawn()?;
        return Ok(());
    }

    match editor_type.as_str() {
        "vscode" => {
            Command::new("code").arg(path).spawn()?;
        }
        "vscode-insiders" => {
            Command::new("code-insiders").arg(path).spawn()?;
        }
        "cursor" => {
            Command::new("cursor").arg(path).spawn()?;
        }
        "webstorm" => {
            Command::new("webstorm").arg(path).spawn()?;
        }
        "intellij" => {
            Command::new("idea").arg(path).spawn()?;
        }
        _ => {
            // 其他情况（兼容旧版本）
            Command::new(&editor_type).arg(path).spawn()?;
        }
    }

    Ok(())
}

/// 在文件管理器中打开
pub fn open_in_file_manager(path: &str) -> anyhow::Result<()> {
    // 验证路径
    validate_path(path).map_err(|e| anyhow::anyhow!(e))?;

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", path])
            .spawn()?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", path])
            .spawn()?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()?;
    }

    Ok(())
}
