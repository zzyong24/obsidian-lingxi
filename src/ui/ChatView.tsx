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
        memoryManager={this.plugin.memoryManager}
        contextBuilder={this.plugin.contextBuilder}
        compactionEngine={this.plugin.compactionEngine}
        worklogManager={this.plugin.worklogManager}
        contentFetcher={this.plugin.contentFetcher}
        onNewChat={() => {
          // 新建对话时的回调
        }}
      />
    );
  }

  updateView(): void {
    this.renderView();
  }

  /**
   * 触发对话压缩（由 main.ts 的 /compact 命令调用）
   */
  triggerCompact(): void {
    // 通过自定义事件通知 Chat 组件
    const event = new CustomEvent('lingxi-compact');
    this.containerEl.dispatchEvent(event);
  }

  onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    return Promise.resolve();
  }
}
