import { useState, useEffect } from 'react';
import {
  Bot,
  Key,
  Globe,
  Check,
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AIProvider, AIConfig } from '@/types/ai';
import { aiReviewStore } from '@/stores/aiReviewStore';
import { aiService } from '@/services/ai';

const PROVIDER_OPTIONS: { value: AIProvider; label: string; defaultModel: string }[] = [
  { value: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  { value: 'claude', label: 'Claude (Anthropic)', defaultModel: 'claude-3-5-haiku-20241022' },
  { value: 'ollama', label: 'Ollama (本地)', defaultModel: 'codellama' },
  { value: 'custom', label: '自定义端点', defaultModel: '' },
];

interface AIConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * AI 配置面板
 */
export function AIConfigPanel({ isOpen, onClose }: AIConfigPanelProps) {
  const config = aiReviewStore((state) => state.config);
  const setConfig = aiReviewStore((state) => state.setConfig);

  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 同步全局 config 变化到本地 state
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleProviderChange = (provider: AIProvider) => {
    const option = PROVIDER_OPTIONS.find((o) => o.value === provider)!;
    setLocalConfig((prev) => ({
      ...prev,
      provider,
      model: option.defaultModel || prev.model,
      // Ollama 不需要 API Key
      apiKey: provider === 'ollama' ? '' : prev.apiKey,
    }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (localConfig.provider !== 'ollama' && !localConfig.apiKey) {
      setTestResult(false);
      setTestError('请先输入 API Key');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestError(null);

    console.log('[AI 测试连接] 开始测试:', {
      provider: localConfig.provider,
      baseUrl: localConfig.baseUrl,
      model: localConfig.model,
      hasApiKey: !!localConfig.apiKey,
    });

    try {
      const response = await aiService.testConnection(localConfig);
      console.log('[AI 测试连接] 响应:', response);
      setTestResult(response.success);
      if (!response.success && response.error) {
        setTestError(response.error);
      }
    } catch (err) {
      console.error('[AI 测试连接] 错误:', err);
      setTestResult(false);
      setTestError(err instanceof Error ? err.message : '连接失败');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await aiService.saveConfig(localConfig);
      setConfig(localConfig);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 设置面板 */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI 评审设置
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <ChevronRight className="w-5 h-5 rotate-90" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-5">
          {/* AI 提供商 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI 提供商
            </label>
            <select
              value={localConfig.provider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key (Ollama 除外) */}
          {localConfig.provider !== 'ollama' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Key className="w-4 h-4" />
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={localConfig.apiKey}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                API Key 仅存储在本地，不会上传到任何服务器
              </p>
            </div>
          )}

          {/* 自定义端点 URL */}
          {localConfig.provider === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Globe className="w-4 h-4" />
                API 端点 URL
              </label>
              <input
                type="url"
                value={localConfig.baseUrl || ''}
                onChange={(e) =>
                  setLocalConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
                }
                placeholder="https://api.example.com/v1"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 模型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型
            </label>
            <input
              type="text"
              value={localConfig.model}
              onChange={(e) =>
                setLocalConfig((prev) => ({ ...prev, model: e.target.value }))
              }
              placeholder="gpt-4o-mini"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              {localConfig.provider === 'openai' && '推荐: gpt-4o-mini, gpt-4o'}
              {localConfig.provider === 'claude' && '推荐: claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022'}
              {localConfig.provider === 'ollama' && '推荐: codellama, llama3'}
            </p>
          </div>

          {/* 评审语言 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              评审语言
            </label>
            <select
              value={localConfig.language}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  language: e.target.value as 'zh' | 'en',
                }))
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* 测试连接 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={
                  isTesting ||
                  (localConfig.provider !== 'ollama' && !localConfig.apiKey)
                }
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                {isTesting ? '测试中...' : '测试连接'}
              </button>
              {testResult === true && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  连接成功
                </span>
              )}
              {testResult === false && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  连接失败
                </span>
              )}
            </div>
            {testError && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-xs">
                {testError}
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {saveError}
            </div>
          )}

          {/* 保存按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
