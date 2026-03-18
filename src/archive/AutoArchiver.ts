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

    // 生成文件标题
    const displayTitle = title || (skill ? `${skill.name}：${this.extractKeywords(content)}` : this.extractKeywords(content));

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
   * 生成文件名: YYYYMMDD_{Skill名称}_{关键词}.md
   */
  private generateFileName(skill?: Skill, title?: string, content?: string): string {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');

    const skillPart = skill ? `_${skill.name}` : '';
    const keywordPart = title || this.extractKeywords(content || '');

    // 清理非法字符
    const cleanName = `${dateStr}${skillPart}_${keywordPart}`
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 100);

    return `${cleanName}.md`;
  }

  /**
   * 从内容中提取前几个字作为关键词
   */
  private extractKeywords(content: string): string {
    // 去除 Markdown 标记，取前15个字
    const clean = content
      .replace(/^#+\s*/gm, '')
      .replace(/\*+/g, '')
      .replace(/\n/g, ' ')
      .trim();
    return clean.slice(0, 15) + (clean.length > 15 ? '...' : '');
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
