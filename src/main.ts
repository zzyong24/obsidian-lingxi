/**
 * 插件入口 main.ts
 * 参考 copilot 的 main.ts 架构
 */

import { CHAT_VIEWTYPE, PLUGIN_DISPLAY_NAME } from '@/constants';
import { AIChatSettings, DEFAULT_SETTINGS } from '@/types';
import { getSettings, setSettings, sanitizeSettings, updateSettings } from '@/settings';
import { ProviderRegistry } from '@/providers';
import { SceneManager } from '@/skills';
import { AutoArchiver } from '@/archive/AutoArchiver';
import { ConversationManager } from '@/conversation/ConversationManager';
import { RAGManager } from '@/search/RAGManager';
import ChatView from '@/ui/ChatView';
import { AIChatSettingTab } from '@/ui/SettingsTab';
import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';

export default class AIChatPlugin extends Plugin {
  // 核心组件
  providerRegistry: ProviderRegistry;
  sceneManager: SceneManager;
  archiver: AutoArchiver;
  conversationManager: ConversationManager;
  ragManager: RAGManager;

  async onload(): Promise<void> {
    console.log(`[AI Chat] 加载插件 v${this.manifest.version}`);

    // 加载设置
    await this.loadPluginSettings();

    const settings = getSettings();

    // 初始化核心组件
    this.providerRegistry = new ProviderRegistry();
    this.providerRegistry.initialize(settings);

    this.sceneManager = new SceneManager(this.app, settings.scenesFolder);
    this.archiver = new AutoArchiver(this.app, settings.defaultArchiveFolder, settings.scenesFolder);
    this.conversationManager = new ConversationManager(settings.maxContextMessages);
    this.ragManager = new RAGManager(this.app, settings);

    // 注册聊天视图
    this.registerView(
      CHAT_VIEWTYPE,
      (leaf: WorkspaceLeaf) => new ChatView(leaf, this)
    );

    // 注册设置页面
    this.addSettingTab(new AIChatSettingTab(this.app, this));

    // 添加左侧 Ribbon 图标
    this.addRibbonIcon('message-square', `打开 ${PLUGIN_DISPLAY_NAME}`, () => {
      this.activateView();
    });

    // 注册命令
    this.addCommand({
      id: 'open-ai-chat',
      name: `打开 ${PLUGIN_DISPLAY_NAME}`,
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'new-ai-chat',
      name: '新建 AI 对话',
      callback: () => this.newChat(),
    });

    // 在 layout ready 后初始化场景管理器和 RAG
    this.app.workspace.onLayoutReady(async () => {
      await this.sceneManager.initialize();
      await this.ragManager.initialize();
    });
  }

  async onunload(): Promise<void> {
    console.log('[AI Chat] 卸载插件');
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
      this.app.workspace.revealLeaf(existingLeaves[0]);
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
      (leaf.view as ChatView).updateView();
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
  }

  /**
   * 获取当前设置
   */
  getSettings(): AIChatSettings {
    return { ...getSettings() };
  }

  /**
   * 测试提供商连接
   */
  async testProviderConnection(providerId: string): Promise<boolean> {
    const provider = this.providerRegistry.getProvider(providerId);
    if (!provider) {
      new Notice('未找到该提供商，请确认 API Key 已配置');
      return false;
    }
    try {
      const result = await provider.testConnection();
      if (result) {
        new Notice('✅ 连接成功！');
      } else {
        new Notice('❌ 连接失败，请检查 API Key 和 Base URL');
      }
      return result;
    } catch (error) {
      new Notice(`❌ 连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }
}
