import { invoke } from '@tauri-apps/api/core';
import {
  AIConfig,
  AIReviewRequest,
  AIReviewResponse,
  AITestConnectionResponse,
} from '@/types/ai';

/**
 * AI 服务
 * 封装 Tauri 命令调用
 */
export const aiService = {
  /**
   * 保存 AI 配置
   */
  async saveConfig(config: AIConfig): Promise<void> {
    await invoke('save_ai_config', { config });
  },

  /**
   * 获取 AI 配置
   */
  async getConfig(): Promise<AIConfig> {
    return await invoke('get_ai_config');
  },

  /**
   * 测试 AI 连接
   */
  async testConnection(config: AIConfig): Promise<AITestConnectionResponse> {
    return await invoke('test_ai_connection', { config });
  },

  /**
   * 执行 AI 评审
   */
  async review(request: AIReviewRequest): Promise<AIReviewResponse> {
    return await invoke('ai_review', { request });
  },
};
