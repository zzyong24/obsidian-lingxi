/**
 * ChatView - Obsidian 侧边栏视图
 * 参考 copilot 的 CopilotView 实现，注册为侧边栏 Panel
 */

import { CHAT_VIEWTYPE } from '@/constants';
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
    return 'Lingxi';
  }

  getDisplayText(): string {
    return 'Lingxi';
  }

  onOpen(): Promise<void> {
    this.root = createRoot(this.containerEl.children[1]);
    this.renderView();
    return Promise.resolve();
  }

  private renderView(): void {
    if (!this.root) return;

    this.root.render(
      <Chat
        app={this.app}
        providerRegistry={this.plugin.providerRegistry}
        sceneManager={this.plugin.sceneManager}
        archiver={this.plugin.archiver}
        ragManager={this.plugin.ragManager}
        conversationManager={this.plugin.conversationManager}
        toolCallHandler={this.plugin.toolCallHandler}
        onNewChat={() => {
          // 新建对话时的回调
        }}
      />
    );
  }

  updateView(): void {
    this.renderView();
  }

  onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    return Promise.resolve();
  }
}
