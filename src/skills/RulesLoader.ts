/**
 * Rules 加载器
 * 扫描 _rules/ 文件夹，读取所有 .md 文件的正文内容，
 * 注入到每次对话的 System Prompt 最前面
 */

import { App, TFile, TFolder } from 'obsidian';

export class RulesLoader {
  private rulesContent: string = '';
  private app: App;
  private rulesFolder: string;

  constructor(app: App, rulesFolder: string) {
    this.app = app;
    this.rulesFolder = rulesFolder;
  }

  /**
   * 初始化：扫描 Rules 文件夹
   */
  async initialize(): Promise<void> {
    await this.loadRules();
    this.watchForChanges();
  }

  /**
   * 加载所有 Rules
   */
  async loadRules(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(this.rulesFolder);
    if (!folder || !(folder instanceof TFolder)) {
      console.log(`[AI Chat] Rules 文件夹不存在: ${this.rulesFolder}`);
      this.rulesContent = '';
      return;
    }

    const contents: string[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        try {
          const content = await this.app.vault.read(child);
          // 去除 Frontmatter
          const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
          if (body) {
            contents.push(body);
          }
        } catch (error) {
          console.error(`[AI Chat] 加载 Rule 失败: ${child.path}`, error);
        }
      }
    }

    this.rulesContent = contents.join('\n\n');
    console.log(`[AI Chat] 已加载 ${contents.length} 条 Rules`);
  }

  /**
   * 监听文件变更
   */
  private watchForChanges(): void {
    const reload = async (file: unknown) => {
      if (file instanceof TFile && file.path.startsWith(this.rulesFolder)) {
        await this.loadRules();
      }
    };

    this.app.vault.on('modify', reload);
    this.app.vault.on('create', reload);
    this.app.vault.on('delete', reload);
  }

  /**
   * 获取全部 Rules 内容
   */
  getRules(): string {
    return this.rulesContent;
  }
}
