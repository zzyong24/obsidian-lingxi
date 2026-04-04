/**
 * 插件入口 main.ts
 * 参考 copilot 的 main.ts 架构
 */

import { CHAT_VIEWTYPE } from '@/constants';
import { AIChatSettings } from '@/types';
import { getSettings, setSettings, sanitizeSettings } from '@/settings';
import { ProviderRegistry } from '@/providers';
import { SceneManager, SkillFileOperator } from '@/skills';
import { ToolCallHandler } from '@/skills/ToolCallHandler';
import { AutoArchiver } from '@/archive/AutoArchiver';
import { ConversationManager } from '@/conversation/ConversationManager';
import { RAGManager } from '@/search/RAGManager';
import { ContentFetcher } from '@/search/ContentFetcher';
import { MemoryManager, ContextBuilder, CompactionEngine, Scheduler, WorklogManager } from '@/harness';
import ChatView from '@/ui/ChatView';
import { AIChatSettingTab } from '@/ui/SettingsTab';
import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';

export default class AIChatPlugin extends Plugin {
  // 核心组件
  providerRegistry: ProviderRegistry;
  sceneManager: SceneManager;
  skillFileOperator: SkillFileOperator;
  toolCallHandler: ToolCallHandler;
  archiver: AutoArchiver;
  conversationManager: ConversationManager;
  ragManager: RAGManager;

  // Harness 组件
  memoryManager: MemoryManager;
  contextBuilder: ContextBuilder;
  compactionEngine: CompactionEngine;
  scheduler: Scheduler;
  worklogManager: WorklogManager;
  contentFetcher: ContentFetcher;

  async onload(): Promise<void> {
    console.debug(`[AI Chat] 加载插件 v${this.manifest.version}`);

    // 加载设置
    await this.loadPluginSettings();

    const settings = getSettings();

    // 初始化核心组件
    this.providerRegistry = new ProviderRegistry();
    this.providerRegistry.initialize(settings);

    this.sceneManager = new SceneManager(this.app, settings.scenesFolder);
    this.skillFileOperator = new SkillFileOperator(this.app, settings.scenesFolder, this.sceneManager);
    this.toolCallHandler = new ToolCallHandler(this.skillFileOperator, this.sceneManager);
    this.archiver = new AutoArchiver(this.app, settings.defaultArchiveFolder, settings.scenesFolder);
    this.conversationManager = new ConversationManager(settings.maxContextMessages);
    this.ragManager = new RAGManager(this.app, settings);

    // 初始化 Harness 组件
    this.memoryManager = new MemoryManager(this.app, settings, this.providerRegistry);
    this.contextBuilder = new ContextBuilder(this.sceneManager, this.memoryManager, settings);
    this.compactionEngine = new CompactionEngine(this.app, settings, this.providerRegistry);
    this.worklogManager = new WorklogManager(this.app, settings);
    this.contentFetcher = new ContentFetcher();
    this.scheduler = new Scheduler(this.app, settings, this.providerRegistry, this.memoryManager, this.conversationManager, this.worklogManager);

    // 注册聊天视图
    this.registerView(
      CHAT_VIEWTYPE,
      (leaf: WorkspaceLeaf) => new ChatView(leaf, this)
    );

    // 注册设置页面
    this.addSettingTab(new AIChatSettingTab(this.app, this));

    // 添加左侧 Ribbon 图标
    this.addRibbonIcon('message-square', 'Open chat panel', () => {
      void this.activateView();
    });

    // 注册命令
    this.addCommand({
      id: 'open-ai-chat',
      name: 'Open chat',
      callback: () => { void this.activateView(); },
    });

    this.addCommand({
      id: 'new-ai-chat',
      name: 'New conversation',
      callback: () => this.newChat(),
    });

    // Harness 命令
    this.addCommand({
      id: 'open-memory',
      name: 'Open MEMORY.md (user profile)',
      callback: () => { void this.memoryManager.openProfile(); },
    });

    this.addCommand({
      id: 'forget-all',
      name: 'Clear all memories',
      callback: () => { void this.memoryManager.clearAll(); },
    });

    this.addCommand({
      id: 'compact-conversation',
      name: 'Compact current conversation',
      callback: () => this.triggerCompact(),
    });

    // 在 layout ready 后初始化场景管理器和 RAG
    this.app.workspace.onLayoutReady(() => {
      void (async () => {
        await this.sceneManager.initialize();
        await this.conversationManager.initPersistence(this.app, this.manifest);
        await this.ragManager.initialize();
        // Harness 初始化
        await this.memoryManager.initialize();
        await this.scheduler.initialize();
        // 检查并执行到期的自驱动任务
        await this.scheduler.tick();
      })();
    });
  }

  onunload(): void {
    console.debug('[AI Chat] 卸载插件');
  }

