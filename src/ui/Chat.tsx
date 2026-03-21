/**
 * 聊天界面主组件
 * 整合消息列表、输入区域、场景选择、模型切换等功能
 * 支持 Function Calling Tool Call 循环处理
 * 
 * 场景化架构：全局 Rules → 场景 Rules → Skill System Prompt
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage, ContentPart, Skill, Scene, NoteReference, ToolCall } from '@/types';
import { MessageBubble } from './MessageBubble';
import { InputArea, ImageAttachment } from './InputArea';
import { TFile } from 'obsidian';
import { ModelSelector } from './ModelSelector';
import { ConversationManager } from '@/conversation/ConversationManager';
import { ProviderRegistry } from '@/providers';
import { SceneManager } from '@/skills';
import { AutoArchiver } from '@/archive/AutoArchiver';
import { RAGManager } from '@/search/RAGManager';
import { ToolCallHandler } from '@/skills/ToolCallHandler';
import { getSettings } from '@/settings';
import { App, Notice } from 'obsidian';

/** Tool Call 流式累积器：用于从流式 SSE 中组装完整的 tool_call */
interface ToolCallAccumulator {
  [index: number]: {
    id: string;
    name: string;
    arguments: string;
  };
}

interface ChatProps {
  app: App;
  providerRegistry: ProviderRegistry;
  sceneManager: SceneManager;
  archiver: AutoArchiver;
  ragManager: RAGManager;
  conversationManager: ConversationManager;
  toolCallHandler: ToolCallHandler;
  onNewChat: () => void;
}

