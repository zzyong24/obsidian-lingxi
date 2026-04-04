/**
 * 自动归档器
 * 将 AI 生成的内容保存为 Vault 中的 Markdown 文件
 */

import { ArchiveOptions, ArchiveResult, Skill } from '@/types';
import { localNow } from '@/utils/datetime';
import { App } from 'obsidian';

export class AutoArchiver {
  private app: App;
  private defaultFolder: string;
  private scenesFolder: string;

  constructor(app: App, defaultFolder: string, scenesFolder: string) {
    this.app = app;
    this.defaultFolder = defaultFolder;
    this.scenesFolder = scenesFolder;
  }

  /**
   * 归档内容到 Vault
   */
  async archive(options: ArchiveOptions): Promise<ArchiveResult> {
    const { content, skill, title, tags, type, folder: overrideFolder } = options;

    // 确定目标文件夹
    const folder = overrideFolder || this.resolveOutputFolder(skill);
    await this.ensureFolder(folder);

    // 从 AI 回复中提取第一行 # 标题
    const { aiTitle, bodyContent } = this.extractAITitle(content);

    // 确定最终标题
    const displayTitle = aiTitle
      || title
      || this.extractContentTitle(bodyContent)
      || (skill ? `${skill.name}：${this.extractKeywords(bodyContent)}` : this.extractKeywords(bodyContent));

    // 生成文件名（自动处理重名）
    const baseFileName = this.generateFileName(skill, displayTitle, bodyContent);
    const filePath = await this.resolveUniqueFilePath(folder, baseFileName);
    const fileName = filePath.split('/').pop() || baseFileName;

    // 生成 Frontmatter
    const frontmatter = this.buildFrontmatter(skill, tags, type);

    // 组装完整内容
    const fullContent = `${frontmatter}\n# ${displayTitle}\n\n${bodyContent}\n`;

    // 创建文件
    await this.app.vault.create(filePath, fullContent);

    return { filePath, fileName };
  }

  /**
   * 解析唯一文件路径：文件已存在时自动加 _2/_3 后缀
   */
  private async resolveUniqueFilePath(folder: string, fileName: string): Promise<string> {
    const base = fileName.replace(/\.md$/, '');
    let candidate = `${folder}/${fileName}`;
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = `${folder}/${base}_${counter}.md`;
      counter++;
    }
    return candidate;
  }

  /**
   * 从 AI 回复中提取第一行 # 标题
   * AI 被要求在回复第一行输出 # 标题，这里提取并返回剩余正文
   */
  private extractAITitle(content: string): { aiTitle: string | null; bodyContent: string } {
    const lines = content.split('\n');
    
    // 跳过开头的空行
    let startIdx = 0;
    while (startIdx < lines.length && !lines[startIdx].trim()) {
      startIdx++;
    }

    if (startIdx < lines.length) {
      const firstLine = lines[startIdx].trim();
      // 匹配 # 标题 格式（一级标题）
      const match = firstLine.match(/^#\s+(.+)/);
      if (match) {
        const aiTitle = match[1]
          .replace(/\*+/g, '')  // 去除加粗标记
          .replace(/\p{Extended_Pictographic}/gu, '')  // 去除 emoji
          .replace(/\u200d/g, '')  // 去除 ZWJ
          .replace(/\ufe0f/g, '')  // 去除 VS16
          .trim();
        if (aiTitle.length >= 2) {
          // 移除标题行和紧随的空行
          let bodyStartIdx = startIdx + 1;
          while (bodyStartIdx < lines.length && !lines[bodyStartIdx].trim()) {
            bodyStartIdx++;
          }
          const bodyContent = lines.slice(bodyStartIdx).join('\n').trim();
          return { aiTitle: aiTitle.slice(0, 30), bodyContent };
        }
      }
    }

    return { aiTitle: null, bodyContent: content };
  }

  /**
   * 解析归档输出目录
   * 
   * 目录解析规则：
   * 1. 有 Skill 且 Skill 有 output_folder → 场景名/output_folder
   * 2. 有 Skill 但无 output_folder → 场景名
   * 3. 无 Skill → 默认归档文件夹
   * 
   * 示例：
   *   场景「自媒体」+ Skill output_folder「选题管理」→ 自媒体/选题管理
   *   场景「知识学习」+ Skill output_folder「crafted/reflections」→ 知识学习/crafted/reflections
   */
  private resolveOutputFolder(skill?: Skill): string {
    if (skill) {
      // 场景名作为一级目录
      const sceneFolder = skill.sceneId;
      if (skill.outputFolder) {
        return `${sceneFolder}/${skill.outputFolder}`;
      }
      return sceneFolder;
    }

    // 无 Skill 时使用默认归档目录
    return this.defaultFolder;
  }

  /**
   * 确保文件夹存在（支持多级目录递归创建）
   */
  private async ensureFolder(folderPath: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(folderPath);
    if (!existing) {
      // 递归创建多级目录
      const parts = folderPath.split('/');
      let current = '';
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        const folder = this.app.vault.getAbstractFileByPath(current);
        if (!folder) {
          await this.app.vault.createFolder(current);
        }
      }
    }
  }

  /**
   * 生成文件名: YYYYMMDD_{Skill名称}_{标题}.md
   * 注意：title 参数由 archive() 方法已确定好（AI标题 > 手动标题 > 正则提取 > 关键词兜底）
   */
  private generateFileName(skill?: Skill, title?: string, _content?: string): string {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');

    const skillPart = skill ? `_${skill.name}` : '';
    const titlePart = title || '未命名';

    // 清理非法字符
    const cleanName = `${dateStr}${skillPart}_${titlePart}`
      .replace(/[/:*?"<>|\n\r]/g, '_')
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
          .replace(/（[^）]*URL[^）]*）/g, '')  // 去除含 URL 的中文括号
          .replace(/\([^)]*http[^)]*\)/g, '')     // 去除含 URL 的英文括号
          .replace(new RegExp('https?://\\S+', 'g'), '')       // 去除裸 URL
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

      const headingMatch = trimmed.match(/^#{1,6}\s+(?:\p{Extended_Pictographic}(?:\u200d|\ufe0f)*\s*)?(.+)/u);
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
        .replace(/\p{Extended_Pictographic}/gu, '')
        .replace(/\u200d/g, '')
        .replace(/\ufe0f/g, '')
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
   * 构建统一 Frontmatter（7 必填字段，兼容 Dataview）
   * type / topic / created / modified / tags / origin / source / status
   */
  private buildFrontmatter(skill?: Skill, tags?: string[], extraType?: string): string {
    const now = localNow();
    const type = extraType || 'note';
    const topic = skill?.category?.toLowerCase().replace(/\s+/g, '-') || skill?.sceneId || 'general';

    /** 清洗单个 tag：空格→连字符，去除非法字符 */
    const cleanTag = (t: string) =>
      t.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '').slice(0, 30);

    const allTags = [
      type,
      cleanTag(topic),
      'lingxi',
      ...(skill?.triggerKeywords?.slice(0, 2).map(cleanTag) || []),
      ...(tags?.map(cleanTag) || []),
    ].filter(Boolean);

    // 去重
    const uniqueTags = [...new Set(allTags)];
    const tagStr = uniqueTags.map(t => `"${t}"`).join(', ');

    return `---
type: "${type}"
topic: "${cleanTag(topic)}"
created: "${now}"
modified: "${now}"
tags: [${tagStr}]
origin: "crafted"
source: "lingxi"
status: "active"${skill ? `\nskill: "${skill.name}"` : ''}
---\n`;
  }
}
