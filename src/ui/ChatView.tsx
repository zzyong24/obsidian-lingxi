/**
 * ChatView - Obsidian 侧边栏视图
 * 参考 copilot 的 CopilotView 实现，注册为侧边栏 Panel
 */

import { CHAT_VIEWTYPE, PLUGIN_DISPLAY_NAME } from '@/constants';
import { Chat } from '@/ui/Chat';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import type AIChatPlugin from '@/main';

export default class ChatView extends ItemView {
  private root: Root | null = null;
  private plugin: AIChatPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: AIChatPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return CHAT_VIEWTYPE;
  }

  getIcon(): string {
    return 'message-square';
  }

  getTitle(): string {
    return `${PLUGIN_DISPLAY_NAME} Chat`;
  }

  getDisplayText(): string {
    return PLUGIN_DISPLAY_NAME;
  }

  async onOpen(): Promise<void> {
    this.root = createRoot(this.containerEl.children[1]);
    this.renderView();
  }

  private renderView(): void {
    if (!this.root) return;

    this.root.render(
      <Chat
        app={this.app}
        providerRegistry={this.plugin.providerRegistry}
        sceneManager={this.plugin.sceneManager}
        archiver={this.plugin.archiver}
        conversationManager={this.plugin.conversationManager}
        onNewChat={() => {
          // 新建对话时的回调
        }}
      />
    );
  }

  updateView(): void {
    this.renderView();
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
