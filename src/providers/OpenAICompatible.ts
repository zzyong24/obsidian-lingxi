/**
 * OpenAI 兼容的模型提供商实现
 * 一个类覆盖所有国内模型（DeepSeek、通义千问、豆包、Kimi、智谱）
 */

import { ChatMessage, ChatOptions, StreamChunk, ToolCall } from '@/types';
import { requestUrl } from 'obsidian';

/** chatComplete 的返回结果 */
export interface ChatCompleteResult {
  content: string;
  toolCalls?: ToolCall[];
}

export class OpenAICompatibleProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private defaultModel: string,
  ) {}

  /**
   * 将 ChatMessage 转换为 OpenAI API 格式
   */
  private formatMessages(messages: ChatMessage[]): Record<string, unknown>[] {
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content,
          ...(msg.tool_calls ? { tool_calls: msg.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: tc.function,
          })) } : {}),
          ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
        };
      }
      // 多模态消息（文本 + 图片）
      const parts = msg.content.map(part => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        }
        return { type: 'image_url', image_url: { url: part.image_url?.url } };
      });
      return { role: msg.role, content: parts };
    });
  }

  /**
   * 非流式聊天请求
   * 返回结构化结果，包含文本内容和可能的 tool_calls
   */
  async chatComplete(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatCompleteResult> {
    const model = options?.model || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages),
      temperature: options?.temperature ?? 0.7,
      stream: false,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const response = await requestUrl({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = response.json as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('模型未返回有效响应');
    }

    const message = choice.message;
    const content: string = message?.content || '';

    // 解析 tool_calls
    let toolCalls: ToolCall[] | undefined;
    if (message?.tool_calls && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    return { content, toolCalls };
  }

  /**
   * 流式聊天请求，返回异步生成器
   */
  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    const model = options?.model || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages),
      temperature: options?.temperature ?? 0.7,
      stream: true,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    try {
      const response = await globalThis.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: 'error', error: `API 请求失败 (${response.status}): ${errorText}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: '无法获取响应流' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const sseData = trimmed.slice(6);
          if (sseData === '[DONE]') {
            yield { type: 'done' };
            return;
          }

          try {
            const json = JSON.parse(sseData) as {
              choices?: Array<{
                delta?: {
                  content?: string;
                  tool_calls?: Array<{
                    id?: string;
                    index?: number;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
              }>;
            };
            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.tool_calls) {
              for (const toolCall of delta.tool_calls) {
              yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolCall.id || '',
                    type: 'function' as const,
                    function: {
                      name: toolCall.function?.name || '',
                      arguments: toolCall.function?.arguments || '',
                    },
                  },
                  toolCallIndex: typeof toolCall.index === 'number' ? toolCall.index : undefined,
                };
              }
              continue;
            }

            if (delta.content) {
              yield { type: 'text', content: delta.content };
            }
          } catch {
            // 跳过无法解析的行
          }
        }
      }

      yield { type: 'done' };
    } catch (error) {
      yield {
        type: 'error',
        error: `请求失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 测试连接是否有效，返回成功状态和可能的错误信息
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.baseUrl}/chat/completions`;
      const body = {
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0,
        stream: false,
        max_tokens: 1,
      };
      const response = await globalThis.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          const message = errorJson.error?.message || errorJson.message || errorText;
          return { success: false, error: `${response.status}: ${message}` };
        } catch {
          return { success: false, error: `${response.status}: ${errorText}` };
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
