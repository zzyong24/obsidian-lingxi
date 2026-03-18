/**
 * 模型选择器组件
 * 聊天顶部的模型切换下拉
 */

import React, { useState, useCallback } from 'react';
import { ProviderConfig } from '@/types';

interface ModelSelectorProps {
  providers: ProviderConfig[];
  currentModel: string;
  onModelChange: (modelString: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  providers,
  currentModel,
  onModelChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // 获取当前模型的显示名称
  const getDisplayName = useCallback((modelString: string) => {
    const [providerId, modelName] = modelString.split(':');
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      return `${provider.name} / ${modelName || provider.defaultModel}`;
    }
    return modelString || '未设置模型';
  }, [providers]);

  // 获取可用的模型列表
  const availableModels = providers
    .filter(p => p.apiKey)
    .map(p => ({
      id: `${p.id}:${p.defaultModel}`,
      displayName: `${p.name} / ${p.defaultModel}`,
    }));

  return (
    <div className="ai-chat-model-selector">
      <button
        className="ai-chat-model-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="切换模型"
      >
        🤖 {getDisplayName(currentModel)}
        <span className="ai-chat-dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="ai-chat-model-dropdown">
          {availableModels.length === 0 ? (
            <div className="ai-chat-model-empty">
              请先在设置中配置 API Key
            </div>
          ) : (
            availableModels.map(model => (
              <div
                key={model.id}
                className={`ai-chat-model-option ${model.id === currentModel ? 'ai-chat-model-option-active' : ''}`}
                onClick={() => {
                  onModelChange(model.id);
                  setIsOpen(false);
                }}
              >
                {model.displayName}
                {model.id === currentModel && <span className="ai-chat-check">✓</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
