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
   * @param texts 文本数组
   * @returns 向量数组（与输入顺序一致）
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // 过滤空文本
    const validTexts = texts.map(t => t.trim()).filter(t => t.length > 0);
    if (validTexts.length === 0) return [];

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
          input: validTexts,
        }),
      });

      const data = response.json;
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Embedding API 返回格式异常');
      }

      // 按 index 排序返回
      const sorted = data.data.sort((a: EmbeddingResult, b: EmbeddingResult) => a.index - b.index);
      return sorted.map((item: EmbeddingResult) => item.embedding);
    } catch (error) {
      console.error('[Lingxi RAG] Embedding 请求失败:', error);
      throw error;
    }
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
