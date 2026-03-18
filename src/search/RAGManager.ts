/**
 * RAG 管理器
 * 编排整个 RAG 流程：索引构建 → 查询检索 → 上下文注入
 * 
 * 流程：
 * 1. 插件启动时，扫描 Vault 中的 .md 笔记，增量构建 Embedding 索引
 * 2. 用户发送消息时，将问题 Embedding 后在向量库中检索相关片段
 * 3. 将检索到的知识片段注入 System Prompt，让 LLM 基于真实知识回答
 */

import { App, TFile, TFolder, Notice } from 'obsidian';
import { EmbeddingService } from './EmbeddingService';
import { VectorStore, SearchResult } from './VectorStore';
import { AIChatSettings } from '@/types';

/** 文本片段（用于切分） */
interface TextChunk {
  content: string;
  chunkIndex: number;
}

export class RAGManager {
  private app: App;
  private embeddingService: EmbeddingService | null = null;
  private vectorStore: VectorStore;
  private settings: AIChatSettings;
  private isIndexing: boolean = false;
  private initialized: boolean = false;

  /** 排除的目录前缀（不索引这些目录下的文件） */
  private excludePaths: string[] = [
    'AI笔记',
  ];

  constructor(app: App, settings: AIChatSettings) {
    this.app = app;
    this.settings = settings;
    this.vectorStore = new VectorStore(app);
  }

  /**
   * 初始化 RAG 系统
   */
  async initialize(): Promise<void> {
    if (!this.settings.ragEnabled) {
      console.debug('[Lingxi RAG] RAG 未启用');
      return;
    }

    // 查找 Embedding 提供商
    const provider = this.settings.providers.find(p => p.id === this.settings.ragEmbeddingProvider);
    if (!provider || !provider.apiKey) {
      console.debug('[Lingxi RAG] 未配置 Embedding 提供商或 API Key');
      return;
    }

    const model = this.settings.ragEmbeddingModel || 'text-embedding-v3';
    this.embeddingService = new EmbeddingService(provider, model);

    // 加载已有索引
    const modelKey = `${provider.id}:${model}`;
    await this.vectorStore.load(modelKey);

    // 排除场景目录和归档目录
    this.excludePaths = [
      this.app.vault.configDir,
      this.settings.defaultArchiveFolder,
      this.settings.scenesFolder,
    ];

    this.initialized = true;

    // 启动增量索引（异步，不阻塞启动）
    void this.buildIndex();

    // 监听文件变更
    this.watchFileChanges();

    console.debug('[Lingxi RAG] RAG 系统已初始化');
  }

