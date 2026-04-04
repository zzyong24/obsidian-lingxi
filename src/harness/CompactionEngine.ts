/**
 * CompactionEngine — 上下文压缩引擎
 * 职责：支持超长对话不丢失上下文，在 128K 窗口内高效利用 token
 *
 * 三层压缩（对齐 Claude Code 架构）：
 * 1. Micro: 每轮对话前，3 轮前的 tool results 替换为 [已执行: xxx]
 * 2. Auto:  token > 85% of 128K 时，LLM 生成摘要替换
 * 3. Manual: 用户输入 /compact 手动触发
 */

import { App, Notice } from 'obsidian';
import { ChatMessage, AIChatSettings } from '@/types';
import { ProviderRegistry } from '@/providers';

/** 压缩存档目录 */
const TRANSCRIPTS_DIR = 'lingxi-harness/transcripts';

/** 粗估 token 数（中文约 2 token/字，英文约 0.75 token/word） */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // 中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  // 非中文部分按空格分词
  const nonChinese = text.replace(/[\u4e00-\u9fff]/g, '');
  const words = nonChinese.split(/\s+/).filter(Boolean).length;
  return chineseChars * 2 + Math.ceil(words * 0.75) + 10; // +10 作为 buffer
}

/** 估算消息数组的总 token 数 */
function estimateMessagesTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    const content = typeof msg.content === 'string'
      ? msg.content
      : msg.content.map(p => p.text || '').join('');
    total += estimateTokens(content);
    // tool_calls 也占 token
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.function.name + tc.function.arguments);
      }
    }
    total += 4; // 每条消息的 overhead
  }
  return total;
}

/** 压缩摘要的 Prompt */
const COMPACTION_PROMPT = `你是一个对话摘要助手。请将以下对话历史压缩成一份精简摘要，保留：
1. 用户提出的核心问题和需求
2. AI 给出的关键结论和建议
3. 做出的重要决策
4. 未完成的待办事项

摘要格式：
- 用简洁的要点形式
- 保留关键数据和结论
- 不需要保留寒暄和过渡语

对话历史：
`;

export class CompactionEngine {
  private app: App;
  private settings: AIChatSettings;
  private providerRegistry: ProviderRegistry;

  /** 默认 token 窗口大小（128K） */
  private readonly MAX_TOKENS = 128000;

  constructor(app: App, settings: AIChatSettings, providerRegistry: ProviderRegistry) {
    this.app = app;
    this.settings = settings;
    this.providerRegistry = providerRegistry;
  }

  /**
   * 更新设置引用
   */
  updateSettings(settings: AIChatSettings): void {
    this.settings = settings;
  }

  // ==================== 三层压缩 ====================

