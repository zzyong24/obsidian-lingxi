/**
 * 设置页面 - Obsidian PluginSettingTab 实现
 * 参考 copilot 的 SettingsPage.tsx
 */

import { App, PluginSettingTab } from 'obsidian';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SettingsPanel } from '@/ui/SettingsPanel';
import type AIChatPlugin from '@/main';

export class AIChatSettingTab extends PluginSettingTab {
  plugin: AIChatPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: AIChatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const div = containerEl.createDiv('ai-chat-settings-container');
    this.root = createRoot(div);

    this.root.render(
      <SettingsPanel
        settings={this.plugin.getSettings()}
        onSettingsChange={(settings) => { void this.plugin.savePluginSettings(settings); }}
        onTestConnection={(providerId) => this.plugin.testProviderConnection(providerId)}
      />
    );
  }

  hide(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
