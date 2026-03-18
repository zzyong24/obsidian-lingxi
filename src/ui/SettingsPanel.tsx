/**
 * 设置面板组件
 * 参考 copilot 的 SettingsPage 实现
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AIChatSettings, ProviderConfig } from '@/types';

interface SettingsPanelProps {
  settings: AIChatSettings;
  onSettingsChange: (settings: AIChatSettings) => void;
  onTestConnection: (providerId: string) => Promise<boolean>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onTestConnection,
}) => {
  const [localSettings, setLocalSettings] = useState<AIChatSettings>(settings);
  const [testResults, setTestResults] = useState<Map<string, boolean | null>>(new Map());

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateProvider = useCallback((index: number, updates: Partial<ProviderConfig>) => {
    const newProviders = [...localSettings.providers];
    newProviders[index] = { ...newProviders[index], ...updates };
    const newSettings = { ...localSettings, providers: newProviders };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  }, [localSettings, onSettingsChange]);

  const updateSetting = useCallback(<K extends keyof AIChatSettings>(key: K, value: AIChatSettings[K]) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  }, [localSettings, onSettingsChange]);

  const handleTestConnection = useCallback(async (providerId: string) => {
    setTestResults(prev => new Map(prev).set(providerId, null)); // loading
    try {
      const result = await onTestConnection(providerId);
      setTestResults(prev => new Map(prev).set(providerId, result));
    } catch {
      setTestResults(prev => new Map(prev).set(providerId, false));
    }
  }, [onTestConnection]);

  return (
    <div className="ai-chat-settings">
      <h2>灵犀 设置</h2>

      {/* 模型提供商配置 */}
      <h3>模型提供商</h3>
      {localSettings.providers.map((provider, index) => (
        <div key={provider.id} className="ai-chat-settings-provider">
          <details>
            <summary className="ai-chat-settings-provider-header">
              <span>{provider.name}</span>
              {provider.apiKey && <span className="ai-chat-settings-badge">✓ 已配置</span>}
            </summary>

            <div className="ai-chat-settings-provider-body">
              <div className="ai-chat-settings-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={provider.apiKey}
                  onChange={(e) => updateProvider(index, { apiKey: e.target.value })}
                  placeholder="输入 API Key..."
                />
              </div>

              <div className="ai-chat-settings-field">
                <label>Base URL</label>
                <input
                  type="text"
                  value={provider.baseUrl}
                  onChange={(e) => updateProvider(index, { baseUrl: e.target.value })}
                />
              </div>

              <div className="ai-chat-settings-field">
                <label>默认模型</label>
                <input
                  type="text"
                  value={provider.defaultModel}
                  onChange={(e) => updateProvider(index, { defaultModel: e.target.value })}
                />
              </div>

              <button
                className="ai-chat-settings-test-btn"
                onClick={() => handleTestConnection(provider.id)}
                disabled={!provider.apiKey}
              >
                {testResults.get(provider.id) === null ? '测试中...' :
                  testResults.get(provider.id) === true ? '✓ 连接成功' :
                  testResults.get(provider.id) === false ? '✗ 连接失败' :
                  '测试连接'}
              </button>
            </div>
          </details>
        </div>
      ))}

      {/* 全局默认模型 */}
      <h3>默认模型</h3>
      <div className="ai-chat-settings-field">
        <label>默认文本模型</label>
        <select
          value={localSettings.defaultTextModel}
          onChange={(e) => updateSetting('defaultTextModel', e.target.value)}
        >
          <option value="">请选择...</option>
          {localSettings.providers
            .filter(p => p.apiKey)
            .map(p => (
              <option key={p.id} value={`${p.id}:${p.defaultModel}`}>
                {p.name} / {p.defaultModel}
              </option>
            ))}
        </select>
      </div>

      <div className="ai-chat-settings-field">
        <label>默认视觉模型</label>
        <select
          value={localSettings.defaultVisionModel}
          onChange={(e) => updateSetting('defaultVisionModel', e.target.value)}
        >
          <option value="">不使用</option>
          {localSettings.providers
            .filter(p => p.apiKey)
            .map(p => (
              <option key={p.id} value={`${p.id}:${p.defaultModel}`}>
                {p.name} / {p.defaultModel}
              </option>
            ))}
        </select>
      </div>

      {/* 场景设置 */}
      <h3>场景设置</h3>
      <div className="ai-chat-settings-field">
        <label>场景根文件夹路径</label>
        <input
          type="text"
          value={localSettings.scenesFolder}
          onChange={(e) => updateSetting('scenesFolder', e.target.value)}
          placeholder="skills-scenes"
        />
        <small className="ai-chat-settings-hint">
          包含所有场景、Skills 和 Rules 的根目录
        </small>
      </div>

      {/* 归档设置 */}
      <h3>归档设置</h3>
      <div className="ai-chat-settings-field">
        <label>默认归档文件夹</label>
        <input
          type="text"
          value={localSettings.defaultArchiveFolder}
          onChange={(e) => updateSetting('defaultArchiveFolder', e.target.value)}
        />
      </div>
      <div className="ai-chat-settings-field ai-chat-settings-toggle">
        <label>Skill 模式自动归档</label>
        <label className="ai-chat-switch">
          <input
            type="checkbox"
            checked={localSettings.autoArchive}
            onChange={(e) => updateSetting('autoArchive', e.target.checked)}
          />
          <span className="ai-chat-switch-slider" />
        </label>
      </div>

      {/* RAG 知识检索设置 */}
      <h3>知识检索（RAG）</h3>
      <div className="ai-chat-rag-card">
        {/* 启用开关 */}
        <div className="ai-chat-rag-toggle-row">
          <div className="ai-chat-rag-toggle-info">
            <span className="ai-chat-rag-toggle-label">启用知识检索</span>
            <span className="ai-chat-rag-toggle-desc">
              启用后，AI 对话时会自动从你的 Vault 笔记中检索相关内容作为参考
            </span>
          </div>
          <label className="ai-chat-switch">
            <input
              type="checkbox"
              checked={localSettings.ragEnabled}
              onChange={(e) => updateSetting('ragEnabled', e.target.checked)}
            />
            <span className="ai-chat-switch-slider" />
          </label>
        </div>

        {localSettings.ragEnabled && (
          <div className="ai-chat-rag-body">
            {/* Embedding 配置区 */}
            <div className="ai-chat-rag-section">
              <div className="ai-chat-rag-section-title">🔗 Embedding 配置</div>
              <div className="ai-chat-rag-grid">
                <div className="ai-chat-settings-field">
                  <label>提供商</label>
                  <select
                    value={localSettings.ragEmbeddingProvider}
                    onChange={(e) => updateSetting('ragEmbeddingProvider', e.target.value)}
                  >
                    <option value="">请选择...</option>
                    {localSettings.providers
                      .filter(p => p.apiKey)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <small className="ai-chat-settings-hint">
                    选择一个已配置 API Key 的提供商
                  </small>
                </div>

                <div className="ai-chat-settings-field">
                  <label>模型</label>
                  <input
                    type="text"
                    value={localSettings.ragEmbeddingModel}
                    onChange={(e) => updateSetting('ragEmbeddingModel', e.target.value)}
                    placeholder="如：text-embedding-v3"
                  />
                  <small className="ai-chat-settings-hint">
                    通义千问: text-embedding-v3 | 智谱: embedding-3
                  </small>
                </div>
              </div>
            </div>

            {/* 检索参数区 */}
            <div className="ai-chat-rag-section">
              <div className="ai-chat-rag-section-title">⚙️ 检索参数</div>

              <div className="ai-chat-settings-field">
                <div className="ai-chat-rag-slider-header">
                  <label>检索结果数量</label>
                  <span className="ai-chat-rag-slider-value">{localSettings.ragTopK}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={localSettings.ragTopK}
                  onChange={(e) => updateSetting('ragTopK', parseInt(e.target.value))}
                  className="ai-chat-rag-range"
                />
                <div className="ai-chat-rag-range-labels">
                  <span>1（精简）</span>
                  <span>10（丰富）</span>
                </div>
              </div>

              <div className="ai-chat-settings-field">
                <div className="ai-chat-rag-slider-header">
                  <label>相似度阈值</label>
                  <span className="ai-chat-rag-slider-value">{localSettings.ragSimilarityThreshold}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={localSettings.ragSimilarityThreshold}
                  onChange={(e) => updateSetting('ragSimilarityThreshold', parseFloat(e.target.value))}
                  className="ai-chat-rag-range"
                />
                <div className="ai-chat-rag-range-labels">
                  <span>0（高召回）</span>
                  <span>1（高精确）</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 界面设置 */}
      <h3>界面设置</h3>
      <div className="ai-chat-settings-field">
        <label>发送快捷键</label>
        <select
          value={localSettings.sendShortcut}
          onChange={(e) => updateSetting('sendShortcut', e.target.value as 'enter' | 'ctrl-enter')}
        >
          <option value="enter">Enter 发送</option>
          <option value="ctrl-enter">Ctrl+Enter 发送</option>
        </select>
      </div>
      <div className="ai-chat-settings-field ai-chat-settings-toggle">
        <label>流式输出</label>
        <label className="ai-chat-switch">
          <input
            type="checkbox"
            checked={localSettings.streamOutput}
            onChange={(e) => updateSetting('streamOutput', e.target.checked)}
          />
          <span className="ai-chat-switch-slider" />
        </label>
      </div>
      <div className="ai-chat-settings-field">
        <label>温度 ({localSettings.temperature})</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={localSettings.temperature}
          onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
        />
      </div>
      <div className="ai-chat-settings-field">
        <label>上下文消息数量 ({localSettings.maxContextMessages})</label>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          value={localSettings.maxContextMessages}
          onChange={(e) => updateSetting('maxContextMessages', parseInt(e.target.value))}
        />
      </div>
    </div>
  );
};
