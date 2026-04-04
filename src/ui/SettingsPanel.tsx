/**
 * 设置面板组件
 * 参考 copilot 的 SettingsPage 实现
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AIChatSettings, ProviderConfig, ScheduleTask, PROVIDER_PRESETS } from '@/types';
import type { Scheduler } from '@/harness/Scheduler';

interface SettingsPanelProps {
  settings: AIChatSettings;
  onSettingsChange: (settings: AIChatSettings) => void;
  onTestConnection: (providerId: string) => Promise<string | null>;
  onTestEmbedding: () => Promise<string | null>;
  onRebuildIndex: () => Promise<{ ok: boolean; message: string; indexPath?: string }>;
  /** 用 LLM 优化任务 Prompt */
  onEnhanceTaskPrompt: (name: string, description: string, schedule: string) => Promise<string>;
  scheduler?: Scheduler;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onTestConnection,
  onTestEmbedding,
  onRebuildIndex,
  onEnhanceTaskPrompt,
  scheduler,
}) => {
  const [localSettings, setLocalSettings] = useState<AIChatSettings>(settings);
  const [testResults, setTestResults] = useState<Map<string, string | null>>(new Map());
  const [ragTestResult, setRagTestResult] = useState<'idle' | 'loading' | 'ok' | string>('idle');
  const [rebuildStatus, setRebuildStatus] = useState<'idle' | 'loading' | string>('idle');

  // 自驱动任务状态
  type TaskStatus = ScheduleTask & { isDue: boolean };
  const [taskList, setTaskList] = useState<TaskStatus[]>([]);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const taskRefreshRef = useRef(false);
  // 新建任务表单状态
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskSchedule, setNewTaskSchedule] = useState<'daily' | 'weekly' | 'onOpen'>('daily');
  const [newTaskPrompt, setNewTaskPrompt] = useState('');
  const [newTaskSaving, setNewTaskSaving] = useState(false);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);

  // 刷新任务列表
  const refreshTasks = useCallback(() => {
    if (!scheduler) return;
    setTaskList(scheduler.getTaskStatus() as TaskStatus[]);
  }, [scheduler]);

  useEffect(() => {
    if (scheduler && !taskRefreshRef.current) {
      taskRefreshRef.current = true;
      refreshTasks();
    }
  }, [scheduler, refreshTasks]);

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
    setTestResults(prev => new Map(prev).set(providerId, 'loading'));
    try {
      const error = await onTestConnection(providerId);
      setTestResults(prev => new Map(prev).set(providerId, error === null ? 'ok' : error));
    } catch (e) {
      setTestResults(prev => new Map(prev).set(providerId, e instanceof Error ? e.message : '未知错误'));
    }
  }, [onTestConnection]);

  return (
    <div className="ai-chat-settings">
      <h2>灵犀 设置</h2>

      {/* 模型提供商配置 */}
      <h3>模型提供商</h3>
      {localSettings.providers.map((provider, index) => {
        const preset = PROVIDER_PRESETS.find(p => p.id === provider.id);
        return (
          <div key={provider.id} className="ai-chat-settings-provider">
            <details>
              <summary className="ai-chat-settings-provider-header">
                <span>{provider.name}</span>
                {provider.apiKey
                  ? <span className="ai-chat-settings-badge">✓ 已配置</span>
                  : <span className="ai-chat-settings-badge-empty">未配置</span>
                }
              </summary>

              <div className="ai-chat-settings-provider-body">
                <div className="ai-chat-settings-field">
                  <div className="ai-chat-settings-label-row">
                    <label>API Key</label>
                    {preset?.keyUrl && (
                      <a
                        href={preset.keyUrl}
                        className="ai-chat-settings-get-key-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        获取 Key →
                      </a>
                    )}
                  </div>
                  <div className="ai-chat-settings-key-row">
                    <input
                      type="password"
                      value={provider.apiKey}
                      onChange={(e) => updateProvider(index, { apiKey: e.target.value })}
                      placeholder="粘贴 API Key..."
                    />
                    {provider.apiKey && (
                      <button
                        className="ai-chat-settings-clear-btn"
                        title="清空 API Key"
                        onClick={() => updateProvider(index, { apiKey: '' })}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="ai-chat-settings-field">
                  <label>默认模型</label>
                  <input
                    type="text"
                    value={provider.defaultModel}
                    onChange={(e) => updateProvider(index, { defaultModel: e.target.value })}
                    placeholder={preset?.defaultModel || '模型名称'}
                  />
                </div>

                {/* Base URL 折叠（高级） */}
                <details className="ai-chat-settings-advanced">
                  <summary className="ai-chat-settings-advanced-toggle">高级设置</summary>
                  <div className="ai-chat-settings-field" style={{ marginTop: 8 }}>
                    <div className="ai-chat-settings-label-row">
                      <label>Base URL</label>
                      {preset && provider.baseUrl !== preset.baseUrl && (
                        <button
                          className="ai-chat-rag-copy-key-btn"
                          onClick={() => updateProvider(index, { baseUrl: preset.baseUrl })}
                        >
                          ↩ 恢复默认
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={provider.baseUrl}
                      onChange={(e) => updateProvider(index, { baseUrl: e.target.value })}
                      placeholder={preset?.baseUrl || 'https://...'}
                    />
                  </div>
                </details>

                <button
                  className="ai-chat-settings-test-btn"
                  onClick={() => { void handleTestConnection(provider.id); }}
                  disabled={!provider.apiKey}
                >
                  {testResults.get(provider.id) === 'loading' ? '测试中...' :
                    testResults.get(provider.id) === 'ok' ? '✓ 连接成功' :
                    testResults.get(provider.id) ? '✗ 连接失败' :
                    '测试连接'}
                </button>
                {(() => {
                  const r = testResults.get(provider.id);
                  if (r && r !== 'loading' && r !== 'ok') {
                    return <div className="ai-chat-settings-test-error">{r}</div>;
                  }
                  return null;
                })()}
              </div>
            </details>
          </div>
        );
      })}

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
        <label>自动归档 AI 回复</label>
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

              <div className="ai-chat-settings-field">
                <label>Embedding 服务商
                  {localSettings.ragEmbeddingApiKey?.trim() && (
                    <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>
                      （已填独立 Key，可不选）
                    </span>
                  )}
                </label>
                <select
                  value={localSettings.ragEmbeddingProvider}
                  onChange={(e) => {
                    const pid = e.target.value;
                    updateSetting('ragEmbeddingProvider', pid);
                    if (pid) {
                      const p = localSettings.providers.find(x => x.id === pid);
                      if (p?.defaultEmbeddingModel) {
                        updateSetting('ragEmbeddingModel', p.defaultEmbeddingModel);
                      }
                    }
                  }}
                >
                  <option value="">
                    {localSettings.ragEmbeddingApiKey?.trim() ? '不选（使用独立 Key）' : '请选择...'}
                  </option>
                  {localSettings.providers
                    .filter(p => p.apiKey)
                    .map(p => {
                      const preset = PROVIDER_PRESETS.find(x => x.id === p.id);
                      const hasEmbed = p.defaultEmbeddingModel || preset?.defaultEmbeddingModel;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name}{hasEmbed ? ' ✓' : '（需独立 Key）'}
                        </option>
                      );
                    })}
                </select>
                {/* 状态说明 */}
                {(() => {
                  const hasIndepKey = localSettings.ragEmbeddingApiKey?.trim();
                  const hasIndepUrl = localSettings.ragEmbeddingBaseUrl?.trim();
                  const pid = localSettings.ragEmbeddingProvider;
                  const p = localSettings.providers.find(x => x.id === pid);

                  if (hasIndepKey && hasIndepUrl) {
                    return <small className="ai-chat-settings-hint" style={{ color: 'var(--text-success)' }}>
                      ✓ 使用独立 Embedding 配置（{hasIndepUrl}）
                    </small>;
                  }
                  if (hasIndepKey && !hasIndepUrl && p) {
                    return <small className="ai-chat-settings-hint" style={{ color: 'var(--text-success)' }}>
                      ✓ 使用独立 Key + {p.name} 的 Base URL
                    </small>;
                  }
                  if (!hasIndepKey && p) {
                    const hasEmbed = p.defaultEmbeddingModel;
                    if (!hasEmbed) {
                      return <small className="ai-chat-settings-hint" style={{ color: 'var(--color-orange)' }}>
                        ⚠️ {p.name} 不支持 Embedding，请展开「独立 Embedding Key」填入支持 Embedding 的 Key 和 Base URL
                      </small>;
                    }
                    return <small className="ai-chat-settings-hint">✓ 复用 {p.name} 的 Key（{p.baseUrl}）</small>;
                  }
                  return <small className="ai-chat-settings-hint">
                    推荐：通义千问 ✓、智谱 ✓、SiliconFlow ✓；或展开下方「独立 Embedding Key」填入任意服务商
                  </small>;
                })()}
              </div>

              <div className="ai-chat-settings-field">
                <label>Embedding 模型</label>
                <input
                  type="text"
                  value={localSettings.ragEmbeddingModel}
                  onChange={(e) => updateSetting('ragEmbeddingModel', e.target.value)}
                  placeholder="选择服务商后自动填入"
                />
                <small className="ai-chat-settings-hint">
                  通义千问: text-embedding-v3 · 智谱: embedding-3 · SiliconFlow: BAAI/bge-large-zh-v1.5
                </small>
              </div>

              {/* 独立 Key 折叠（高级） */}
              <details className="ai-chat-settings-advanced">
                <summary className="ai-chat-settings-advanced-toggle">独立 Embedding Key（高级）</summary>
                <div style={{ marginTop: 8 }}>
                  <div className="ai-chat-settings-field">
                    <label>Embedding API Key</label>
                    <input
                      type="password"
                      value={localSettings.ragEmbeddingApiKey}
                      onChange={(e) => updateSetting('ragEmbeddingApiKey', e.target.value)}
                      placeholder="留空则复用上方服务商的 Key"
                    />
                  </div>
                  <div className="ai-chat-settings-field">
                    <label>Embedding Base URL</label>
                    <input
                      type="text"
                      value={localSettings.ragEmbeddingBaseUrl}
                      onChange={(e) => updateSetting('ragEmbeddingBaseUrl', e.target.value)}
                      placeholder="留空则复用上方服务商的 Base URL"
                    />
                    <small className="ai-chat-settings-hint">
                      ⚠️ 独立 Key 与对话 Key 分开存储
                    </small>
                  </div>
                </div>
              </details>

              {/* 测试 Embedding 连接 */}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className="ai-chat-settings-test-btn"
                  disabled={ragTestResult === 'loading'}
                  onClick={async () => {
                    setRagTestResult('loading');
                    const err = await onTestEmbedding();
                    setRagTestResult(err === null ? 'ok' : err);
                  }}
                >
                  {ragTestResult === 'loading' ? '测试中...' :
                   ragTestResult === 'ok' ? '✓ 连接成功' :
                   ragTestResult !== 'idle' ? '✗ 连接失败' : '测试 Embedding 连接'}
                </button>
                {ragTestResult !== 'idle' && ragTestResult !== 'loading' && ragTestResult !== 'ok' && (
                  <div className="ai-chat-settings-test-error" style={{ flex: 1 }}>
                    {ragTestResult}
                  </div>
                )}
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

              {/* 重建索引 */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="ai-chat-settings-test-btn"
                    disabled={rebuildStatus === 'loading'}
                    onClick={async () => {
                      setRebuildStatus('loading');
                      const result = await onRebuildIndex();
                      setRebuildStatus(result.message);
                    }}
                  >
                    {rebuildStatus === 'loading' ? '🔄 重建中...' : '🔄 重建索引'}
                  </button>
                  {rebuildStatus === 'loading' && (
                    <small className="ai-chat-settings-hint">正在扫描 Vault 并生成 Embedding，文件多时需要几分钟...</small>
                  )}
                </div>
                {rebuildStatus !== 'idle' && rebuildStatus !== 'loading' && (
                  <div className={`ai-chat-rebuild-result ${rebuildStatus.startsWith('索引已保存') ? 'ok' : 'err'}`}>
                    {rebuildStatus.split('\n').map((line, i) => (
                      <div key={i} style={{ fontFamily: i === rebuildStatus.split('\n').length - 1 ? 'var(--font-monospace)' : undefined, fontSize: i === rebuildStatus.split('\n').length - 1 ? 11 : undefined }}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Harness 智能记忆设置 */}
      <h3>智能记忆 (Harness)</h3>
      <div className="ai-chat-rag-card">
        {/* 启用开关 */}
        <div className="ai-chat-rag-toggle-row">
          <div className="ai-chat-rag-toggle-info">
            <span className="ai-chat-rag-toggle-label">启用持久记忆</span>
            <span className="ai-chat-rag-toggle-desc">
              AI 会记住你的偏好和关键信息，下次对话自动加载
            </span>
          </div>
          <label className="ai-chat-switch">
            <input
              type="checkbox"
              checked={localSettings.harnessEnabled}
              onChange={(e) => updateSetting('harnessEnabled', e.target.checked)}
            />
            <span className="ai-chat-switch-slider" />
          </label>
        </div>

        {localSettings.harnessEnabled && (
          <div className="ai-chat-rag-body">
            {/* 记忆设置 */}
            <div className="ai-chat-rag-section">
              <div className="ai-chat-rag-section-title">🧠 记忆设置</div>

              <div className="ai-chat-rag-toggle-row">
                <div className="ai-chat-rag-toggle-info">
                  <span className="ai-chat-rag-toggle-label">自动提取记忆</span>
                  <span className="ai-chat-rag-toggle-desc">
                    对话结束后自动提取关键信息保存为记忆
                  </span>
                </div>
                <label className="ai-chat-switch">
                  <input
                    type="checkbox"
                    checked={localSettings.harnessAutoExtract}
                    onChange={(e) => updateSetting('harnessAutoExtract', e.target.checked)}
                  />
                  <span className="ai-chat-switch-slider" />
                </label>
              </div>

              <div className="ai-chat-settings-field">
                <div className="ai-chat-rag-slider-header">
                  <label>记忆条目上限</label>
                  <span className="ai-chat-rag-slider-value">{localSettings.harnessMemoryLimit}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="2000"
                  step="10"
                  value={localSettings.harnessMemoryLimit}
                  onChange={(e) => updateSetting('harnessMemoryLimit', parseInt(e.target.value))}
                  className="ai-chat-rag-range"
                />
                <div className="ai-chat-rag-range-labels">
                  <span>10（精简）</span>
                  <span>2000（丰富）</span>
                </div>
              </div>

              <div className="ai-chat-settings-field">
                <div className="ai-chat-rag-slider-header">
                  <label>每次召回条数</label>
                  <span className="ai-chat-rag-slider-value">{localSettings.harnessRecallTopK}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={localSettings.harnessRecallTopK}
                  onChange={(e) => updateSetting('harnessRecallTopK', parseInt(e.target.value))}
                  className="ai-chat-rag-range"
                />
                <div className="ai-chat-rag-range-labels">
                  <span>1（精简）</span>
                  <span>20（丰富）</span>
                </div>
              </div>
            </div>

            {/* 压缩设置 */}
            <div className="ai-chat-rag-section">
              <div className="ai-chat-rag-section-title">🗜️ 上下文压缩</div>

              <div className="ai-chat-rag-toggle-row">
                <div className="ai-chat-rag-toggle-info">
                  <span className="ai-chat-rag-toggle-label">启用自动压缩</span>
                  <span className="ai-chat-rag-toggle-desc">
                    对话过长时自动压缩上下文，节省 token
                  </span>
                </div>
                <label className="ai-chat-switch">
                  <input
                    type="checkbox"
                    checked={localSettings.harnessCompactionEnabled}
                    onChange={(e) => updateSetting('harnessCompactionEnabled', e.target.checked)}
                  />
                  <span className="ai-chat-switch-slider" />
                </label>
              </div>
            </div>

            {/* 自驱动任务 */}
            <div className="ai-chat-rag-section">
              <div className="ai-chat-rag-section-title">🤖 自驱动任务</div>

              <div className="ai-chat-rag-toggle-row">
                <div className="ai-chat-rag-toggle-info">
                  <span className="ai-chat-rag-toggle-label">启用自驱动任务</span>
                  <span className="ai-chat-rag-toggle-desc">
                    打开 Obsidian 时自动检查并执行到期任务
                  </span>
                </div>
                <label className="ai-chat-switch">
                  <input
                    type="checkbox"
                    checked={localSettings.harnessSchedulerEnabled}
                    onChange={(e) => updateSetting('harnessSchedulerEnabled', e.target.checked)}
                  />
                  <span className="ai-chat-switch-slider" />
                </label>
              </div>

              {/* 任务列表 */}
              {scheduler && (
                <div className="ai-chat-task-list">
                  {taskList.length === 0 && (
                    <div className="ai-chat-task-empty">暂无任务（初始化中...）</div>
                  )}
                  {taskList.map(task => {
                    const scheduleLabel: Record<string, string> = {
                      daily: '每天', weekly: '每周', custom: '自定义', onOpen: '每次打开',
                    };
                    const typeLabel: Record<string, string> = {
                      weekly_report: '周报生成',
                      todo_check: '待办检查',
                      reflect_remind: '反思建议',
                      custom: task.name || '自定义任务',
                    };
                    const isRunning = runningTaskId === task.id;
                    return (
                      <div key={task.id} className={`ai-chat-task-item ${task.enabled ? 'enabled' : ''}`}>
                        <div className="ai-chat-task-info">
                          <div className="ai-chat-task-name">
                            {typeLabel[task.type] ?? task.id}
                            {task.isDue && task.enabled && (
                              <span className="ai-chat-task-due-badge">待执行</span>
                            )}
                          </div>
                          <div className="ai-chat-task-meta">
                            <span>{scheduleLabel[task.schedule] ?? task.schedule}</span>
                            {task.lastRun
                              ? <span>上次：{task.lastRun}</span>
                              : <span className="ai-chat-task-never">从未执行</span>
                            }
                          </div>
                        </div>
                        <div className="ai-chat-task-actions">
                          <button
                            className="ai-chat-task-run-btn"
                            disabled={isRunning}
                            title="立即执行"
                            onClick={async () => {
                              setRunningTaskId(task.id);
                              await scheduler.runTask(task.id);
                              refreshTasks();
                              setRunningTaskId(null);
                            }}
                          >
                            {isRunning ? '执行中…' : '▶ 执行'}
                          </button>
                          {task.type === 'custom' && (
                            <button
                              className="ai-chat-task-delete-btn"
                              title="删除任务"
                              onClick={async () => {
                                await scheduler.deleteTask(task.id);
                                refreshTasks();
                              }}
                            >
                              🗑
                            </button>
                          )}
                          <label className="ai-chat-switch ai-chat-task-switch">
                            <input
                              type="checkbox"
                              checked={task.enabled}
                              onChange={async (e) => {
                                await scheduler.toggleTask(task.id, e.target.checked);
                                refreshTasks();
                              }}
                            />
                            <span className="ai-chat-switch-slider" />
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  {/* 新建任务表单 */}
                  {showNewTask ? (
                    <div className="ai-chat-task-new-form">
                      <div className="ai-chat-settings-field">
                        <label>任务名称</label>
                        <input
                          type="text"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          placeholder="如：每天提醒喝水"
                          autoFocus
                        />
                      </div>
                      <div className="ai-chat-settings-field">
                        <label>执行频率</label>
                        <select
                          value={newTaskSchedule}
                          onChange={(e) => setNewTaskSchedule(e.target.value as 'daily' | 'weekly' | 'onOpen')}
                        >
                          <option value="onOpen">每次打开 Obsidian</option>
                          <option value="daily">每天（首次打开时）</option>
                          <option value="weekly">每周（首次打开时）</option>
                        </select>
                      </div>
                      <div className="ai-chat-settings-field">
                        <div className="ai-chat-settings-label-row">
                          <label style={{ marginBottom: 0 }}>任务内容（告诉 AI 做什么）</label>
                          <button
                            className="ai-chat-rag-copy-key-btn"
                            disabled={!newTaskName.trim() || enhancingPrompt}
                            onClick={async () => {
                              if (!newTaskName.trim()) return;
                              setEnhancingPrompt(true);
                              const enhanced = await onEnhanceTaskPrompt(
                                newTaskName.trim(),
                                newTaskPrompt.trim(),
                                newTaskSchedule,
                              );
                              setNewTaskPrompt(enhanced);
                              setEnhancingPrompt(false);
                            }}
                          >
                            {enhancingPrompt ? '优化中...' : '✨ AI 优化'}
                          </button>
                        </div>
                        <textarea
                          className="ai-chat-task-prompt-input"
                          value={newTaskPrompt}
                          onChange={(e) => setNewTaskPrompt(e.target.value)}
                          placeholder="简单描述任务目标，或点「✨ AI 优化」自动生成专业指令"
                          rows={3}
                        />
                      </div>
                      <div className="ai-chat-task-form-actions">
                        <button
                          className="ai-chat-settings-test-btn"
                          disabled={!newTaskName.trim() || !newTaskPrompt.trim() || newTaskSaving}
                          onClick={async () => {
                            if (!newTaskName.trim() || !newTaskPrompt.trim()) return;
                            setNewTaskSaving(true);
                            await scheduler.addTask({
                              name: newTaskName.trim(),
                              schedule: newTaskSchedule,
                              prompt: newTaskPrompt.trim(),
                            });
                            refreshTasks();
                            setNewTaskName('');
                            setNewTaskPrompt('');
                            setNewTaskSchedule('daily');
                            setShowNewTask(false);
                            setNewTaskSaving(false);
                          }}
                        >
                          {newTaskSaving ? '创建中...' : '✓ 创建任务'}
                        </button>
                        <button
                          className="ai-chat-task-cancel-btn"
                          onClick={() => {
                            setShowNewTask(false);
                            setNewTaskName('');
                            setNewTaskPrompt('');
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="ai-chat-task-add-btn"
                      onClick={() => setShowNewTask(true)}
                    >
                      ＋ 新建任务
                    </button>
                  )}

                  <small className="ai-chat-settings-hint" style={{ display: 'block', marginTop: 8 }}>
                    任务结果自动归档到 Vault。内置任务（周报/待办/反思）不可删除
                  </small>
                </div>
              )}
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
