/**
 * Skill 管理器
 * 负责扫描、解析、缓存 Skill 文件，支持热更新
 */

import { Skill } from '@/types';
import { App, TFile, TFolder, Vault } from 'obsidian';

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private app: App;
  private skillsFolder: string;

  constructor(app: App, skillsFolder: string) {
    this.app = app;
    this.skillsFolder = skillsFolder;
  }

  /**
   * 初始化：扫描 Skill 文件夹
   */
  async initialize(): Promise<void> {
    await this.scanSkills();
    this.watchForChanges();
  }

  /**
   * 扫描 _skills/ 文件夹，递归加载所有 .md 文件
   */
  async scanSkills(): Promise<void> {
    this.skills.clear();
    const folder = this.app.vault.getAbstractFileByPath(this.skillsFolder);
    if (!folder || !(folder instanceof TFolder)) {
      console.log(`[AI Chat] Skill 文件夹不存在: ${this.skillsFolder}`);
      return;
    }
    await this.scanFolder(folder);
    console.log(`[AI Chat] 已加载 ${this.skills.size} 个 Skill`);
  }

  /**
   * 递归扫描文件夹
   */
  private async scanFolder(folder: TFolder): Promise<void> {
    for (const child of folder.children) {
      if (child instanceof TFolder) {
        await this.scanFolder(child);
      } else if (child instanceof TFile && child.extension === 'md') {
        await this.loadSkill(child);
      }
    }
  }

  /**
   * 从 .md 文件加载 Skill
   */
  private async loadSkill(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const skill = this.parseSkillFile(content, file);
      if (skill) {
        this.skills.set(skill.id, skill);
      }
    } catch (error) {
      console.error(`[AI Chat] 加载 Skill 失败: ${file.path}`, error);
    }
  }

  /**
   * 解析 Skill 文件内容
   */
  private parseSkillFile(content: string, file: TFile): Skill | null {
    // 解析 Frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
    const body = content.slice(frontmatterMatch[0].length);

    // 提取 System Prompt
    const systemPrompt = this.extractSection(body, 'System Prompt');
    if (!systemPrompt) return null;

    // 提取输出格式（可选）
    const outputFormat = this.extractSection(body, '输出格式') || undefined;

    // 解析 trigger_keywords（支持 YAML 数组格式）
    let triggerKeywords: string[] = [];
    if (frontmatter.trigger_keywords) {
      if (typeof frontmatter.trigger_keywords === 'string') {
        triggerKeywords = frontmatter.trigger_keywords.split(',').map((k: string) => k.trim());
      } else if (Array.isArray(frontmatter.trigger_keywords)) {
        triggerKeywords = frontmatter.trigger_keywords;
      }
    }

    return {
      id: file.basename,
      name: (frontmatter.name as string) || file.basename,
      description: (frontmatter.description as string) || '',
      triggerKeywords,
      category: (frontmatter.category as string) || '未分类',
      outputFolder: (frontmatter.output_folder as string) || '',
      outputTemplate: ((frontmatter.output_template as string) || 'note') as 'card' | 'note' | 'raw',
      modelPreference: ((frontmatter.model_preference as string) || 'any') as 'text' | 'vision' | 'any',
      systemPrompt,
      outputFormat,
      filePath: file.path,
      sceneId: '',
    };
  }

  /**
   * 简单的 YAML Frontmatter 解析
   */
  private parseFrontmatter(raw: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = raw.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (!match) continue;

      const [, key, value] = match;
      // 处理 YAML 数组格式: ["a", "b"]
      if (value.startsWith('[')) {
        try {
          result[key] = JSON.parse(value.replace(/'/g, '"'));
        } catch {
          result[key] = value;
        }
      } else {
        // 去除引号
        result[key] = value.replace(/^["']|["']$/g, '');
      }
    }

    return result;
  }

  /**
   * 提取 Markdown 中指定 ## 标题下的内容
   */
  private extractSection(body: string, sectionTitle: string): string | null {
    const regex = new RegExp(`## ${sectionTitle}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
    const match = body.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * 监听文件变更，热更新 Skill
   */
  private watchForChanges(): void {
    this.app.vault.on('modify', async (file) => {
      if (file instanceof TFile && file.path.startsWith(this.skillsFolder)) {
        await this.loadSkill(file);
      }
    });

    this.app.vault.on('create', async (file) => {
      if (file instanceof TFile && file.path.startsWith(this.skillsFolder) && file.extension === 'md') {
        await this.loadSkill(file);
      }
    });

    this.app.vault.on('delete', (file) => {
      if (file instanceof TFile && file.path.startsWith(this.skillsFolder)) {
        this.skills.delete(file.basename);
      }
    });

    this.app.vault.on('rename', async (file, oldPath) => {
      if (oldPath.startsWith(this.skillsFolder)) {
        // 删除旧的
        const oldBasename = oldPath.split('/').pop()?.replace('.md', '') || '';
        this.skills.delete(oldBasename);
      }
      if (file instanceof TFile && file.path.startsWith(this.skillsFolder) && file.extension === 'md') {
        await this.loadSkill(file);
      }
    });
  }

  /**
   * 获取所有 Skill 列表
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 按分类获取 Skill
   */
  getSkillsByCategory(): Map<string, Skill[]> {
    const categoryMap = new Map<string, Skill[]>();
    for (const skill of this.skills.values()) {
      const list = categoryMap.get(skill.category) || [];
      list.push(skill);
      categoryMap.set(skill.category, list);
    }
    return categoryMap;
  }

  /**
   * 根据 ID 获取 Skill
   */
  getById(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  /**
   * 关键词匹配 Skill
   */
  matchByKeywords(text: string): Skill | null {
    for (const skill of this.skills.values()) {
      for (const keyword of skill.triggerKeywords) {
        if (text.includes(keyword)) {
          return skill;
        }
      }
    }
    return null;
  }

  /**
   * 模糊搜索 Skill（用于 / 命令面板）
   */
  search(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSkills().filter(skill =>
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 将 Skill 转为 Function Calling 的 Tool 定义
   */
  skillToToolDefinition(skill: Skill): { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } } {
    return {
      type: 'function',
      function: {
        name: skill.id,
        description: skill.description,
        parameters: {
          type: 'object',
          properties: {
            user_input: {
              type: 'string',
              description: '用户的输入内容',
            },
          },
          required: ['user_input'],
        },
      },
    };
  }
}