export const Chat: React.FC<ChatProps> = ({
  app,
  providerRegistry,
  sceneManager,
  archiver,
  ragManager,
  conversationManager,
  toolCallHandler,
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
  /** 跟踪当前对话是否处于 Tool Call 流程中（跨轮次保持） */
  const toolCallActiveRef = useRef(false);

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
   * 停止生成
   */
  const handleAbort = useCallback(() => {
    abortRef.current = true;
  }, []);

  /**
   * 发送消息的核心逻辑（支持文本 + 图片多模态 + Tool Call 循环）
   */
  const handleSend = useCallback((text: string, images?: ImageAttachment[], noteRefs?: NoteReference[]) => {
    if ((!text.trim() && (!images || images.length === 0) && (!noteRefs || noteRefs.length === 0)) || isLoading) return;

    void (async () => {
    abortRef.current = false;

    // 解析模型
    const resolved = providerRegistry.resolveModel(currentModel);
    if (!resolved) {
      new Notice('请先配置模型 API key');
      return;
    }

    const { provider, model } = resolved;

    // 读取引用笔记的内容
    let noteContext = '';
    if (noteRefs && noteRefs.length > 0) {
      const noteParts: string[] = [];
      for (const ref of noteRefs) {
        try {
          const file = app.vault.getAbstractFileByPath(ref.path);
          if (file instanceof TFile) {
            const content = await app.vault.read(file);
            // 去除 frontmatter
            const cleanContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
            noteParts.push(`【引用笔记: ${ref.name}】\n${cleanContent}`);
          }
        } catch (err) {
          console.error(`[Lingxi] 读取引用笔记失败: ${ref.path}`, err);
        }
      }
      if (noteParts.length > 0) {
        noteContext = noteParts.join('\n\n---\n\n');
      }
    }

    // 构建发送给 API 的完整文本（包含笔记全文）
    const apiText = noteContext
      ? `${text}\n\n---\n以下是我引用的笔记内容，请参考：\n\n${noteContext}`
      : text;

    // 构建 UI 显示用的文本（仅包含笔记引用标记，不含全文）
    const displayText = (noteRefs && noteRefs.length > 0)
      ? `${text}\n\n> 📄 引用了 ${noteRefs.length} 篇笔记：${noteRefs.map(r => `「${r.name}」`).join('、')}`
      : text;

    // UI 显示的用户消息
    let displayMessage: ChatMessage;
    if (images && images.length > 0) {
      const displayParts: ContentPart[] = [];
      if (displayText.trim()) {
        displayParts.push({ type: 'text', text: displayText.trim() });
      }
      for (const img of images) {
        displayParts.push({
          type: 'image_url',
          image_url: { url: img.dataUrl },
        });
      }
      displayMessage = { role: 'user', content: displayParts };
    } else {
      displayMessage = { role: 'user', content: displayText };
    }

    // 发送给 API 的用户消息（包含笔记全文）
    let apiMessage: ChatMessage;
    if (images && images.length > 0) {
      const apiParts: ContentPart[] = [];
      if (apiText.trim()) {
        apiParts.push({ type: 'text', text: apiText.trim() });
      }
      for (const img of images) {
        apiParts.push({
          type: 'image_url',
          image_url: { url: img.dataUrl },
        });
      }
      apiMessage = { role: 'user', content: apiParts };
    } else {
      apiMessage = { role: 'user', content: apiText };
    }

    // 存入对话管理器的是 UI 显示版本（不包含笔记全文）
    conversationManager.append(displayMessage);
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
          // 如果匹配到了 Skill，自动切换到 Skill 所属的场景
          if (activeSkill) {
            const skillScene = sceneManager.getSceneById(activeSkill.sceneId) || null;
            if (skillScene && skillScene.id !== activeScene?.id) {
              activeScene = skillScene;
              setSelectedScene(activeScene);
            } else if (!activeScene && skillScene) {
              activeScene = skillScene;
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

      // RAG 检索：根据用户输入检索相关知识片段
      let ragContext = '';
      try {
        ragContext = await ragManager.retrieve(text);
      } catch (error) {
        console.error('[Lingxi] RAG 检索失败:', error);
      }

      // 构建消息列表
      const contextMessages = conversationManager.getContextMessages();
      const messagesToSend: ChatMessage[] = [];

      if (systemPrompt) {
        // 将 RAG 检索结果拼入 System Prompt
        const fullSystemPrompt = ragContext
          ? `${systemPrompt}\n\n---\n\n${ragContext}`
          : systemPrompt;
        messagesToSend.push({ role: 'system', content: fullSystemPrompt });
      } else if (ragContext) {
        // 无 System Prompt 但有 RAG 结果
        messagesToSend.push({ role: 'system', content: ragContext });
      }

      // 添加非 system 消息，但最后一条用户消息替换为包含笔记全文的 API 版本
      const nonSystemMessages = contextMessages.filter(m => m.role !== 'system');
      if (noteContext && nonSystemMessages.length > 0) {
        // 将最后一条用户消息替换为 API 版本
        const lastIdx = nonSystemMessages.length - 1;
        messagesToSend.push(...nonSystemMessages.slice(0, lastIdx));
        messagesToSend.push(apiMessage);
      } else {
        messagesToSend.push(...nonSystemMessages);
      }

      // 判断是否需要启用 Tool Call
      // 优先检查当前输入是否包含工具关键词
      // 如果不包含，再检查对话是否已在工具调用流程中（如用户回复"确认"时）
      const enableTools = toolCallHandler.shouldEnableTools(text)
        || toolCallActiveRef.current;

      // Tool Call 循环处理
      let currentMessages = [...messagesToSend];
      const maxToolCallRounds = 5; // 最多循环 5 轮工具调用

      for (let round = 0; round <= maxToolCallRounds; round++) {
        if (abortRef.current) break;

        // 流式输出
        let fullContent = '';
        const accumulatedToolCalls: ToolCallAccumulator = {};
        let hasToolCalls = false;

        // 每一轮都注入工具定义（支持AI连续调用多个工具，如：创建场景 → 创建Skill1 → 创建Skill2）
        // 仅在最后一轮（round == maxToolCallRounds）不注入，强制AI输出文本回复
        const shouldInjectTools = enableTools && round < maxToolCallRounds;
        const chatOptions = {
          model,
          temperature: settings.temperature,
          ...(shouldInjectTools ? { tools: toolCallHandler.getToolDefinitions() } : {}),
        };

        if (settings.streamOutput) {
          const stream = provider.chatStream(currentMessages, chatOptions);

          for await (const chunk of stream) {
            if (abortRef.current) break;

            if (chunk.type === 'text' && chunk.content) {
              fullContent += chunk.content;
              setStreamingContent(fullContent);
            } else if (chunk.type === 'tool_call' && chunk.toolCall) {
              // 累积流式 tool_call 片段
              hasToolCalls = true;
              const tc = chunk.toolCall;
              // 使用 toolCallIndex 确定是哪个 tool_call（流式中可能并行有多个）
              const idx = chunk.toolCallIndex ?? Object.keys(accumulatedToolCalls).length;
              if (tc.id && !accumulatedToolCalls[idx]) {
                // 首次出现（带 id），初始化新的 tool_call
                accumulatedToolCalls[idx] = {
                  id: tc.id,
                  name: tc.function.name || '',
                  arguments: tc.function.arguments || '',
                };
              } else if (accumulatedToolCalls[idx]) {
                // 后续 chunk，追加 arguments
                if (tc.function.name) {
                  accumulatedToolCalls[idx].name += tc.function.name;
                }
                accumulatedToolCalls[idx].arguments += tc.function.arguments || '';
              }
            } else if (chunk.type === 'error') {
              new Notice(`AI 响应错误: ${chunk.error}`);
              break;
            } else if (chunk.type === 'done') {
              break;
            }
          }
        } else {
          // 非流式：chatComplete 现在返回结构化结果
          const result = await provider.chatComplete(currentMessages, chatOptions);
          fullContent = result.content;
          if (result.toolCalls && result.toolCalls.length > 0) {
            hasToolCalls = true;
            for (let i = 0; i < result.toolCalls.length; i++) {
              const tc: ToolCall = result.toolCalls[i];
              accumulatedToolCalls[i] = {
                id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
              };
            }
          }
        }

        // 如果有工具调用，执行工具并继续循环
        if (hasToolCalls && Object.keys(accumulatedToolCalls).length > 0) {
          const toolCalls: ToolCall[] = Object.values(accumulatedToolCalls).map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          }));

          // 将 assistant 的 tool_call 消息加入上下文
          const assistantToolMsg: ChatMessage = {
            role: 'assistant',
            content: fullContent || '',
            tool_calls: toolCalls,
          };
          currentMessages.push(assistantToolMsg);
          // 同时存入对话管理器，保持上下文连贯性
          conversationManager.append(assistantToolMsg);

          // 执行每个工具调用
          for (const tc of toolCalls) {
            if (abortRef.current) break;

            setStreamingContent(`🔧 正在执行: ${tc.function.name}...`);
            const toolResult = await toolCallHandler.executeToolCall(tc);

            // 将工具结果加入上下文
            const toolResultMsg: ChatMessage = {
              role: 'tool',
              content: toolResult.result,
              tool_call_id: toolResult.toolCallId,
            };
            currentMessages.push(toolResultMsg);
            // 同时存入对话管理器
            conversationManager.append(toolResultMsg);
          }

          // 标记工具调用流程活跃
          toolCallActiveRef.current = true;

          // 继续循环，让 AI 处理工具结果（可能还需要继续调用工具）
          setStreamingContent('');
          continue;
        }

        // 没有工具调用，这是最终文本回复
        if (fullContent) {
          conversationManager.append({ role: 'assistant', content: fullContent });

          // 工具调用流程结束后：重置标志 & 自动切换场景/Skill
          if (toolCallActiveRef.current) {
            // 工具调用可能创建了新场景或Skill，刷新SceneManager后尝试切换
            await sceneManager.fullScan();
            // 从AI最终回复中推断应该切换到哪个场景
            const newSkill = sceneManager.matchSkillByKeywords(text);
            if (newSkill) {
              const newScene = sceneManager.getSceneById(newSkill.sceneId);
              if (newScene) {
                setSelectedScene(newScene);
                setSelectedSkill(newSkill);
              }
            } else {
              // 没匹配到Skill则尝试匹配场景
              const newScene = sceneManager.matchSceneByKeywords(text);
              if (newScene) {
                setSelectedScene(newScene);
              }
            }
          }
          toolCallActiveRef.current = false;

          // 归档策略优化：只在匹配到 Skill 或回复超过一定长度时才归档
          if (settings.autoArchive && (activeSkill || fullContent.length > 200)) {
            try {
              const result = await archiver.archive({
                content: fullContent,
                skill: activeSkill || undefined,
              });
              new Notice(`✅ 已归档到 ${result.filePath}`);
            } catch (error) {
              console.error('[Lingxi] 归档失败:', error);
            }
          }
        }

        // 正常退出循环
        break;
      }
    } catch (error) {
      console.error('[Lingxi] 发送消息失败:', error);
      new Notice(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      syncMessages();
    }
    })();
  }, [
    app, isLoading, currentModel, providerRegistry, conversationManager,
    selectedScene, selectedSkill, sceneManager, settings, archiver, ragManager,
    toolCallHandler, syncMessages,
  ]);

  /**
   * 保存为笔记
   */
  const handleSaveAsNote = useCallback((content: string) => {
    void (async () => {
      try {
        const result = await archiver.archive({ content });
        new Notice(`✅ 已保存到 ${result.filePath}`);
      } catch (error) {
        new Notice(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    })();
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
    toolCallActiveRef.current = false;
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

        {messages.filter(m => {
          // 隐藏 system 消息
          if (m.role === 'system') return false;
          // 隐藏 tool 结果消息
          if (m.role === 'tool') return false;
          // 隐藏带 tool_calls 的 assistant 中间消息（这是工具调用指令，非面向用户的内容）
          if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) return false;
          return true;
        }).map((msg, index) => (
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

        {/* 加载动画 + 停止按钮 */}
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

        {/* 停止生成按钮 */}
        {isLoading && (
          <div className="ai-chat-stop-container">
            <button
              className="ai-chat-stop-btn"
              onClick={handleAbort}
              title="停止生成"
            >
              ⏹ 停止生成
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <InputArea
        app={app}
        onSend={handleSend}
        selectedSkill={selectedSkill}
        onClearSkill={() => setSelectedSkill(null)}
        isLoading={isLoading}
        sendShortcut={settings.sendShortcut}
      />
    </div>
  );
};
