/**
 * OpenAI 兼容的模型提供商实现
 * 一个类覆盖所有国内模型（DeepSeek、通义千问、豆包、Kimi、智谱）
 */

import { ChatMessage, ChatOptions, StreamChunk, ContentPart } from '@/types';
import { requestUrl } from 'obsidian';

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
          ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
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
   */
  async chatComplete(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string> {
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

    const data = response.json;
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('模型未返回有效响应');
    }

    return choice.message?.content || '';
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
      // Obsidian 的 requestUrl 不支持流式 SSE，需要使用浏览器原生 fetch API
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

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done' };
            return;
          }

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;

            // 处理 tool_calls
            if (delta.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolCall.id || '',
                    function: {
                      name: toolCall.function?.name || '',
                      arguments: toolCall.function?.arguments || '',
                    },
                  },
                };
              }
              continue;
            }

            // 处理文本内容
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
   * 测试连接是否有效
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chatComplete(
        [{ role: 'user', content: 'Hi' }],
        { temperature: 0 }
      );
      return response.length > 0;
    } catch {
      return false;
    }
  }


}
