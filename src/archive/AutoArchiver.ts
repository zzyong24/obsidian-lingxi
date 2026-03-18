/**
 * 自动归档器
 * 将 AI 生成的内容保存为 Vault 中的 Markdown 文件
 */

import { ArchiveOptions, ArchiveResult, Skill } from '@/types';
import { App, TFolder } from 'obsidian';

export class AutoArchiver {
  private app: App;
  private defaultFolder: string;

  constructor(app: App, defaultFolder: string) {
    this.app = app;
    this.defaultFolder = defaultFolder;
  }

  /**
   * 归档内容到 Vault
   */
  async archive(options: ArchiveOptions): Promise<ArchiveResult> {
    const { content, skill, title, tags } = options;

    // 确定目标文件夹
    const folder = skill?.outputFolder || this.defaultFolder;
    await this.ensureFolder(folder);

    // 生成文件名
    const fileName = this.generateFileName(skill, title, content);
    const filePath = `${folder}/${fileName}`;

    // 生成 Frontmatter
    const frontmatter = this.buildFrontmatter(skill, tags);

    // 生成文件标题（优先从内容中提取有意义的标题）
    const contentTitle = this.extractContentTitle(content);
    const displayTitle = title || (skill 
      ? `${skill.name}：${contentTitle || this.extractKeywords(content)}` 
      : contentTitle || this.extractKeywords(content));

    // 组装完整内容
    const fullContent = `${frontmatter}\n# ${displayTitle}\n\n${content}\n`;

    // 创建文件
    await this.app.vault.create(filePath, fullContent);

    return { filePath, fileName };
  }

  /**
   * 确保文件夹存在
   */
  private async ensureFolder(folderPath: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(folderPath);
    if (!existing) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  /**
   * 生成文件名: YYYYMMDD_{Skill名称}_{内容标题}.md
   */
  private generateFileName(skill?: Skill, title?: string, content?: string): string {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');

    const skillPart = skill ? `_${skill.name}` : '';
    const keywordPart = title || this.extractContentTitle(content || '') || this.extractKeywords(content || '');

    // 清理非法字符
    const cleanName = `${dateStr}${skillPart}_${keywordPart}`
      .replace(/[\/:*?"<>|\n\r]/g, '_')
      .replace(/_+/g, '_')  // 合并连续下划线
      .replace(/_$/, '')     // 去除末尾下划线
      .slice(0, 100);

    return `${cleanName}.md`;
  }

  /**
   * 从 AI 输出内容中提取真正的内容标题
   * 跳过场景提示块（> 开头的引用）和分割线（---）
   * 策略：优先找具体描述（**选题**：xxx / **反思主题**：xxx），其次用第一个标题
   */
  private extractContentTitle(content: string): string | null {
    const lines = content.split('\n');

    // 需要跳过的标签名（场景提示中的标签）
    const skipLabels = ['场景', 'Skill', 'Rules', 'skill', 'rules'];

    // 第一遍：找具体的内容描述标签（**选题**：xxx、**反思主题**：xxx、**来源**：xxx 等）
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('>') || trimmed === '---') continue;

      const boldMatch = trimmed.match(/^\*\*(.+?)\*\*[：:]\s*(.+)/);
      if (boldMatch) {
        const label = boldMatch[1].trim();
        if (skipLabels.includes(label)) continue;

        let value = boldMatch[2]
          .replace(/\（[^）]*URL[^）]*\）/g, '')  // 去除含 URL 的中文括号
          .replace(/\([^)]*http[^)]*\)/g, '')     // 去除含 URL 的英文括号
          .replace(/https?:\/\/\S+/g, '')          // 去除裸 URL
          .replace(/\*+/g, '')
          .trim();
        if (value.length >= 2) {
          return value.slice(0, 30);
        }
      }
    }

    // 第二遍：退回用第一个 Markdown 标题
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('>') || trimmed === '---') continue;

      const headingMatch = trimmed.match(/^#{1,6}\s+(?:[\p{Emoji}\u200d\ufe0f]+\s*)?(.+)/u);
      if (headingMatch) {
        const title = headingMatch[1]
          .replace(/\*+/g, '')
          .trim();
        if (title.length >= 2) {
          return title.slice(0, 30);
        }
      }
    }

    return null;
  }

  /**
   * 兜底：从内容中提取前几个字作为关键词（跳过场景提示块）
   */
  private extractKeywords(content: string): string {
    const lines = content.split('\n');
    const meaningfulLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // 跳过空行、引用块、分割线、标题标记
      if (!trimmed || trimmed.startsWith('>') || trimmed === '---') {
        continue;
      }
      // 清理 Markdown 标记
      const clean = trimmed
        .replace(/^#+\s*/, '')
        .replace(/\*+/g, '')
        .replace(/[\p{Emoji}\u200d\ufe0f]/gu, '')
        .trim();
      if (clean.length >= 2) {
        meaningfulLines.push(clean);
        break;
      }
    }

    const text = meaningfulLines.join(' ');
    return text.slice(0, 20) + (text.length > 20 ? '...' : '') || '未命名';
  }

  /**
   * 构建 Frontmatter
   */
  private buildFrontmatter(skill?: Skill, tags?: string[]): string {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const allTags = [
      ...(skill?.triggerKeywords?.slice(0, 3) || []),
      ...(skill?.category ? [skill.category] : []),
      ...(tags || []),
    ];

    const tagStr = allTags.length > 0
      ? `\ntags: [${allTags.map(t => `"${t}"`).join(', ')}]`
      : '';

    return `---
created: "${now}"${skill ? `\nskill: ${skill.name}` : ''}
source: ai-chat-plugin${tagStr}
---\n`;
  }
}