  /**
   * Micro 压缩：每轮对话前调用
   * 将 3 轮前的 tool results 替换为 [已执行: xxx]，减少 token 占用
   */
  microCompact(messages: ChatMessage[]): ChatMessage[] {
    if (!this.settings.harnessCompactionEnabled) return messages;

    // 找到倒数第 3 个 user 消息的位置
    let userCount = 0;
    let cutoffIndex = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userCount++;
        if (userCount >= 3) {
          cutoffIndex = i;
          break;
        }
      }
    }

    if (cutoffIndex === 0) return messages; // 不足 3 轮，不压缩

    return messages.map((msg, idx) => {
      if (idx >= cutoffIndex) return msg; // 最近 3 轮保留原样

      // 压缩 tool 结果消息
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 100) {
        return {
          ...msg,
          content: `[已执行，结果已省略]`,
        };
      }

      // 压缩带 tool_calls 的 assistant 消息中的 arguments
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        return {
          ...msg,
          tool_calls: msg.tool_calls.map(tc => ({
            ...tc,
            function: {
              ...tc.function,
              arguments: tc.function.arguments.length > 50
                ? `{"_compressed": true}`
                : tc.function.arguments,
            },
          })),
        };
      }

      return msg;
    });
  }

  /**
   * Auto 压缩：token 超过阈值时自动触发
   * @param modelOverride 可选，覆盖 defaultTextModel
   * @returns 压缩后的消息列表，如果未触发压缩则返回 null
   */
  async autoCompact(
    messages: ChatMessage[],
    conversationId?: string,
    modelOverride?: string,
  ): Promise<ChatMessage[] | null> {
    if (!this.settings.harnessCompactionEnabled) return null;

    const totalTokens = estimateMessagesTokens(messages);
    const threshold = this.MAX_TOKENS * this.settings.harnessCompactionThreshold;

    if (totalTokens < threshold) return null;

    console.debug(`[Lingxi Harness] Auto Compaction 触发: ${totalTokens} tokens > ${threshold} threshold`);
    return this.compact(messages, conversationId, modelOverride);
  }

  /**
   * Manual 压缩：用户输入 /compact 时手动触发
   */
  async manualCompact(
    messages: ChatMessage[],
    conversationId?: string,
    modelOverride?: string,
  ): Promise<ChatMessage[]> {
    return this.compact(messages, conversationId, modelOverride);
  }

  /**
   * 检查是否需要 auto compaction
   */
  shouldAutoCompact(messages: ChatMessage[]): boolean {
    if (!this.settings.harnessCompactionEnabled) return false;
    const totalTokens = estimateMessagesTokens(messages);
    const threshold = this.MAX_TOKENS * this.settings.harnessCompactionThreshold;
    return totalTokens >= threshold;
  }

  // ==================== 内部方法 ====================

  /**
   * 执行压缩
   */
  private async compact(
    messages: ChatMessage[],
    conversationId?: string,
    modelOverride?: string,
  ): Promise<ChatMessage[]> {
    try {
      // 1. 存档完整对话（压缩前保留）
      if (conversationId) {
        await this.saveTranscript(conversationId, messages);
      }

      // 2. 分离：system 消息 + 最近 3 轮 + 需要压缩的部分
      const systemMessages = messages.filter(m => m.role === 'system');
      const nonSystemMessages = messages.filter(m => m.role !== 'system');

      // 保留最近 3 轮（约 6 条消息：3 user + 3 assistant）
      let keepCount = 0;
      let userCount = 0;
      for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
        if (nonSystemMessages[i].role === 'user') {
          userCount++;
          if (userCount >= 3) {
            keepCount = nonSystemMessages.length - i;
            break;
          }
        }
      }
      keepCount = Math.max(keepCount, 4); // 至少保留 4 条

      const toCompress = nonSystemMessages.slice(0, nonSystemMessages.length - keepCount);
      const toKeep = nonSystemMessages.slice(nonSystemMessages.length - keepCount);

      if (toCompress.length === 0) {
        new Notice('对话太短，无需压缩');
        return messages;
      }

      // 3. 调用 LLM 生成摘要
      const summary = await this.generateSummary(toCompress, modelOverride);
      if (!summary) {
        new Notice('压缩失败，请稍后重试');
        return messages;
      }

      // 4. 构建压缩后的消息列表
      const compactedMessages: ChatMessage[] = [
        ...systemMessages,
        {
          role: 'system',
          content: `## 对话历史摘要（已压缩 ${toCompress.length} 条消息）\n${summary}`,
        },
        ...toKeep,
      ];

      const oldTokens = estimateMessagesTokens(messages);
      const newTokens = estimateMessagesTokens(compactedMessages);
      new Notice(`🗜️ 上下文已压缩: ${oldTokens} → ${newTokens} tokens (节省 ${Math.round((1 - newTokens / oldTokens) * 100)}%)`);

      return compactedMessages;
    } catch (error) {
      console.error('[Lingxi Harness] 压缩失败:', error);
      new Notice('压缩失败: ' + (error instanceof Error ? error.message : '未知错误'));
      return messages;
    }
  }

  /**
   * 调用 LLM 生成对话摘要
   */
  private async generateSummary(messages: ChatMessage[], modelOverride?: string): Promise<string | null> {
    const modelStr = modelOverride || this.settings.defaultTextModel;
    const resolved = this.providerRegistry.resolveModel(modelStr);
    if (!resolved) return null;

    const { provider, model } = resolved;

    const conversationText = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => {
        const content = typeof m.content === 'string'
          ? m.content
          : m.content.map(p => p.text || '').join('');
        // 截断过长的单条消息
        const truncated = content.length > 500 ? content.slice(0, 500) + '...' : content;
        return `${m.role === 'user' ? '用户' : 'AI'}: ${truncated}`;
      })
      .join('\n');

    const summaryMessages: ChatMessage[] = [
      { role: 'system', content: '你是一个高效的摘要助手。请用简洁的中文要点形式输出。' },
      { role: 'user', content: COMPACTION_PROMPT + conversationText },
    ];

    try {
      const result = await provider.chatComplete(summaryMessages, {
        model,
        temperature: 0.1,
      });
      return result.content;
    } catch (error) {
      console.error('[Lingxi Harness] 生成摘要失败:', error);
      return null;
    }
  }

  /**
   * 保存完整对话存档到 transcripts/
   */
  private async saveTranscript(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      await this.ensureDir(TRANSCRIPTS_DIR);

      const filePath = `${TRANSCRIPTS_DIR}/${conversationId}.json`;
      const data = {
        conversationId,
        compactedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : '[multimodal content]',
        })),
      };

      await this.app.vault.adapter.write(filePath, JSON.stringify(data, null, 2));
      console.debug(`[Lingxi Harness] 对话存档已保存: ${filePath}`);
    } catch (error) {
      console.error('[Lingxi Harness] 保存对话存档失败:', error);
    }
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(path: string): Promise<void> {
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) {
      await this.app.vault.adapter.mkdir(path);
    }
  }
}
