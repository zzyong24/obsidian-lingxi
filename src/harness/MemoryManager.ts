/**
 * MemoryManager — 持久记忆管理器
 * 职责：记忆的提取、存储、召回、淘汰
 *
 * 存储结构（在 vault 内，用户可直接编辑）：
 * vault/lingxi-harness/
 * ├── MEMORY.md              ← 用户画像（类比 CLAUDE.md）
 * └── memories/
 *     ├── 20260401_写作风格偏好.md
 *     └── ...
 */

import { App, TFile, TFolder, Notice } from 'obsidian';
import { MemoryEntry, MemoryType, ExtractedMemory, ChatMessage, AIChatSettings } from '@/types';
import { ProviderRegistry } from '@/providers';

/** harness 目录相对 vault 根目录的路径（不用 . 前缀，让 Obsidian 侧栏可见可编辑） */
const HARNESS_DIR = 'lingxi-harness';
const MEMORIES_DIR = `${HARNESS_DIR}/memories`;
const MEMORY_PROFILE = `${HARNESS_DIR}/MEMORY.md`;
const TODOS_FILE = `${HARNESS_DIR}/lingxi-todos.md`;

/** 默认用户画像模板 */
const DEFAULT_PROFILE = `# 用户画像

## 基本信息
- 角色：
- 主要平台：

## 偏好
- 写作风格：
- 常用模型：

## 当前项目
-
`;

/** 记忆提取 Prompt */
const EXTRACT_PROMPT = `请从以下对话中提取值得长期记住的信息。只提取以下类型：
1. fact: 关于用户的客观事实（职业、项目、平台等）
2. preference: 用户的偏好（喜欢/讨厌的风格、词汇等）
3. decision: 用户做出的重要决策
4. task: 用户提到的待办事项

输出 JSON 数组，每条包含 type、content、tags。
如果没有值得记忆的信息，返回空数组 []。

注意：
- 只提取有长期价值的信息，日常寒暄不要提取
- content 用一两句话概括，不要太长
- tags 是 1-3 个关键词

对话内容：
`;

export class MemoryManager {
  private app: App;
  private settings: AIChatSettings;
  private providerRegistry: ProviderRegistry;
  private memories: MemoryEntry[] = [];
  private profile: string = '';
  private initialized = false;
  /** 防止并发提取导致重复记忆 */
  private isExtracting = false;

  constructor(app: App, settings: AIChatSettings, providerRegistry: ProviderRegistry) {
    this.app = app;
    this.settings = settings;
    this.providerRegistry = providerRegistry;
  }

  /**
   * 初始化：确保 lingxi-harness 目录存在，加载已有记忆
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 确保目录结构存在
      await this.ensureDir(HARNESS_DIR);
      await this.ensureDir(MEMORIES_DIR);

      // 加载 MEMORY.md（如果不存在则创建默认模板）
      await this.loadProfile();

      // 加载所有记忆条目
      await this.loadAllMemories();

      this.initialized = true;
      console.debug(`[Lingxi Harness] MemoryManager 初始化完成，已加载 ${this.memories.length} 条记忆`);
    } catch (error) {
      console.error('[Lingxi Harness] MemoryManager 初始化失败:', error);
    }
  }

  /**
   * 更新设置引用
   */
  updateSettings(settings: AIChatSettings): void {
    this.settings = settings;
  }

  // ==================== 核心 API ====================

  /**
   * 从对话中提取记忆（对话结束时调用）
   * @param messages 对话消息列表
   * @param modelOverride 可选，覆盖 defaultTextModel（传入当前聊天使用的模型）
   */
  async extract(messages: ChatMessage[], modelOverride?: string): Promise<ExtractedMemory[]> {
    if (!this.settings.harnessEnabled || !this.settings.harnessAutoExtract) return [];
    if (messages.length < 2) return [];
    // 防止并发提取导致重复记忆
    if (this.isExtracting) {
      console.debug('[Lingxi Harness] 记忆提取已在进行中，跳过本次');
      return [];
    }
    this.isExtracting = true;

    try {
      // 构建对话摘要文本
      const conversationText = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
          const content = typeof m.content === 'string'
            ? m.content
            : m.content.map(p => p.text || '').join('');
          return `${m.role === 'user' ? '用户' : 'AI'}: ${content}`;
        })
        .join('\n');

      // 调用 LLM 提取记忆（优先用当前聊天模型，兜底用 defaultTextModel）
      const modelStr = modelOverride || this.settings.defaultTextModel;
      const resolved = this.providerRegistry.resolveModel(modelStr);
      if (!resolved) {
        console.warn(`[Lingxi Harness] 记忆提取跳过：无法解析模型 "${modelStr}"`);
        return [];
      }

