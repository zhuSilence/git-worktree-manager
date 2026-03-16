import { Command } from '@tauri-apps/plugin-shell'

/**
 * Shell 服务 - 封装系统命令执行
 */
export const shellService = {
  /**
   * 执行 Git 命令
   */
  async executeGit(args: string[], cwd?: string): Promise<string> {
    const command = Command.create('git', args, cwd ? { cwd } : undefined)
    const output = await command.execute()

    if (output.code !== 0) {
      throw new Error(output.stderr || 'Git 命令执行失败')
    }

    return output.stdout
  },

  /**
   * 执行自定义命令
   */
  async executeCommand(program: string, args: string[], cwd?: string): Promise<string> {
    const command = Command.create(program, args, cwd ? { cwd } : undefined)
    const output = await command.execute()

    if (output.code !== 0) {
      throw new Error(output.stderr || '命令执行失败')
    }

    return output.stdout
  },

  /**
   * 检查命令是否存在
   */
  async commandExists(command: string): Promise<boolean> {
    try {
      const which = Command.create('which', [command])
      const output = await which.execute()
      return output.code === 0
    } catch {
      return false
    }
  },

  /**
   * 获取系统默认终端
   */
  getDefaultTerminal(): string {
    const platform = navigator.platform.toLowerCase()

    if (platform.includes('mac')) {
      return 'Terminal'
    } else if (platform.includes('win')) {
      return 'cmd'
    } else {
      return 'x-terminal-emulator'
    }
  },

  /**
   * 获取系统默认编辑器
   */
  getDefaultEditor(): string {
    const platform = navigator.platform.toLowerCase()

    if (platform.includes('mac')) {
      return 'code'
    } else {
      return 'code'
    }
  },
}