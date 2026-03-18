/**
 * 设置管理器
 * 管理插件设置的加载、保存和访问
 */

import { AIChatSettings, DEFAULT_SETTINGS } from '@/types';

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
  const defaultProviderIds = DEFAULT_SETTINGS.providers.map(p => p.id);
  const savedProviderIds = new Set((result.providers || []).map(p => p.id));

  for (const defaultProvider of DEFAULT_SETTINGS.providers) {
    if (!savedProviderIds.has(defaultProvider.id)) {
      result.providers.push(defaultProvider);
    }
  }

  // 数值范围校验
  result.temperature = Math.max(0, Math.min(2, Number(result.temperature) || 0.7));
  result.maxContextMessages = Math.max(1, Math.min(100, Number(result.maxContextMessages) || 20));

  return result;
}