      const { provider, model } = resolved;
      console.debug(`[Lingxi Harness] 记忆提取使用模型: ${modelStr} → model="${model}"`);

      const extractMessages: ChatMessage[] = [
        { role: 'system', content: '你是一个记忆提取助手。请严格按照要求输出 JSON 数组。' },
        { role: 'user', content: EXTRACT_PROMPT + conversationText },
      ];

      const result = await provider.chatComplete(extractMessages, {
        model,
        temperature: 0.1,
      });

      // 解析 JSON 结果
      const extracted = this.parseExtractedMemories(result.content);
      if (extracted.length === 0) return [];

      // 保存每条记忆
      for (const mem of extracted) {
        await this.save(mem);
      }

      if (extracted.length > 0) {
        new Notice(`🧠 灵犀记住了 ${extracted.length} 条信息`);
      }

      return extracted;
    } catch (error) {
      console.error('[Lingxi Harness] 记忆提取失败:', error);
      return [];
    } finally {
      this.isExtracting = false;
    }
  }

  /**
   * 根据当前对话内容，召回最相关的记忆条目
   */
  async recall(query: string, topK?: number): Promise<MemoryEntry[]> {
    if (!this.settings.harnessEnabled) return [];
    const k = topK ?? this.settings.harnessRecallTopK;

    // 关键词匹配策略（无 embedding 时的退化方案）
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return this.memories.slice(0, k);

    const scored = this.memories.map(mem => {
      let score = 0;
      const memText = `${mem.content} ${mem.tags.join(' ')}`.toLowerCase();

      for (const term of queryTerms) {
        if (memText.includes(term)) {
          score += term.length; // 越长的匹配词权重越高
        }
      }

      // tags 精确匹配加分
      for (const tag of mem.tags) {
        if (queryTerms.includes(tag.toLowerCase())) {
          score += 5;
        }
      }

      // 最近访问的轻微加分（时效性）
      const daysSinceAccess = (Date.now() - new Date(mem.lastAccessed).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAccess < 7) score += 1;

      return { mem, score };
    });

    // 按分数排序，取 topK
    scored.sort((a, b) => b.score - a.score);
    const results = scored
      .filter(s => s.score > 0)
      .slice(0, k)
      .map(s => s.mem);

    // 更新 lastAccessed
    const now = new Date().toISOString().split('T')[0];
    for (const mem of results) {
      if (mem.lastAccessed !== now) {
        mem.lastAccessed = now;
        // 异步更新文件，不阻塞
        void this.updateMemoryFile(mem);
      }
    }

    return results;
  }

  /**
   * 保存一条记忆到 memories/ 目录
   */
  async save(memory: ExtractedMemory): Promise<MemoryEntry> {
    // 去重检查：如果已有高度相似的记忆，跳过
    const isDuplicate = this.memories.some(existing =>
      existing.type === memory.type &&
      this.similarity(existing.content, memory.content) > 0.8
    );
    if (isDuplicate) {
      console.debug('[Lingxi Harness] 跳过重复记忆:', memory.content.slice(0, 30));
      return this.memories.find(m => m.type === memory.type && this.similarity(m.content, memory.content) > 0.8)!;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const safeTitle = memory.content.slice(0, 20).replace(/[\/\\:*?"<>|#\[\]]/g, '_');
    const id = `${dateStr}_${safeTitle}`;
    const filePath = `${MEMORIES_DIR}/${id}.md`;

    const entry: MemoryEntry = {
      id,
      type: memory.type,
      content: memory.content,
      tags: memory.tags,
      created: now.toISOString().split('T')[0],
      lastAccessed: now.toISOString().split('T')[0],
      source: 'conversation',
    };

    // 写入文件
    const fileContent = this.serializeMemory(entry);
    await this.writeFile(filePath, fileContent);

    this.memories.push(entry);

    // task 类型额外写入 lingxi-todos.md（Obsidian Tasks 格式，用户可直接勾选）
    if (entry.type === 'task') {
      void this.appendTodo(entry);
    }

    // 检查是否需要 GC
    if (this.memories.length > this.settings.harnessMemoryLimit) {
      await this.gc();
    }

    return entry;
  }

  /**
   * 读取 MEMORY.md（用户画像）
   */
  async loadProfile(): Promise<string> {
    try {
      const exists = await this.app.vault.adapter.exists(MEMORY_PROFILE);
      if (!exists) {
        await this.writeFile(MEMORY_PROFILE, DEFAULT_PROFILE);
        this.profile = DEFAULT_PROFILE;
      } else {
        this.profile = await this.app.vault.adapter.read(MEMORY_PROFILE);
      }
    } catch (error) {
      console.error('[Lingxi Harness] 加载 MEMORY.md 失败:', error);
      this.profile = '';
    }
    return this.profile;
  }

  /**
   * 获取当前用户画像内容
   */
  getProfile(): string {
    return this.profile;
  }

  /**
   * 获取记忆条目数量
   */
  getMemoryCount(): number {
    return this.memories.length;
  }

  /**
   * 获取所有记忆（只读）
   */
  getAllMemories(): readonly MemoryEntry[] {
    return this.memories;
  }

  /**
   * 获取最近 N 天内新增的记忆（按 created 过滤，全量返回，不做关键词筛选）
   * 用于周报/反思等需要完整时间段数据的场景
   */
  getRecentMemories(days: number = 7): MemoryEntry[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.memories.filter(m => {
      if (!m.created) return false;
      return new Date(m.created).getTime() >= cutoff;
    });
  }

  /**
   * 垃圾回收：淘汰最久未访问的记忆条目
   */
  async gc(): Promise<number> {
    const limit = this.settings.harnessMemoryLimit;
    if (this.memories.length <= limit) return 0;

    // 按 lastAccessed 排序（旧的在前）
    this.memories.sort((a, b) =>
      new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
    );

    const toRemove = this.memories.splice(0, this.memories.length - limit);

    // 删除文件
    for (const mem of toRemove) {
      const filePath = `${MEMORIES_DIR}/${mem.id}.md`;
      try {
        const exists = await this.app.vault.adapter.exists(filePath);
        if (exists) {
          await this.app.vault.adapter.remove(filePath);
        }
      } catch (error) {
        console.error(`[Lingxi Harness] 删除记忆文件失败: ${filePath}`, error);
      }
    }

    console.debug(`[Lingxi Harness] GC 清理了 ${toRemove.length} 条记忆`);
    return toRemove.length;
  }

  /**
   * 清除所有记忆
   */
  async clearAll(): Promise<void> {
    for (const mem of this.memories) {
      const filePath = `${MEMORIES_DIR}/${mem.id}.md`;
      try {
        const exists = await this.app.vault.adapter.exists(filePath);
        if (exists) {
          await this.app.vault.adapter.remove(filePath);
        }
      } catch (error) {
        // ignore
      }
    }
    this.memories = [];
    new Notice('🧹 已清除所有记忆');
  }

  /**
   * 打开 MEMORY.md 供用户编辑
   */
  async openProfile(): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(MEMORY_PROFILE);
    if (file instanceof TFile) {
      await this.app.workspace.openLinkText(MEMORY_PROFILE, '', false);
    } else {
      new Notice('MEMORY.md 不存在，正在创建...');
      await this.writeFile(MEMORY_PROFILE, DEFAULT_PROFILE);
      await this.app.workspace.openLinkText(MEMORY_PROFILE, '', false);
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 加载所有记忆条目
   */
  private async loadAllMemories(): Promise<void> {
    this.memories = [];

    try {
      const folder = this.app.vault.getAbstractFileByPath(MEMORIES_DIR);
      if (!folder || !(folder instanceof TFolder)) return;

      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === 'md') {
          try {
            const content = await this.app.vault.read(child);
            const entry = this.parseMemoryFile(content, child.basename);
            if (entry) {
              this.memories.push(entry);
            }
          } catch (error) {
            console.error(`[Lingxi Harness] 加载记忆失败: ${child.path}`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Lingxi Harness] 加载记忆目录失败:', error);
    }
  }

  /**
   * 解析记忆文件 → MemoryEntry
   */
  private parseMemoryFile(content: string, basename: string): MemoryEntry | null {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fmMatch) return null;

    const frontmatter = fmMatch[1];
    const body = fmMatch[2].trim();

    const getField = (key: string): string => {
      const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
      return match ? match[1].trim() : '';
    };

    const getArrayField = (key: string): string[] => {
      const raw = getField(key);
      if (!raw) return [];
      try {
        return JSON.parse(raw.replace(/'/g, '"'));
      } catch {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
      }
    };

    const type = getField('type') as MemoryType;
    if (!['fact', 'preference', 'decision', 'task'].includes(type)) return null;

    return {
      id: basename,
      type,
      content: body,
      tags: getArrayField('tags'),
      created: getField('created') || '',
      lastAccessed: getField('lastAccessed') || getField('created') || '',
      source: (getField('source') as 'conversation' | 'manual') || 'conversation',
    };
  }

  /**
   * 序列化 MemoryEntry → Markdown 文件内容
   */
  private serializeMemory(entry: MemoryEntry): string {
    const cleanTag = (t: string) =>
      t.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '').slice(0, 30);
    const tags = [...new Set(['memory', 'lingxi', 'lingxi-system', entry.type, ...entry.tags.map(cleanTag)])].filter(Boolean);
    return `---
type: memory
created: ${entry.created}
lastAccessed: ${entry.lastAccessed}
source: lingxi-system
memory_type: ${entry.type}
tags: [${tags.map(t => `"${t}"`).join(', ')}]
---

${entry.content}
`;
  }

  /**
   * 更新记忆文件（主要用于更新 lastAccessed）
   */
  private async updateMemoryFile(entry: MemoryEntry): Promise<void> {
    const filePath = `${MEMORIES_DIR}/${entry.id}.md`;
    try {
      const exists = await this.app.vault.adapter.exists(filePath);
      if (exists) {
        await this.writeFile(filePath, this.serializeMemory(entry));
      }
    } catch (error) {
      // 非关键操作，静默失败
    }
  }

  /**
   * 解析 LLM 返回的记忆 JSON
   */
  private parseExtractedMemories(text: string): ExtractedMemory[] {
    try {
      // 尝试直接解析
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.filter(item =>
          item.type && item.content &&
          ['fact', 'preference', 'decision', 'task'].includes(item.type)
        ).map(item => ({
          type: item.type as MemoryType,
          content: String(item.content),
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        }));
      }
    } catch {
      // 尝试从 markdown code block 中提取 JSON
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          if (Array.isArray(parsed)) {
            return parsed.filter(item =>
              item.type && item.content &&
              ['fact', 'preference', 'decision', 'task'].includes(item.type)
            ).map(item => ({
              type: item.type as MemoryType,
              content: String(item.content),
              tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
            }));
          }
        } catch {
          // 解析失败
        }
      }
    }

    console.debug('[Lingxi Harness] 记忆提取结果解析失败:', text.slice(0, 200));
    return [];
  }

  /**
   * 简单的文本相似度（Jaccard 系数）
   */
  private similarity(a: string, b: string): number {
    const setA = new Set(this.tokenize(a));
    const setB = new Set(this.tokenize(b));
    if (setA.size === 0 && setB.size === 0) return 1;
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    return intersection / (setA.size + setB.size - intersection);
  }

  /**
   * 简单分词（中文按字/英文按词）
   */
  private tokenize(text: string): string[] {
    const lower = text.toLowerCase();
    // 英文词
    const words = lower.match(/[a-z]+/g) || [];
    // 中文按 2-gram
    const chinese = lower.replace(/[a-z0-9\s\p{P}]/gu, '');
    const bigrams: string[] = [];
    for (let i = 0; i < chinese.length - 1; i++) {
      bigrams.push(chinese.slice(i, i + 2));
    }
    return [...words, ...bigrams].filter(t => t.length >= 2);
  }

  /**
   * 将 task 类记忆追加到 lingxi-todos.md（Obsidian Tasks 格式）
   * 格式：- [ ] 任务内容 📅 YYYY-MM-DD #lingxi
   */
  private async appendTodo(entry: MemoryEntry): Promise<void> {
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // 默认 7 天后到期
      const dueDateStr = dueDate.toISOString().slice(0, 10);
      const todoLine = `- [ ] ${entry.content} 📅 ${dueDateStr} #lingxi\n`;

      const exists = await this.app.vault.adapter.exists(TODOS_FILE);
      if (!exists) {
        // 首次创建，加文件头
        const header = `# 灵犀待办\n\n> 由灵犀 AI 自动从对话中提取，可直接勾选完成。\n\n`;
        await this.writeFile(TODOS_FILE, header + todoLine);
      } else {
        const current = await this.app.vault.adapter.read(TODOS_FILE);
        await this.writeFile(TODOS_FILE, current + todoLine);
      }
    } catch (error) {
      console.error('[Lingxi Harness] 写入 todos 失败:', error);
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

  /**
   * 写文件（使用 adapter 而非 vault.create，避免触发不必要的 indexing）
   */
  private async writeFile(path: string, content: string): Promise<void> {
    await this.app.vault.adapter.write(path, content);
  }
}
