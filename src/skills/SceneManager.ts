/**
 * 场景管理器（Scene Manager）
 * 负责扫描场景文件夹、加载场景/Skill/Rules，支持热更新
 * 
 * 目录结构约定：
 * skills-scenes/                   # scenesFolder（可配置）
 * ├── _global_rules/               # 全局 Rules
 * ├── _scenes_index.md             # 场景索引（加载到全局 Rule）
 * ├── 自媒体/                      # 场景文件夹
 * │   ├── _scene.md                # 场景描述索引
 * │   ├── _rules/                  # 场景级 Rules
 * │   └── _skills/                 # 场景级 Skills
 * └── 学习/                        # 另一个场景
 *     ├── _scene.md
 *     ├── _rules/
 *     └── _skills/
 */

import { Scene, Skill } from '@/types';
import { App, TFile, TFolder } from 'obsidian';

export class SceneManager {
  private scenes: Map<string, Scene> = new Map();
  private globalRulesContent: string = '';
  private sceneIndexContent: string = '';
  private onScanCompleteCallbacks: (() => void)[] = [];
  private app: App;
  private scenesFolder: string;

  constructor(app: App, scenesFolder: string) {
    this.app = app;
    this.scenesFolder = scenesFolder;
  }

  /**
   * 初始化：扫描场景文件夹
   */
  async initialize(): Promise<void> {
    await this.fullScan();
    this.watchForChanges();
  }

  /**
   * 全量扫描
   */
  async fullScan(): Promise<void> {
    this.scenes.clear();
    this.globalRulesContent = '';
    this.sceneIndexContent = '';

    const rootFolder = this.app.vault.getAbstractFileByPath(this.scenesFolder);
    if (!rootFolder || !(rootFolder instanceof TFolder)) {
      console.debug(`[AI Chat] 场景根文件夹不存在: ${this.scenesFolder}`);
      return;
    }

    // 1. 加载全局 Rules
    await this.loadGlobalRules(rootFolder);

    // 2. 加载场景索引
    await this.loadSceneIndex(rootFolder);

    // 3. 扫描每个场景文件夹
    for (const child of rootFolder.children) {
      if (child instanceof TFolder && !child.name.startsWith('_')) {
        await this.loadScene(child);
      }
    }

    console.debug(`[AI Chat] 已加载 ${this.scenes.size} 个场景，共 ${this.getAllSkills().length} 个 Skill`);

    // 通知订阅者扫描完成（用于热更新时同步归档映射等）
    for (const cb of this.onScanCompleteCallbacks) {
      try { cb(); } catch (e) { console.error('[AI Chat] onScanComplete 回调异常:', e); }
    }
  }

  /**
   * 加载全局 Rules（_global_rules/ 文件夹）
   */
  private async loadGlobalRules(rootFolder: TFolder): Promise<void> {
    const globalRulesFolder = rootFolder.children.find(
      (c): c is TFolder => c instanceof TFolder && c.name === '_global_rules'
    );

    if (!globalRulesFolder) {
      this.globalRulesContent = '';
      return;
    }

    const contents: string[] = [];
    for (const child of globalRulesFolder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        try {
          const content = await this.app.vault.read(child);
          const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
          if (body) contents.push(body);
        } catch (error) {
          console.error(`[AI Chat] 加载全局 Rule 失败: ${child.path}`, error);
        }
      }
    }

