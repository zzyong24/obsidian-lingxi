/**
 * 设置管理器
 * 管理插件设置的加载、保存和访问
 */

import { AIChatSettings, DEFAULT_SETTINGS, PROVIDER_PRESETS } from '@/types';

/** 当前设置的单例存储 */
let currentSettings: AIChatSettings = { ...DEFAULT_SETTINGS };

/** 设置变更监听回调 */
type SettingsChangeCallback = (settings: AIChatSettings) => void;
const listeners: SettingsChangeCallback[] = [];

/**
 * 获取当前设置
 */
export function getSettings(): Readonly<AIChatSettings> {
  return currentSettings;
}

/**
 * 设置（覆盖）
 */
export function setSettings(settings: AIChatSettings): void {
  currentSettings = { ...settings };
  notifyListeners();
}

/**
 * 更新部分设置
 */
export function updateSettings(partial: Partial<AIChatSettings>): void {
  currentSettings = { ...currentSettings, ...partial };
  notifyListeners();
}

/**
 * 订阅设置变更
 */
export function onSettingsChange(callback: SettingsChangeCallback): () => void {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index >= 0) listeners.splice(index, 1);
  };
}

/**
 * 通知所有监听器
 */
function notifyListeners(): void {
  for (const listener of listeners) {
    listener(currentSettings);
  }
}

/**
 * 合并用户保存的设置与默认设置
 */
export function sanitizeSettings(saved: Partial<AIChatSettings> | null): AIChatSettings {
  if (!saved) return { ...DEFAULT_SETTINGS };

  const result = { ...DEFAULT_SETTINGS, ...saved };

  // 确保 providers 数组中包含所有预设的提供商
  const savedProviderIds = new Set((result.providers || []).map(p => p.id));

  for (const defaultProvider of DEFAULT_SETTINGS.providers) {
    if (!savedProviderIds.has(defaultProvider.id)) {
      result.providers.push({ ...defaultProvider });
    }
  }

  // 对已有 Provider 补全 defaultEmbeddingModel（从预设表中同步）
  for (const provider of result.providers) {
    const preset = PROVIDER_PRESETS.find(p => p.id === provider.id);
    if (preset && !provider.defaultEmbeddingModel && preset.defaultEmbeddingModel) {
      provider.defaultEmbeddingModel = preset.defaultEmbeddingModel;
    }
    // 如果 baseUrl 为空，从预设恢复
    if (preset && !provider.baseUrl) {
      provider.baseUrl = preset.baseUrl;
    }
  }

  // 数值范围校验
  result.temperature = Math.max(0, Math.min(2, Number(result.temperature) || 0.7));
  result.maxContextMessages = Math.max(1, Math.min(100, Number(result.maxContextMessages) || 20));

  // 旧值迁移：_ai_output → AI笔记
  if (result.defaultArchiveFolder === '_ai_output') {
    result.defaultArchiveFolder = 'AI笔记';
  }

  // RAG 设置校验
  result.ragTopK = Math.max(1, Math.min(10, Number(result.ragTopK) || 3));
  result.ragSimilarityThreshold = Math.max(0, Math.min(1, Number(result.ragSimilarityThreshold) || 0.3));
  if (result.ragEmbeddingApiKey === undefined) result.ragEmbeddingApiKey = '';
  if (result.ragEmbeddingBaseUrl === undefined) result.ragEmbeddingBaseUrl = '';

  // Harness 设置校验
  result.harnessMemoryLimit = Math.max(10, Math.min(2000, Number(result.harnessMemoryLimit) || 500));
  result.harnessRecallTopK = Math.max(1, Math.min(20, Number(result.harnessRecallTopK) || 5));
  result.harnessCompactionThreshold = Math.max(0.5, Math.min(0.95, Number(result.harnessCompactionThreshold) || 0.85));

  return result;
}
