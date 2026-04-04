/**
 * 对话上下文管理器
 * 管理对话历史、消息截断、Skill 切换、对话持久化
 */

import { ChatMessage, Conversation } from '@/types';
import { localISOString } from '@/utils/datetime';
import { App, PluginManifest } from 'obsidian';

/** 持久化数据格式 */
interface PersistedData {
  conversations: Conversation[];
  activeConversationId: string;
}

/** 生成简单 UUID */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/** 新路径：Vault 内 lingxi-harness/ 目录 */
const STORAGE_FILE = 'lingxi-harness/conversations.json';
/** 旧路径（.obsidian/plugins/lingxi/lingxi-conversations.json）*/
const LEGACY_STORAGE_FILE = 'lingxi-conversations.json';

/** 最大保存对话数 */
const MAX_PERSISTED_CONVERSATIONS = 20;

export class ConversationManager {
  private conversation: Conversation;
  private conversations: Conversation[] = [];
  private maxContextMessages: number;
  private app: App | null = null;
  private manifest: PluginManifest | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(maxContextMessages: number = 20) {
    this.maxContextMessages = maxContextMessages;
    this.conversation = this.createNewConversation();
    this.conversations = [this.conversation];
  }

  /**
   * 获取插件数据目录路径（旧路径，仅用于迁移）
   */
  private getPluginDir(): string {
    const configDir = this.app!.vault.configDir;
    const pluginId = this.manifest?.id || 'lingxi';
    return `${configDir}/plugins/${pluginId}`;
  }

  /**
   * 获取对话历史存储路径（新路径：lingxi-harness/conversations.json）
   */
  private getStorageFilePath(): string {
    return STORAGE_FILE;
  }

  /**
   * 初始化持久化（需要 App 实例和插件 manifest）
   */
  async initPersistence(app: App, manifest?: PluginManifest): Promise<void> {
    this.app = app;
    this.manifest = manifest || null;
    await this.migrateOldData();
    await this.loadFromDisk();
  }

  /**
   * 创建新的对话
   */
  private createNewConversation(): Conversation {
    return {
      id: generateId(),
      title: '',
      messages: [],
      createdAt: localISOString(),
      updatedAt: localISOString(),
      activeSkill: undefined,
    };
  }

  /**
   * 获取当前对话
   */
  getConversation(): Conversation {
    return this.conversation;
  }

  /**
   * 获取所有对话列表
   */
  getAllConversations(): Conversation[] {
    return this.conversations;
  }

  /**
   * 获取所有消息
   */
  getMessages(): ChatMessage[] {
    return this.conversation.messages;
  }

  /**
   * 获取发送给模型的上下文消息（带截断）
   * 策略：保留 system 消息 + 最近 N 条对话（滑动窗口）
   */
  getContextMessages(): ChatMessage[] {
    const messages = this.conversation.messages;

    // 分离 system 消息和非 system 消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // 滑动窗口截断
    const recentMessages = nonSystemMessages.slice(-this.maxContextMessages);

    return [...systemMessages, ...recentMessages];
  }

  /**
   * 追加消息到历史
   */
  append(message: ChatMessage): void {
    this.conversation.messages.push(message);
    this.conversation.updatedAt = localISOString();

    // 自动设置对话标题（取首条用户消息的前20个字）
    if (!this.conversation.title && message.role === 'user') {
      const content = typeof message.content === 'string'
        ? message.content
        : message.content.map(p => p.text || '').join('');
      this.conversation.title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
    }

    this.debounceSave();
  }

  /**
   * 新建对话（保留历史对话列表）
   */
  newConversation(): void {
    // 如果当前对话有消息，保留到历史中
    if (this.conversation.messages.length > 0) {
      // 限制保存的对话数
      if (this.conversations.length >= MAX_PERSISTED_CONVERSATIONS) {
        this.conversations.shift(); // 移除最早的
      }
    } else {
      // 当前对话为空，从列表中移除
      const idx = this.conversations.indexOf(this.conversation);
      if (idx >= 0) this.conversations.splice(idx, 1);
    }

    this.conversation = this.createNewConversation();
    this.conversations.push(this.conversation);
    this.debounceSave();
  }

  /**
   * 切换到指定对话
   */
  switchConversation(conversationId: string): boolean {
    const target = this.conversations.find(c => c.id === conversationId);
    if (!target) return false;
    this.conversation = target;
    return true;
  }

  /**
   * 切换 Skill（保留历史，替换 system prompt）
   */
  switchSkill(skillId: string | undefined): void {
    this.conversation.activeSkill = skillId;
  }

  /**
   * 获取当前激活的 Skill ID
   */
  getActiveSkill(): string | undefined {
    return this.conversation.activeSkill;
  }

  /**
   * 清空消息
   */
  clearMessages(): void {
    this.conversation.messages = [];
    this.conversation.updatedAt = localISOString();
    this.debounceSave();
  }

  /**
   * 获取消息数量
   */
  getMessageCount(): number {
    return this.conversation.messages.length;
  }

