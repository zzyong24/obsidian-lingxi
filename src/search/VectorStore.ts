/**
 * 本地向量存储
 * 使用 JSON 文件存储向量索引，通过余弦相似度进行检索
 * 存储在 Vault configDir 目录下
 */

import { App, TFile } from 'obsidian';

const INDEX_VERSION = 1;

/** 单个文档的向量记录 */
export interface VectorRecord {
  /** 笔记的 Vault 路径 */
  filePath: string;
  /** 文本片段（用于注入上下文） */
  content: string;
  /** 片段在文件中的位置描述 */
  chunkIndex: number;
  /** Embedding 向量 */
  vector: number[];
  /** 文件最后修改时间（用于增量索引） */
  mtime: number;
}

/** 向量索引数据结构 */
export interface VectorIndex {
  /** 索引版本 */
  version: number;
  /** Embedding 模型标识（模型变更时需重建） */
  embeddingModel: string;
  /** 向量维度 */
  dimensions: number;
  /** 所有记录 */
  records: VectorRecord[];
  /** 上次全量索引时间 */
  lastFullIndexTime: number;
}

/** 检索结果 */
export interface SearchResult {
  filePath: string;
  content: string;
  similarity: number;
  chunkIndex: number;
}

export class VectorStore {
  private app: App;
  private index: VectorIndex;
  private dirty: boolean = false;

  constructor(app: App) {
    this.app = app;
    this.index = this.createEmptyIndex('');
  }

  /**
   * 获取索引文件路径（新路径：lingxi-harness/vector-index.json）
   */
  private getIndexFilePath(): string {
    return 'lingxi-harness/vector-index.json';
  }

  /**
   * 旧索引路径（.obsidian/plugins/lingxi/vector-index.json）
   * 用于向前兼容迁移
   */
  private getLegacyIndexFilePath(): string {
    return `${this.app.vault.configDir}/plugins/lingxi/vector-index.json`;
  }

  /**
   * 创建空索引
   */
  private createEmptyIndex(embeddingModel: string): VectorIndex {
    return {
      version: INDEX_VERSION,
      embeddingModel,
      dimensions: 0,
      records: [],
      lastFullIndexTime: 0,
    };
  }

  /**
   * 加载索引文件（自动迁移旧路径）
   */
  async load(currentModel: string): Promise<void> {
    try {
      const indexFile = this.getIndexFilePath();
      const legacyFile = this.getLegacyIndexFilePath();

      // 确保 lingxi-harness 目录存在
      const dir = 'lingxi-harness';
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }

      // 旧路径迁移：把 .obsidian/plugins/lingxi/vector-index.json 移到新位置
      const newExists = await this.app.vault.adapter.exists(indexFile);
      if (!newExists) {
        const legacyExists = await this.app.vault.adapter.exists(legacyFile);
        if (legacyExists) {
          console.debug('[Lingxi RAG] 迁移索引文件到 lingxi-harness/');
          const content = await this.app.vault.adapter.read(legacyFile);
          await this.app.vault.adapter.write(indexFile, content);
          // 不删除旧文件，保留作备份
        }
      }

      const file = this.app.vault.getAbstractFileByPath(indexFile);
      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        const data = JSON.parse(content) as VectorIndex;

        // 模型变更时需要重建索引
        if (data.embeddingModel !== currentModel || data.version !== INDEX_VERSION) {
          console.debug('[Lingxi RAG] Embedding 模型变更或索引版本不匹配，清空索引');
          this.index = this.createEmptyIndex(currentModel);
          this.dirty = true;
        } else {
          this.index = data;
        }
      } else {
        this.index = this.createEmptyIndex(currentModel);
      }
    } catch (error) {
      console.error('[Lingxi RAG] 加载向量索引失败:', error);
      this.index = this.createEmptyIndex(currentModel);
    }
    console.debug(`[Lingxi RAG] 索引已加载，包含 ${this.index.records.length} 条记录`);
  }

  /**
   * 持久化索引到磁盘
   */
  async save(): Promise<void> {
    if (!this.dirty) return;

    try {
      const indexFile = this.getIndexFilePath();
      const content = JSON.stringify(this.index);
      const file = this.app.vault.getAbstractFileByPath(indexFile);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      } else {
        // 确保目录存在
        await this.app.vault.adapter.write(indexFile, content);
      }
      this.dirty = false;
      console.debug(`[Lingxi RAG] 索引已保存，共 ${this.index.records.length} 条记录`);
    } catch (error) {
      console.error('[Lingxi RAG] 保存向量索引失败:', error);
    }
  }

  /**
   * 添加或更新文件的向量记录
   */
  upsertFile(filePath: string, chunks: { content: string; vector: number[]; chunkIndex: number }[], mtime: number): void {
    // 先删除该文件的旧记录
    this.index.records = this.index.records.filter(r => r.filePath !== filePath);

    // 添加新记录
    for (const chunk of chunks) {
      this.index.records.push({
        filePath,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        vector: chunk.vector,
        mtime,
      });

      // 记录维度
      if (this.index.dimensions === 0 && chunk.vector.length > 0) {
        this.index.dimensions = chunk.vector.length;
      }
    }

    this.index.embeddingModel = this.index.embeddingModel || '';
    this.dirty = true;
  }

  /**
   * 删除文件的向量记录
   */
  removeFile(filePath: string): void {
    const before = this.index.records.length;
    this.index.records = this.index.records.filter(r => r.filePath !== filePath);
    if (this.index.records.length !== before) {
      this.dirty = true;
    }
  }

  /**
   * 获取文件的最后修改时间（用于增量索引判断）
   */
  getFileMtime(filePath: string): number | undefined {
    const record = this.index.records.find(r => r.filePath === filePath);
    return record?.mtime;
  }

  /**
   * 检查文件是否已索引
   */
  isFileIndexed(filePath: string): boolean {
    return this.index.records.some(r => r.filePath === filePath);
  }

  /**
   * 余弦相似度搜索
   * @param queryVector 查询向量
   * @param topK 返回 Top K 结果
   * @param threshold 最低相似度阈值
   * @returns 按相似度降序排列的结果
   */
  search(queryVector: number[], topK: number = 3, threshold: number = 0.3): SearchResult[] {
    if (this.index.records.length === 0) return [];

    const results: SearchResult[] = [];

    for (const record of this.index.records) {
      const similarity = this.cosineSimilarity(queryVector, record.vector);
      if (similarity >= threshold) {
        results.push({
          filePath: record.filePath,
          content: record.content,
          similarity,
          chunkIndex: record.chunkIndex,
        });
      }
    }

    // 按相似度降序排序，取 Top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * 余弦相似度计算
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 获取索引统计信息
   */
  getStats(): { totalRecords: number; totalFiles: number; dimensions: number; embeddingModel: string } {
    const uniqueFiles = new Set(this.index.records.map(r => r.filePath));
    return {
      totalRecords: this.index.records.length,
      totalFiles: uniqueFiles.size,
      dimensions: this.index.dimensions,
      embeddingModel: this.index.embeddingModel,
    };
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.index = this.createEmptyIndex(this.index.embeddingModel);
    this.dirty = true;
  }
}