  /**
   * 激活聊天视图
   */
  async activateView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEWTYPE);
    if (leaves.length === 0) {
      // 在右侧面板打开
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: CHAT_VIEWTYPE,
          active: true,
        });
      }
    }
    // 显示已有的视图
    const existingLeaves = this.app.workspace.getLeavesOfType(CHAT_VIEWTYPE);
    if (existingLeaves.length > 0) {
      void this.app.workspace.revealLeaf(existingLeaves[0]);
    }
  }

  /**
   * 新建对话
   */
  newChat(): void {
    this.conversationManager.newConversation();
    // 刷新视图
    const leaf = this.app.workspace.getLeavesOfType(CHAT_VIEWTYPE)[0];
    if (leaf) {
      const chatView = leaf.view as unknown as ChatView;
      chatView.updateView();
    }
  }

  /**
   * 加载设置
   */
  async loadPluginSettings(): Promise<void> {
    const saved = await this.loadData();
    const settings = sanitizeSettings(saved);
    setSettings(settings);
  }

  /**
   * 保存设置
   */
  async savePluginSettings(settings: AIChatSettings): Promise<void> {
    setSettings(settings);
    await this.saveData(settings);

    // 重新初始化 Provider
    this.providerRegistry.initialize(settings);

    // 更新 Harness 组件的设置引用
    this.memoryManager.updateSettings(settings);
    this.contextBuilder.updateSettings(settings);
    this.compactionEngine.updateSettings(settings);
    this.scheduler.updateSettings(settings);
    this.worklogManager.updateSettings(settings);
  }

  /**
   * 获取当前设置
   */
  getSettings(): AIChatSettings {
    return { ...getSettings() };
  }

  /**
   * 测试提供商连接，返回 null 表示成功，返回错误信息字符串表示失败
   */
  async testProviderConnection(providerId: string): Promise<string | null> {
    const provider = this.providerRegistry.getProvider(providerId);
    if (!provider) {
      const msg = '未找到该提供商，请确认 API key 已配置';
      new Notice(msg);
      return msg;
    }
    const result = await provider.testConnection();
    if (result.success) {
      new Notice('✅ 连接成功！');
      return null;
    } else {
      const msg = result.error || '请检查 API key 和 Base URL';
      new Notice(`❌ 连接失败: ${msg}`);
      return msg;
    }
  }

  /**
   * 测试 Embedding 服务连接
   * 用当前设置里的 Key/BaseURL 临时构造 EmbeddingService 发送一次测试请求
   * 返回 null 表示成功，返回错误字符串表示失败
   */
  async testEmbeddingConnection(): Promise<string | null> {
    const s = getSettings();
    const baseProvider = s.providers.find(p => p.id === s.ragEmbeddingProvider);
    const apiKey = s.ragEmbeddingApiKey?.trim() || baseProvider?.apiKey || '';
    const baseUrl = s.ragEmbeddingBaseUrl?.trim() || baseProvider?.baseUrl || '';
    const model = s.ragEmbeddingModel?.trim() || 'text-embedding-v3';

    if (!apiKey || !baseUrl) {
      return '请先填写 Embedding API Key 和 Base URL（或选择参考提供商）';
    }

    // 动态导入避免循环依赖
    const { EmbeddingService } = await import('@/search/EmbeddingService');
    const svc = new EmbeddingService({ id: 'test', name: 'test', baseUrl, apiKey, defaultModel: model }, model);
    try {
      const ok = await svc.testConnection();
      if (ok) return null;
      return '连接失败：服务返回空向量，请检查模型名称是否正确';
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  /**
   * 重建 RAG 向量索引
   * 返回索引文件保存路径（用于 UI 提示用户）
   */
  async rebuildIndex(): Promise<{ ok: boolean; message: string; indexPath?: string }> {
    const s = getSettings();
    if (!s.ragEnabled) {
      return { ok: false, message: '请先在设置中开启知识检索（RAG）' };
    }
    try {
      await this.ragManager.rebuildIndex();
      const status = this.ragManager.getStatus();
      const configDir = this.app.vault.configDir;
      const indexPath = 'lingxi-harness/vector-index.json';
      const stats = status.stats;
      const msg = stats
        ? `索引已保存：${stats.totalFiles} 个文件，${stats.totalRecords} 条片段\n📁 ${indexPath}`
        : '索引重建完成';
      return { ok: true, message: msg, indexPath };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : '重建失败' };
    }
  }

  /**
   * 用 LLM 优化任务 Prompt
   * 把用户的简单描述变成结构化的执行指令
   */
  async enhanceTaskPrompt(name: string, description: string, schedule: string): Promise<string> {
    const s = getSettings();
    const resolved = this.providerRegistry.resolveModel(s.defaultTextModel);
    if (!resolved) return description;

    const { provider, model } = resolved;
    const scheduleLabel: Record<string, string> = {
      onOpen: '每次打开 Obsidian 时',
      daily: '每天',
      weekly: '每周',
    };

    try {
      const result = await provider.chatComplete([
        {
          role: 'system',
          content: '你是一个 AI 任务指令优化助手。将用户的简单描述转换成清晰、可执行的 AI 指令。要求：直接输出指令内容，不要解释，不要对话语气，不要加引号或格式标记。',
        },
        {
          role: 'user',
          content: `任务名称：${name}\n执行时机：${scheduleLabel[schedule] ?? schedule}\n用户描述：${description || name}\n\n请将以上信息转换为一条清晰的 AI 执行指令。指令要：1) 明确要求 AI 直接输出内容而非确认；2) 说明输出格式和长度；3) 简洁有效。`,
        },
      ], { model, temperature: 0.3 });
      return result.content.trim();
    } catch {
      return description;
    }
  }

  /**
   * 手动触发对话压缩（/compact 命令）
   */
  private triggerCompact(): void {
    const leaf = this.app.workspace.getLeavesOfType(CHAT_VIEWTYPE)[0];
    if (!leaf) {
      new Notice('请先打开聊天面板');
      return;
    }
    const chatView = leaf.view as unknown as ChatView;
    chatView.triggerCompact();
  }
}
