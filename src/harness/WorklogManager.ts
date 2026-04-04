/**
 * WorklogManager — 工作日志管理器
 * 对话结束后自动追加当日日志条目到 lingxi-harness/worklog/YYYY/MM/YYYY-MM-DD.md
 * 用户零感知，周报任务可直接扫描 worklog 目录
 */

import { App } from 'obsidian';
import { ChatMessage, AIChatSettings } from '@/types';
import { localNow } from '@/utils/datetime';

const WORKLOG_BASE = 'lingxi-harness/worklog';

export class WorklogManager {
  private app: App;
  private settings: AIChatSettings;

  constructor(app: App, settings: AIChatSettings) {
    this.app = app;
    this.settings = settings;
  }

  updateSettings(settings: AIChatSettings): void {
    this.settings = settings;
  }

  /**
   * 对话结束后调用，将本次对话摘要追加到今日 worklog
   * @param messages 完整对话消息列表
   * @param conversationTitle 对话标题（取首条用户消息前 20 字）
   */
  async appendConversation(messages: ChatMessage[], conversationTitle: string): Promise<void> {
    if (!this.settings.harnessEnabled) return;

    // 过滤出有意义的消息（至少一来一回）
    const meaningful = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    if (meaningful.length < 2) return;

    try {
      const filePath = this.getTodayFilePath();
      await this.ensureFile(filePath);

      // 生成条目：时间戳 + 对话标题 + 轮次数
      const now = localNow();
      const turns = Math.floor(meaningful.length / 2);
      const firstUserMsg = messages.find(m => m.role === 'user');
      const preview = firstUserMsg
        ? (typeof firstUserMsg.content === 'string'
          ? firstUserMsg.content
          : firstUserMsg.content.map((p: { text?: string }) => p.text || '').join(''))
          .slice(0, 60).replace(/\n/g, ' ')
        : '';

      const entry = `\n## ${now.slice(11, 16)} · ${conversationTitle}\n\n- 轮次：${turns} 轮\n- 内容预览：${preview}${preview.length >= 60 ? '…' : ''}\n`;

      const current = await this.app.vault.adapter.read(filePath);
      await this.app.vault.adapter.write(filePath, current + entry);
    } catch (error) {
      console.error('[Lingxi Worklog] 写入失败:', error);
    }
  }

  /**
   * 读取最近 N 天的 worklog 内容（供周报任务使用）
   */
  async getRecentLogs(days: number = 7): Promise<string> {
    const parts: string[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const filePath = this.getFilePath(d);

      try {
        const exists = await this.app.vault.adapter.exists(filePath);
        if (!exists) continue;
        const content = await this.app.vault.adapter.read(filePath);
        if (content.trim()) parts.push(content);
      } catch {
        // 文件不存在或读取失败，跳过
      }
    }

    return parts.join('\n\n---\n\n');
  }

  // ==================== 内部方法 ====================

  private getTodayFilePath(): string {
    return this.getFilePath(new Date());
  }

  private getFilePath(d: Date): string {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekDay = weekDays[d.getDay()];
    return `${WORKLOG_BASE}/${year}/${month}/${year}-${month}-${day}-${weekDay}.md`;
  }

  private async ensureFile(filePath: string): Promise<void> {
    const exists = await this.app.vault.adapter.exists(filePath);
    if (exists) return;

    // 确保目录链路存在
    const parts = filePath.split('/');
    parts.pop(); // 去掉文件名
    let dir = '';
    for (const part of parts) {
      dir = dir ? `${dir}/${part}` : part;
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }
    }

    // 创建今日日志文件，写入标准 Frontmatter + 标题
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const now = localNow();
    const header = `---
type: "worklog"
topic: "work"
created: "${now}"
modified: "${now}"
tags: ["worklog", "lingxi", "lingxi-system"]
origin: "crafted"
source: "lingxi-system"
status: "active"
---

# 工作日志 · ${dateStr}

`;
    await this.app.vault.adapter.write(filePath, header);
  }
}
