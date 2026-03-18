/**
 * 聊天界面主组件
 * 整合消息列表、输入区域、场景选择、模型切换等功能
 * 
 * 场景化架构：全局 Rules → 场景 Rules → Skill System Prompt
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage, ContentPart, Skill, Scene, AIChatSettings, StreamChunk } from '@/types';
import { MessageBubble } from './MessageBubble';
import { InputArea, ImageAttachment } from './InputArea';
import { ModelSelector } from './ModelSelector';
import { ConversationManager } from '@/conversation/ConversationManager';
import { ProviderRegistry, OpenAICompatibleProvider } from '@/providers';
import { SceneManager } from '@/skills';
import { AutoArchiver } from '@/archive/AutoArchiver';
import { getSettings } from '@/settings';
import { getMessageText } from '@/utils/markdown';
import { App, Notice } from 'obsidian';

interface ChatProps {
  app: App;
  providerRegistry: ProviderRegistry;
  sceneManager: SceneManager;
  archiver: AutoArchiver;
  conversationManager: ConversationManager;
  onNewChat: () => void;
}

export const Chat: React.FC<ChatProps> = ({
  app,
  providerRegistry,
  sceneManager,
  archiver,
  conversationManager,
  onNewChat,
}) => {
  const settings = getSettings();

  // 状态
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [currentModel, setCurrentModel] = useState(settings.defaultTextModel);

  // refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // 同步对话管理器的消息
  const syncMessages = useCallback(() => {
    setMessages([...conversationManager.getMessages()]);
  }, [conversationManager]);

  /**
   * 发送消息的核心逻辑（支持文本 + 图片多模态）
   */
  const handleSend = useCallback(async (text: string, images?: ImageAttachment[]) => {
    if ((!text.trim() && (!images || images.length === 0)) || isLoading) return;

    abortRef.current = false;

    // 解析模型
    const resolved = providerRegistry.resolveModel(currentModel);
    if (!resolved) {
      new Notice('请先配置模型 API Key');
      return;
    }

    const { provider, model } = resolved;

    // 构建用户消息（支持多模态）
    let userMessage: ChatMessage;
    if (images && images.length > 0) {
      const contentParts: ContentPart[] = [];
      if (text.trim()) {
        contentParts.push({ type: 'text', text: text.trim() });
      }
      for (const img of images) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: img.dataUrl },
        });
      }
      userMessage = { role: 'user', content: contentParts };
    } else {
      userMessage = { role: 'user', content: text };
    }

    conversationManager.append(userMessage);
    syncMessages();

    setIsLoading(true);
    setStreamingContent('');

    try {
      // 尝试关键词匹配场景和 Skill
      let activeScene = selectedScene;
      let activeSkill = selectedSkill;

      if (!activeSkill) {
        // 优先在当前场景内匹配
        if (activeScene) {
          activeSkill = sceneManager.matchSkillByKeywords(text, activeScene.id);
        }
        // 再全局匹配
        if (!activeSkill) {
          activeSkill = sceneManager.matchSkillByKeywords(text);
          // 如果匹配到了 Skill 且没有选定场景，自动设置场景
          if (activeSkill && !activeScene) {
            activeScene = sceneManager.getSceneById(activeSkill.sceneId) || null;
            if (activeScene) {
              setSelectedScene(activeScene);
            }
          }
        }
      }

      // 如果没匹配到 Skill 也没选定场景，尝试匹配场景
      if (!activeScene && !activeSkill) {
        activeScene = sceneManager.matchSceneByKeywords(text);
        if (activeScene) {
          setSelectedScene(activeScene);
        }
      }

      // 使用 SceneManager 构建完整的 System Prompt
      const systemPrompt = sceneManager.buildSystemPrompt(
        activeScene?.id,
        activeSkill || undefined,
      );

      // 构建消息列表
      const contextMessages = conversationManager.getContextMessages();
      const messagesToSend: ChatMessage[] = [];

      if (systemPrompt) {
        messagesToSend.push({ role: 'system', content: systemPrompt });
      }

      // 添加非 system 消息
      messagesToSend.push(...contextMessages.filter(m => m.role !== 'system'));

      // 流式输出
      if (settings.streamOutput) {
        let fullContent = '';

        const stream = provider.chatStream(messagesToSend, {
          model,
          temperature: settings.temperature,
        });

        for await (const chunk of stream) {
          if (abortRef.current) break;

          if (chunk.type === 'text' && chunk.content) {
            fullContent += chunk.content;
            setStreamingContent(fullContent);
          } else if (chunk.type === 'error') {
            new Notice(`AI 响应错误: ${chunk.error}`);
            break;
          } else if (chunk.type === 'done') {
            break;
          }
        }

        if (fullContent) {
          conversationManager.append({ role: 'assistant', content: fullContent });

          // 自动归档
          if (settings.autoArchive && activeSkill) {
            try {
              const result = await archiver.archive({
                content: fullContent,
                skill: activeSkill,
              });
              new Notice(`✅ 已归档到 ${result.filePath}`);
            } catch (error) {
              console.error('[Lingxi] 归档失败:', error);
            }
          }
        }
      } else {
        // 非流式
        const content = await provider.chatComplete(messagesToSend, {
          model,
          temperature: settings.temperature,
        });

        if (content) {
          conversationManager.append({ role: 'assistant', content });

          if (settings.autoArchive && activeSkill) {
            try {
              const result = await archiver.archive({
                content,
                skill: activeSkill,
              });
              new Notice(`✅ 已归档到 ${result.filePath}`);
            } catch (error) {
              console.error('[Lingxi] 归档失败:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Lingxi] 发送消息失败:', error);
      new Notice(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      syncMessages();
    }
  }, [
    isLoading, currentModel, providerRegistry, conversationManager,
    selectedScene, selectedSkill, sceneManager, settings, archiver, syncMessages,
  ]);

  /**
   * 保存为笔记
   */
  const handleSaveAsNote = useCallback(async (content: string) => {
    try {
      const result = await archiver.archive({ content });
      new Notice(`✅ 已保存到 ${result.filePath}`);
    } catch (error) {
      new Notice(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [archiver]);

  /**
   * 复制消息
   */
  const handleCopy = useCallback((content: string) => {
    new Notice('已复制到剪贴板');
  }, []);

  /**
   * 场景选择（来自快捷入口按钮）
   */
  const handleSceneSelect = useCallback((scene: Scene) => {
    setSelectedScene(scene);
    setSelectedSkill(null); // 切换场景时清除已选 Skill
  }, []);

  /**
   * 新建对话
   */
  const handleNewChat = useCallback(() => {
    conversationManager.newConversation();
    setMessages([]);
    setSelectedSkill(null);
    setSelectedScene(null);
    setStreamingContent('');
    onNewChat();
  }, [conversationManager, onNewChat]);

  /**
   * 模型切换
   */
  const handleModelChange = useCallback((modelString: string) => {
    setCurrentModel(modelString);
  }, []);

  return (
    <div className="ai-chat-container">
      {/* 顶部栏 */}
      <div className="ai-chat-header">
        <ModelSelector
          providers={settings.providers}
          currentModel={currentModel}
          onModelChange={handleModelChange}
        />
        <button
          className="ai-chat-new-chat-btn"
          onClick={handleNewChat}
          title="新建对话"
        >
          ✨ 新对话
        </button>
      </div>

      {/* 场景/Skill 状态栏 */}
      {(selectedScene || selectedSkill) && (
        <div className="ai-chat-context-bar">
          {selectedScene && (
            <span className="ai-chat-scene-tag" title={selectedScene.description}>
              {selectedScene.icon} {selectedScene.name}
              <button
                className="ai-chat-tag-clear"
                onClick={() => {
                  setSelectedScene(null);
                  setSelectedSkill(null);
                }}
              >×</button>
            </span>
          )}
          {selectedSkill && (
            <span className="ai-chat-skill-tag" title={selectedSkill.description}>
              🔧 {selectedSkill.name}
              <button
                className="ai-chat-tag-clear"
                onClick={() => setSelectedSkill(null)}
              >×</button>
            </span>
          )}
        </div>
      )}

      {/* 消息区域 */}
      <div className="ai-chat-messages">
        {messages.length === 0 && !isLoading && (
          <div className="ai-chat-welcome">
            <div className="ai-chat-welcome-icon">💬</div>
            <div className="ai-chat-welcome-title">灵犀</div>
            <div className="ai-chat-welcome-desc">
              输入消息开始对话，Skill 会根据内容自动匹配
            </div>
            {/* 场景快捷入口 */}
            <div className="ai-chat-scene-shortcuts">
              {sceneManager.getAllScenes().map(scene => (
                <button
                  key={scene.id}
                  className="ai-chat-scene-shortcut-btn"
                  onClick={() => handleSceneSelect(scene)}
                >
                  {scene.icon} {scene.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.filter(m => m.role !== 'system').map((msg, index) => (
          <MessageBubble
            key={index}
            message={msg}
            onSaveAsNote={handleSaveAsNote}
            onCopy={handleCopy}
          />
        ))}

        {/* 流式输出中的消息 */}
        {isLoading && streamingContent && (
          <MessageBubble
            message={{ role: 'assistant', content: streamingContent }}
            isStreaming={true}
          />
        )}

        {/* 加载动画 */}
        {isLoading && !streamingContent && (
          <div className="ai-chat-message ai-chat-message-ai">
            <div className="ai-chat-message-avatar">🤖</div>
            <div className="ai-chat-message-content">
              <div className="ai-chat-loading">
                <span className="ai-chat-dot">●</span>
                <span className="ai-chat-dot">●</span>
                <span className="ai-chat-dot">●</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <InputArea
        onSend={handleSend}
        selectedSkill={selectedSkill}
        onClearSkill={() => setSelectedSkill(null)}
        isLoading={isLoading}
        sendShortcut={settings.sendShortcut}
      />
    </div>
  );
};