    this.globalRulesContent = contents.join('\n\n');
    console.debug(`[AI Chat] 已加载 ${contents.length} 条全局 Rules`);
  }

  /**
   * 加载场景索引文件（_scenes_index.md）
   */
  private async loadSceneIndex(rootFolder: TFolder): Promise<void> {
    const indexFile = rootFolder.children.find(
      (c): c is TFile => c instanceof TFile && c.name === '_scenes_index.md'
    );

    if (!indexFile) {
      this.sceneIndexContent = '';
      return;
    }

    try {
      const content = await this.app.vault.read(indexFile);
      this.sceneIndexContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
      console.debug(`[AI Chat] 已加载场景索引`);
    } catch (error) {
      console.error(`[AI Chat] 加载场景索引失败:`, error);
    }
  }

  /**
   * 加载单个场景
   */
  private async loadScene(folder: TFolder): Promise<void> {
    const sceneId = folder.name;

    // 1. 读取 _scene.md
    let sceneName = sceneId;
    let sceneDescription = '';
    let sceneKeywords: string[] = [];
    let sceneIcon = '';
    let scenePrompt = '';

    const sceneFile = folder.children.find(
      (c): c is TFile => c instanceof TFile && c.name === '_scene.md'
    );

    if (sceneFile) {
      try {
        const content = await this.app.vault.read(sceneFile);
        const frontmatter = this.parseFrontmatter(content);
        sceneName = (frontmatter.name as string) || sceneId;
        sceneDescription = (frontmatter.description as string) || '';
        sceneIcon = (frontmatter.icon as string) || '';

        if (frontmatter.trigger_keywords) {
          if (typeof frontmatter.trigger_keywords === 'string') {
            sceneKeywords = (frontmatter.trigger_keywords as string).split(',').map(k => k.trim());
          } else if (Array.isArray(frontmatter.trigger_keywords)) {
            sceneKeywords = frontmatter.trigger_keywords as string[];
          }
        }

        scenePrompt = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
      } catch (error) {
        console.error(`[AI Chat] 加载场景描述失败: ${sceneFile.path}`, error);
      }
    }

    // 2. 读取场景级 _rules/
    let rulesContent = '';
    const rulesFolder = folder.children.find(
      (c): c is TFolder => c instanceof TFolder && c.name === '_rules'
    );

    if (rulesFolder) {
      const ruleContents: string[] = [];
      for (const child of rulesFolder.children) {
        if (child instanceof TFile && child.extension === 'md') {
          try {
            const content = await this.app.vault.read(child);
            const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
            if (body) ruleContents.push(body);
          } catch (error) {
            console.error(`[AI Chat] 加载场景 Rule 失败: ${child.path}`, error);
          }
        }
      }
      rulesContent = ruleContents.join('\n\n');
    }

    // 3. 扫描场景级 _skills/
    const skills: Skill[] = [];
    const skillsFolder = folder.children.find(
      (c): c is TFolder => c instanceof TFolder && c.name === '_skills'
    );

    if (skillsFolder) {
      await this.scanSkillsFolder(skillsFolder, sceneId, skills);
    }

    // 4. 构建 Scene 对象
    const scene: Scene = {
      id: sceneId,
      name: sceneName,
      description: sceneDescription,
      triggerKeywords: sceneKeywords,
      icon: sceneIcon,
      scenePrompt,
      rulesContent,
      skills,
      folderPath: folder.path,
    };

    this.scenes.set(sceneId, scene);
    console.debug(`[AI Chat] 场景「${sceneIcon} ${sceneName}」加载了 ${skills.length} 个 Skill`);
  }

  /**
   * 递归扫描 _skills/ 文件夹
   */
  private async scanSkillsFolder(folder: TFolder, sceneId: string, skills: Skill[]): Promise<void> {
    for (const child of folder.children) {
      if (child instanceof TFolder) {
        await this.scanSkillsFolder(child, sceneId, skills);
      } else if (child instanceof TFile && child.extension === 'md') {
        const skill = await this.loadSkillFile(child, sceneId);
        if (skill) skills.push(skill);
      }
    }
  }

  /**
   * 从 .md 文件加载 Skill
   */
  private async loadSkillFile(file: TFile, sceneId: string): Promise<Skill | null> {
    try {
      const content = await this.app.vault.read(file);
      return this.parseSkillFile(content, file, sceneId);
    } catch (error) {
      console.error(`[AI Chat] 加载 Skill 失败: ${file.path}`, error);
      return null;
    }
  }

  /**
   * 解析 Skill 文件内容
   */
  private parseSkillFile(content: string, file: TFile, sceneId: string): Skill | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = this.parseFrontmatter(content);
    const body = content.slice(frontmatterMatch[0].length);

    const systemPrompt = this.extractSection(body, 'System Prompt');
    if (!systemPrompt) return null;

    const outputFormat = this.extractSection(body, '输出格式') || undefined;

    let triggerKeywords: string[] = [];
    if (frontmatter.trigger_keywords) {
      if (typeof frontmatter.trigger_keywords === 'string') {
        triggerKeywords = (frontmatter.trigger_keywords as string).split(',').map(k => k.trim());
      } else if (Array.isArray(frontmatter.trigger_keywords)) {
        triggerKeywords = frontmatter.trigger_keywords as string[];
      }
    }

    return {
      id: `${sceneId}/${file.basename}`,
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
      sceneId,
    };
  }

  /**
   * 简单的 YAML Frontmatter 解析
   */
  private parseFrontmatter(raw: string): Record<string, unknown> {
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const result: Record<string, unknown> = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const lineMatch = line.match(/^(\w+):\s*(.*)$/);
      if (!lineMatch) continue;

      const [, key, value] = lineMatch;
      if (value.startsWith('[')) {
        try {
          result[key] = JSON.parse(value.replace(/'/g, '"'));
        } catch {
          result[key] = value;
        }
      } else {
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
   * 监听文件变更，热更新
   */
  private watchForChanges(): void {
    const shouldReload = (path: string) => path.startsWith(this.scenesFolder);

    // 任何变更都触发全量重扫（简单可靠）
    const debouncedReload = this.debounce(() => {
      console.debug(`[AI Chat] 检测到场景文件变更，重新扫描...`);
      void this.fullScan();
    }, 500);

    this.app.vault.on('modify', (file) => {
      if (file instanceof TFile && shouldReload(file.path)) {
        debouncedReload();
      }
    });

    this.app.vault.on('create', (file) => {
      if (file instanceof TFile && shouldReload(file.path)) {
        debouncedReload();
      }
    });

    this.app.vault.on('delete', (file) => {
      if (file instanceof TFile && shouldReload(file.path)) {
        debouncedReload();
      }
    });

    this.app.vault.on('rename', (file, oldPath) => {
      if (shouldReload(oldPath) || (file instanceof TFile && shouldReload(file.path))) {
        debouncedReload();
      }
    });
  }

  /**
   * 简单的防抖函数
   */
  private debounce(fn: () => void, delay: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  // ========== 查询 API ==========

  /**
   * 获取全局 Rules 内容（全局 Rules + 场景索引）
   */
  getGlobalRules(): string {
    const parts: string[] = [];
    if (this.globalRulesContent) parts.push(this.globalRulesContent);
    if (this.sceneIndexContent) parts.push(this.sceneIndexContent);
    return parts.join('\n\n');
  }

  /**
   * 获取场景索引内容
   */
  getSceneIndex(): string {
    return this.sceneIndexContent;
  }

  /**
   * 注册扫描完成回调（用于热更新后同步配置）
   */
  onScanComplete(callback: () => void): void {
    this.onScanCompleteCallbacks.push(callback);
  }

  /**
   * 获取所有场景
   */
  getAllScenes(): Scene[] {
    return Array.from(this.scenes.values());
  }

  /**
   * 根据 ID 获取场景
   */
  getSceneById(sceneId: string): Scene | undefined {
    return this.scenes.get(sceneId);
  }

  /**
   * 获取指定场景的完整 Rules（全局 Rules + 场景 Rules）
   */
  getSceneRules(sceneId: string): string {
    const parts: string[] = [];

    // 1. 全局 Rules
    if (this.globalRulesContent) parts.push(this.globalRulesContent);

    // 2. 场景 Rules
    const scene = this.scenes.get(sceneId);
    if (scene?.rulesContent) parts.push(scene.rulesContent);

    return parts.join('\n\n');
  }

  /**
   * 获取指定场景的 Skills
   */
  getSceneSkills(sceneId: string): Skill[] {
    const scene = this.scenes.get(sceneId);
    return scene?.skills || [];
  }

  /**
   * 获取所有 Skill（跨场景）
   */
  getAllSkills(): Skill[] {
    const all: Skill[] = [];
    for (const scene of this.scenes.values()) {
      all.push(...scene.skills);
    }
    return all;
  }

  /**
   * 按场景分组获取 Skills（用于 UI 展示）
   * 返回 Map<sceneId, Map<category, Skill[]>>
   */
  getSkillsBySceneAndCategory(): Map<string, Map<string, Skill[]>> {
    const result = new Map<string, Map<string, Skill[]>>();
    for (const scene of this.scenes.values()) {
      const categoryMap = new Map<string, Skill[]>();
      for (const skill of scene.skills) {
        const list = categoryMap.get(skill.category) || [];
        list.push(skill);
        categoryMap.set(skill.category, list);
      }
      result.set(scene.id, categoryMap);
    }
    return result;
  }

  /**
   * 根据 ID 获取 Skill（格式：sceneId/skillBasename）
   */
  getSkillById(id: string): Skill | undefined {
    for (const scene of this.scenes.values()) {
      const skill = scene.skills.find(s => s.id === id);
      if (skill) return skill;
    }
    return undefined;
  }

  /**
   * 关键词匹配场景
   */
  matchSceneByKeywords(text: string): Scene | null {
    for (const scene of this.scenes.values()) {
      for (const keyword of scene.triggerKeywords) {
        if (text.includes(keyword)) {
          return scene;
        }
      }
    }
    return null;
  }

  /**
   * 关键词匹配 Skill（在指定场景内，或全局搜索）
   */
  matchSkillByKeywords(text: string, sceneId?: string): Skill | null {
    const skills = sceneId ? this.getSceneSkills(sceneId) : this.getAllSkills();
    for (const skill of skills) {
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
  searchSkills(query: string, sceneId?: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    const skills = sceneId ? this.getSceneSkills(sceneId) : this.getAllSkills();
    return skills.filter(skill =>
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.category.toLowerCase().includes(lowerQuery) ||
      skill.sceneId.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 模糊搜索场景
   */
  searchScenes(query: string): Scene[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllScenes().filter(scene =>
      scene.name.toLowerCase().includes(lowerQuery) ||
      scene.description.toLowerCase().includes(lowerQuery) ||
      scene.triggerKeywords.some(k => k.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 构建完整的 System Prompt（用于发送消息时）
   * 层级：全局 Rules → 场景索引 → 场景 Rules → Skill System Prompt
   */
  buildSystemPrompt(sceneId?: string, skill?: Skill): string {
    const parts: string[] = [];

    // 0. 注入当前时间信息（避免大模型产生时间幻觉）
    const now = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const timeInfo = `当前时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${weekDays[now.getDay()]}`;
    parts.push(timeInfo);

    // 1. 全局 Rules
    if (this.globalRulesContent) {
      parts.push(this.globalRulesContent);
    }

    // 2. 场景索引（帮助 AI 理解可用场景，在无场景时也加载）
    if (this.sceneIndexContent && !sceneId) {
      parts.push(this.sceneIndexContent);
    }

    // 3. 场景级 Rules
    if (sceneId) {
      const scene = this.scenes.get(sceneId);
      if (scene?.rulesContent) {
        parts.push(scene.rulesContent);
      }
    }

    // 4. Skill System Prompt
    if (skill) {
      parts.push(skill.systemPrompt);
      if (skill.outputFormat) {
        parts.push(skill.outputFormat);
      }
    }

    // 5. 输出格式约束：要求 AI 回复第一行以 # 标题 开头
    parts.push('【重要输出要求】你的回复的第一行必须是一个 Markdown 一级标题（以 # 开头），作为本次回复内容的简洁标题（不超过 20 个字），标题应准确概括回复的核心主题。之后空一行再输出正文内容。');

    return parts.join('\n\n---\n\n');
  }
}