  /**
   * 增量构建索引
   * 只对新增/修改的文件重新生成 Embedding
   */
  async buildIndex(): Promise<void> {
    if (!this.embeddingService || this.isIndexing) return;

    this.isIndexing = true;
    console.debug('[Lingxi RAG] 开始增量索引构建...');

    try {
      const files = this.app.vault.getMarkdownFiles();
      let indexed = 0;
      let skipped = 0;

      for (const file of files) {
        // 排除特定目录
        if (this.shouldExclude(file.path)) {
          skipped++;
          continue;
        }

        // 检查是否需要重新索引（基于修改时间）
        const existingMtime = this.vectorStore.getFileMtime(file.path);
        if (existingMtime && existingMtime >= file.stat.mtime) {
          skipped++;
          continue;
        }

        try {
          await this.indexFile(file);
          indexed++;

          // 每索引 10 个文件保存一次，防止中途中断丢失
          if (indexed % 10 === 0) {
            await this.vectorStore.save();
          }
        } catch (error) {
          console.error(`[Lingxi RAG] 索引文件失败: ${file.path}`, error);
        }
      }

      await this.vectorStore.save();
      const stats = this.vectorStore.getStats();
      console.debug(`[Lingxi RAG] 索引完成：新增/更新 ${indexed} 个文件，跳过 ${skipped} 个，总计 ${stats.totalFiles} 个文件 ${stats.totalRecords} 条片段`);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * 索引单个文件
   */
  private async indexFile(file: TFile): Promise<void> {
    if (!this.embeddingService) return;

    const content = await this.app.vault.read(file);

    // 去除 frontmatter
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    if (!body || body.length < 50) {
      // 内容太短不索引
      return;
    }

    // 切分为片段
    const chunks = this.splitIntoChunks(body, file.path);
    if (chunks.length === 0) return;

    // 批量获取 Embedding
    const texts = chunks.map(c => c.content);
    const vectors = await this.embeddingService.embedBatch(texts);

    // 存入向量库
    const records = chunks.map((chunk, i) => ({
      content: chunk.content,
      vector: vectors[i],
      chunkIndex: chunk.chunkIndex,
    }));

    this.vectorStore.upsertFile(file.path, records, file.stat.mtime);
  }

  /**
   * 将文本切分为适合 Embedding 的片段
   * 策略：按 Markdown 标题切分，每段不超过 500 字
   */
  private splitIntoChunks(text: string, filePath: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    const maxChunkSize = 500; // 每片段最大字符数

    // 按一级/二级标题切分
    const sections = text.split(/(?=^#{1,2}\s)/m);
    let chunkIndex = 0;

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed || trimmed.length < 20) continue;

      if (trimmed.length <= maxChunkSize) {
        // 在片段前加文件名作为上下文
        const fileName = filePath.replace(/\.md$/, '').split('/').pop() || '';
        chunks.push({
          content: `【${fileName}】${trimmed}`,
          chunkIndex: chunkIndex++,
        });
      } else {
        // 超长段落按段落进一步切分
        const paragraphs = trimmed.split(/\n\n+/);
        let buffer = '';
        const fileName = filePath.replace(/\.md$/, '').split('/').pop() || '';

        for (const para of paragraphs) {
          if (buffer.length + para.length > maxChunkSize && buffer.length > 0) {
            chunks.push({
              content: `【${fileName}】${buffer.trim()}`,
              chunkIndex: chunkIndex++,
            });
            buffer = '';
          }
          buffer += (buffer ? '\n\n' : '') + para;
        }

        if (buffer.trim().length >= 20) {
          chunks.push({
            content: `【${fileName}】${buffer.trim()}`,
            chunkIndex: chunkIndex++,
          });
        }
      }
    }

    return chunks;
  }

  /**
   * 检查文件路径是否应该排除
   */
  private shouldExclude(path: string): boolean {
    return this.excludePaths.some(prefix => path.startsWith(prefix));
  }

  /**
   * 检索与查询相关的知识片段
   * @param query 用户输入的文本
   * @returns 格式化的知识上下文字符串，可直接注入 System Prompt
   */
  async retrieve(query: string): Promise<string> {
    if (!this.initialized || !this.embeddingService) return '';

    try {
      // 获取查询向量
      const queryVector = await this.embeddingService.embed(query);

      // 向量检索
      const results = this.vectorStore.search(
        queryVector,
        this.settings.ragTopK,
        this.settings.ragSimilarityThreshold,
      );

      if (results.length === 0) return '';

      // 格式化检索结果
      return this.formatRetrievalResults(results);
    } catch (error) {
      console.error('[Lingxi RAG] 检索失败:', error);
      return '';
    }
  }

  /**
   * 格式化检索结果为可注入 System Prompt 的文本
   */
  private formatRetrievalResults(results: SearchResult[]): string {
    const parts: string[] = ['以下是从用户知识库中检索到的相关内容，请参考这些内容来回答用户的问题：\n'];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const fileName = r.filePath.replace(/\.md$/, '').split('/').pop() || '';
      parts.push(`【知识片段 ${i + 1}】(来源: ${fileName}, 相关度: ${(r.similarity * 100).toFixed(0)}%)`);
      parts.push(r.content);
      parts.push('');
    }

    parts.push('请基于以上知识库内容和你自身的知识来回答。如果知识库中有相关信息，请优先引用。如果知识库中没有相关信息，请基于你自身知识回答，但要明确说明这不是来自用户的笔记。');

    return parts.join('\n');
  }

  /**
   * 监听文件变更，实时更新索引
   */
  private watchFileChanges(): void {
    // 防抖定时器
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => this.vectorStore.save(), 3000);
    };

    // 文件修改时重新索引
    this.app.vault.on('modify', (file) => {
      if (!(file instanceof TFile) || file.extension !== 'md') return;
      if (this.shouldExclude(file.path) || !this.embeddingService) return;

      void (async () => {
        try {
          await this.indexFile(file);
          debouncedSave();
        } catch (error) {
          console.error(`[Lingxi RAG] 实时索引更新失败: ${file.path}`, error);
        }
      })();
    });

    // 文件删除时移除索引
    this.app.vault.on('delete', (file) => {
      if (!(file instanceof TFile) || file.extension !== 'md') return;
      this.vectorStore.removeFile(file.path);
      debouncedSave();
    });

    // 文件重命名时更新索引
    this.app.vault.on('rename', (file, oldPath) => {
      if (!(file instanceof TFile) || file.extension !== 'md') return;
      this.vectorStore.removeFile(oldPath);
      if (!this.shouldExclude(file.path) && this.embeddingService) {
        void (async () => {
          try {
            await this.indexFile(file);
          } catch (error) {
            console.error(`[Lingxi RAG] 重命名后索引更新失败: ${file.path}`, error);
          }
        })();
      }
      debouncedSave();
    });
  }

  /**
   * 手动触发重建全量索引
   */
  async rebuildIndex(): Promise<void> {
    if (!this.initialized) {
      new Notice('RAG 未启用，请先在设置中开启');
      return;
    }

    this.vectorStore.clear();
    new Notice('正在重建知识索引...');
    await this.buildIndex();
    const stats = this.vectorStore.getStats();
    new Notice(`✅ 索引重建完成：${stats.totalFiles} 个文件，${stats.totalRecords} 条片段`);
  }

  /**
   * 获取索引状态信息
   */
  getStatus(): { enabled: boolean; indexing: boolean; stats: ReturnType<VectorStore['getStats']> | null } {
    return {
      enabled: this.initialized,
      indexing: this.isIndexing,
      stats: this.initialized ? this.vectorStore.getStats() : null,
    };
  }
}