  /**
   * 提取最近 N 天内的对话摘要文本（供周报/反思任务使用）
   * 每段对话只保留 user/assistant 消息，单条截断 200 字，防止过长
   */
  getRecentConversationsSummary(days: number = 7): string {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const recent = this.conversations.filter(c => {
      const t = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
      return t >= cutoff && c.messages.length > 0;
    });

    if (recent.length === 0) return '';

    const parts: string[] = [];
    for (const conv of recent) {
      const title = conv.title || '无标题对话';
      const date = conv.updatedAt?.slice(0, 10) ?? '';
      const lines = conv.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
          const role = m.role === 'user' ? '我' : 'AI';
          const text = typeof m.content === 'string'
            ? m.content
            : m.content.map((p: { text?: string }) => p.text || '').join('');
          const truncated = text.length > 200 ? text.slice(0, 200) + '…' : text;
          return `  ${role}: ${truncated}`;
        });
      if (lines.length === 0) continue;
      parts.push(`### ${date} · ${title}\n${lines.join('\n')}`);
    }

    return parts.join('\n\n');
  }

  // ========== 持久化 ==========

  /**
   * 防抖保存（避免频繁写入磁盘）
   */
  private debounceSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.saveToDisk();
    }, 2000);
  }

  /**
   * 迁移旧路径数据（从 obsidian-lingxi 迁移到正确的插件目录）
   */
  private async migrateOldData(): Promise<void> {
    if (!this.app) return;

    try {
      const configDir = this.app.vault.configDir;
      const oldPath = `${configDir}/plugins/obsidian-lingxi/${STORAGE_FILE}`;
      const newDir = this.getPluginDir();
      const newPath = `${newDir}/${STORAGE_FILE}`;

      // 如果旧路径和新路径相同，无需迁移
      if (oldPath === newPath) return;

      const oldExists = await this.app.vault.adapter.exists(oldPath);
      if (!oldExists) return;

      const newExists = await this.app.vault.adapter.exists(newPath);
      if (newExists) {
        // 新路径已有数据，删除旧文件
        console.debug('[Lingxi] 新路径已有数据，删除旧路径文件');
        await this.app.vault.adapter.remove(oldPath);
      } else {
        // 迁移：读取旧数据写入新路径
        const raw = await this.app.vault.adapter.read(oldPath);
        const dirExists = await this.app.vault.adapter.exists(newDir);
        if (!dirExists) {
          await this.app.vault.adapter.mkdir(newDir);
        }
        await this.app.vault.adapter.write(newPath, raw);
        await this.app.vault.adapter.remove(oldPath);
        console.debug('[Lingxi] 已将对话数据从旧路径迁移到新路径');
      }

      // 尝试删除旧的空目录
      const oldDir = `${configDir}/plugins/obsidian-lingxi`;
      try {
        const oldDirFiles = await this.app.vault.adapter.list(oldDir);
        if (oldDirFiles.files.length === 0 && oldDirFiles.folders.length === 0) {
          await this.app.vault.adapter.rmdir(oldDir, false);
          console.debug('[Lingxi] 已删除空的旧插件目录 obsidian-lingxi');
        }
      } catch {
        // 目录不为空或删除失败，忽略
      }
    } catch (error) {
      console.error('[Lingxi] 迁移旧数据失败:', error);
    }
  }

  /**
   * 从磁盘加载对话历史（优先新路径，自动迁移旧路径）
   */
  private async loadFromDisk(): Promise<void> {
    if (!this.app) return;

    try {
      const filePath = this.getStorageFilePath();

      // 确保 lingxi-harness 目录存在
      const dir = 'lingxi-harness';
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }

      // 旧路径迁移：.obsidian/plugins/lingxi/lingxi-conversations.json → 新路径
      if (!(await this.app.vault.adapter.exists(filePath))) {
        const pluginDir = this.getPluginDir();
        const legacyPath = `${pluginDir}/${LEGACY_STORAGE_FILE}`;
        if (await this.app.vault.adapter.exists(legacyPath)) {
          console.debug('[Lingxi] 迁移对话历史到 lingxi-harness/');
          const raw = await this.app.vault.adapter.read(legacyPath);
          await this.app.vault.adapter.write(filePath, raw);
          // 保留旧文件作备份，不删除
        }
      }

      const fileExists = await this.app.vault.adapter.exists(filePath);
      if (!fileExists) {
        console.debug('[Lingxi] 无历史对话记录');
        return;
      }

      const raw = await this.app.vault.adapter.read(filePath);
      const data = JSON.parse(raw) as PersistedData;

      if (data.conversations && data.conversations.length > 0) {
        this.conversations = data.conversations;
        const active = this.conversations.find(c => c.id === data.activeConversationId);
        if (active) {
          this.conversation = active;
        } else {
          this.conversation = this.conversations[this.conversations.length - 1];
        }
        console.debug(`[Lingxi] 已恢复 ${this.conversations.length} 个对话`);
      }
    } catch (error) {
      console.error('[Lingxi] 加载对话历史失败:', error);
    }
  }

  /**
   * 保存对话历史到磁盘
   */
  private async saveToDisk(): Promise<void> {
    if (!this.app) return;

    try {
      // 确保目录存在
      const dir = 'lingxi-harness';
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }

      const data: PersistedData = {
        conversations: this.conversations,
        activeConversationId: this.conversation.id,
      };

      await this.app.vault.adapter.write(this.getStorageFilePath(), JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[Lingxi] 保存对话历史失败:', error);
    }
  }
}
