/**
 * Embedding 服务
 * 调用 OpenAI 兼容的 /embeddings 接口将文本转换为向量
 * 复用已有的模型提供商配置（Base URL + API Key）
 */

import { ProviderConfig } from '@/types';
import { requestUrl } from 'obsidian';

/** 单条 Embedding 结果 */
export interface EmbeddingResult {
  embedding: number[];
  index: number;
}

export class EmbeddingService {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(provider: ProviderConfig, model: string) {
    this.baseUrl = provider.baseUrl.replace(/\/+$/, '');
    this.apiKey = provider.apiKey;
    this.model = model;
  }

  /**
   * 获取单段文本的 Embedding 向量
   */
  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  /**
   * 批量获取 Embedding 向量
   * 内部自动分批（每批 BATCH_SIZE 条），防止请求体过大（413）
   * @param texts 文本数组
   * @returns 向量数组（与输入顺序一致）
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // 过滤空文本，同时截断过长的单条内容（防止单条超限）
    const MAX_TEXT_LEN = 500;
    const validTexts = texts
      .map(t => t.trim().slice(0, MAX_TEXT_LEN))
      .filter(t => t.length > 0);
    if (validTexts.length === 0) return [];

    // 分批发送，每批最多 8 条（保守值，兼容各服务商限制）
    const BATCH_SIZE = 8;
    const allResults: number[][] = new Array(validTexts.length);

    for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
      const batch = validTexts.slice(i, i + BATCH_SIZE);
      const batchResults = await this.sendBatch(batch);
      for (let j = 0; j < batchResults.length; j++) {
        allResults[i + j] = batchResults[j];
      }
    }

    return allResults;
  }

  /**
   * 发送单批请求（含重试，最多 2 次，间隔 1s）
   */
  private async sendBatch(texts: string[]): Promise<number[][]> {
    const MAX_RETRIES = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await requestUrl({
          url: `${this.baseUrl}/embeddings`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: texts,
          }),
        });

        const data = response.json;
        if (!data.data || !Array.isArray(data.data)) {
          throw new Error('Embedding API 返回格式异常');
        }

        const sorted = data.data.sort((a: EmbeddingResult, b: EmbeddingResult) => a.index - b.index);
        return sorted.map((item: EmbeddingResult) => item.embedding);
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        // 网络错误才重试，业务错误（401/413）不重试
        const isNetworkError = msg.includes('ERR_NETWORK') || msg.includes('ECONNRESET') || msg.includes('fetch');
        const isDnsError = msg.includes('ERR_NAME_NOT_RESOLVED');
        if (isDnsError) {
          throw new Error(`无法连接到 Embedding 服务（DNS 解析失败）。请检查：\n1. 网络是否正常\n2. Base URL 是否填写正确\n原始错误：${msg}`);
        }
        const isRetryable = isNetworkError && attempt < MAX_RETRIES;
        if (isRetryable) {
          console.debug(`[Lingxi RAG] Embedding 请求失败，${attempt + 1}s 后重试...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          break;
        }
      }
    }

    console.error('[Lingxi RAG] Embedding 请求失败:', lastError);
    throw lastError;
  }

  /**
   * 测试 Embedding 服务是否可用
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.embed('test');
      return result.length > 0;
    } catch {
      return false;
    }
  }
}
