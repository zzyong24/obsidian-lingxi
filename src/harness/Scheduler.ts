/**
 * Scheduler — 自驱动任务调度器
 * 职责：AI 主动执行周期性任务（周报、待办检查、反思提醒）
 *
 * 设计约束（Obsidian 插件限制）：
 * - 不是后台 cron
 * - 每次打开插件/打开对话时检查是否有到期任务
 * - 到期任务自动触发，结果保存到 vault
 */

import { App, TFile, TFolder, Notice } from 'obsidian';
import { ScheduleTask, ScheduleTaskType, ScheduleFrequency, ChatMessage, AIChatSettings } from '@/types';
import { ProviderRegistry } from '@/providers';
import { MemoryManager } from './MemoryManager';
import { WorklogManager } from './WorklogManager';
import { ConversationManager } from '@/conversation/ConversationManager';

/** 任务目录 */
const TASKS_DIR = 'lingxi-harness/tasks';

/** 默认任务模板 */
const DEFAULT_TASKS: Array<{
  id: string;
  type: ScheduleTaskType;
  schedule: ScheduleFrequency;
  enabled: boolean;
  prompt: string;
}> = [
  {
    id: 'weekly_report',
    type: 'weekly_report',
    schedule: 'weekly',
    enabled: false,
    prompt: `请根据最近的对话记录和记忆，生成一份本周工作/学习总结：
1. 本周完成了哪些事
2. 关键收获和决策
3. 下周待办事项
4. 需要关注的问题

请用简洁的 Markdown 格式输出。`,
  },
  {
    id: 'todo_check',
    type: 'todo_check',
    schedule: 'daily',
    enabled: false,
    prompt: `请检查记忆中所有 type=task 的待办事项，列出：
1. 已过期未完成的任务（标记为 ⚠️）
2. 今天到期的任务（标记为 📌）
3. 近期待办（标记为 📋）

请用简洁的列表形式输出。`,
  },
  {
    id: 'reflect_remind',
    type: 'reflect_remind',
    schedule: 'weekly',
    enabled: false,
    prompt: `请基于最近的对话和记忆，给用户一些反思性的建议：
1. 哪些事情做得好，值得保持
2. 哪些模式需要注意（如拖延、过度完美主义等）
3. 一个具体的改进建议

请用温和但直接的语气，不超过 200 字。`,
  },
];

export class Scheduler {
  private app: App;
  private settings: AIChatSettings;
  private providerRegistry: ProviderRegistry;
  private memoryManager: MemoryManager;
  private worklogManager: WorklogManager;
  private conversationManager: ConversationManager;
  private tasks: ScheduleTask[] = [];
  private initialized = false;

  constructor(
    app: App,
    settings: AIChatSettings,
    providerRegistry: ProviderRegistry,
    memoryManager: MemoryManager,
    conversationManager: ConversationManager,
    worklogManager: WorklogManager,
  ) {
    this.app = app;
    this.settings = settings;
    this.providerRegistry = providerRegistry;
    this.memoryManager = memoryManager;
    this.worklogManager = worklogManager;
    this.conversationManager = conversationManager;
  }

  /**
   * 更新设置引用
   */
  updateSettings(settings: AIChatSettings): void {
    this.settings = settings;
  }

  /**
   * 初始化：加载任务定义，创建默认任务（如果不存在）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.ensureDir(TASKS_DIR);
      await this.loadTasks();

      // 创建默认任务（如果目录为空）
      if (this.tasks.length === 0) {
        for (const defaultTask of DEFAULT_TASKS) {
          await this.createTask(defaultTask);
        }
      }

      this.initialized = true;
      console.debug(`[Lingxi Harness] Scheduler 初始化完成，已加载 ${this.tasks.length} 个任务`);
    } catch (error) {
      console.error('[Lingxi Harness] Scheduler 初始化失败:', error);
    }
  }

  /**
   * tick：检查并执行到期任务
   * 在插件加载/用户打开对话面板时调用
   */
  async tick(): Promise<void> {
    if (!this.settings.harnessSchedulerEnabled) return;
    if (!this.initialized) await this.initialize();

    const now = new Date();

    for (const task of this.tasks) {
      if (!task.enabled) continue;

      if (this.isDue(task, now)) {
        console.debug(`[Lingxi Harness] 执行到期任务: ${task.id}`);
        try {
          await this.executeTask(task);
          // 更新 lastRun
          task.lastRun = now.toISOString().split('T')[0];
          await this.saveTask(task);
        } catch (error) {
          console.error(`[Lingxi Harness] 任务执行失败: ${task.id}`, error);
        }
      }
    }
  }

  /**
   * 获取所有任务（只读）
   */
  getTasks(): readonly ScheduleTask[] {
    return this.tasks;
  }

  /**
   * 切换任务启用/禁用
   */
  async toggleTask(taskId: string, enabled: boolean): Promise<void> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.enabled = enabled;
    await this.saveTask(task);
  }

  /**
   * 获取带运行状态的任务列表（供 UI 展示）
   */
  getTaskStatus(): Array<ScheduleTask & { isDue: boolean }> {
    const now = new Date();
    return this.tasks.map(t => ({
      ...t,
      isDue: this.isDue(t, now),
    }));
  }

  /**
   * 手动触发单个任务（不管是否到期）
   */
  async runTask(taskId: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      new Notice(`任务 ${taskId} 不存在`);
      return;
    }
    try {
      const label = task.name ?? task.id;
      new Notice(`🤖 正在执行「${label}」...`);
      await this.executeTask(task);
      task.lastRun = new Date().toISOString().split('T')[0];
      await this.saveTask(task);
    } catch (error) {
      console.error(`[Lingxi Harness] 手动触发任务失败: ${taskId}`, error);
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 判断任务是否到期
   */
  private isDue(task: ScheduleTask, now: Date): boolean {
    if (task.schedule === 'onOpen') return true; // 每次打开都执行
    if (!task.lastRun) return true; // 从未执行过

    const lastRun = new Date(task.lastRun);
    const daysSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24);

    switch (task.schedule) {
      case 'daily':
        return daysSinceLastRun >= 1;
      case 'weekly':
        return daysSinceLastRun >= 7;
      case 'custom':
        return daysSinceLastRun >= (task.intervalDays || 7);
      default:
        return false;
    }
  }

  /**
   * 新建自定义任务（供 UI 调用）
   */
  async addTask(taskDef: {
    name: string;
    schedule: ScheduleFrequency;
    prompt: string;
    intervalDays?: number;
  }): Promise<void> {
    if (!this.initialized) await this.initialize();
    const id = `custom_${Date.now()}`;
    await this.createTask({
      id,
      type: 'custom',
      schedule: taskDef.schedule,
      enabled: true,
      prompt: taskDef.prompt,
      name: taskDef.name,
      intervalDays: taskDef.intervalDays,
    });
    console.debug(`[Lingxi Harness] 新建自定义任务: ${id}`);
  }

  /**
   * 删除任务（仅允许删除 custom 类型）
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || task.type !== 'custom') return false;

    const filePath = `${TASKS_DIR}/${taskId}.md`;
    try {
      const exists = await this.app.vault.adapter.exists(filePath);
      if (exists) await this.app.vault.adapter.remove(filePath);
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      return true;
    } catch (error) {
      console.error(`[Lingxi Harness] 删除任务失败: ${taskId}`, error);
      return false;
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: ScheduleTask): Promise<void> {
    const resolved = this.providerRegistry.resolveModel(this.settings.defaultTextModel);
    if (!resolved) {
      new Notice(`⚠️ 自驱动任务「${task.id}」跳过：未配置模型`);
      return;
    }

    const { provider, model } = resolved;

    // 根据任务类型选择上下文构建策略
    let systemContext: string;
    if (task.type === 'weekly_report' || task.type === 'reflect_remind') {
      systemContext = await this.gatherWeeklyContext(7);
    } else if (task.type === 'todo_check') {
      const taskMemories = this.memoryManager.getAllMemories()
        .filter(m => m.type === 'task');
      systemContext = taskMemories.length > 0
        ? '## 待办事项记忆\n' + taskMemories.map(m => `- ${m.content}`).join('\n')
        : '（暂无待办事项记忆）';
    } else {
      // custom 任务：只提供用户画像作为背景，不需要 weekly context
      const profile = this.memoryManager.getProfile();
      systemContext = profile?.trim() ? `## 用户背景\n${profile}` : '';
    }

    // 从用户画像提取称呼，默认「主人」
    const profile = this.memoryManager.getProfile();
    const nameMatch = profile?.match(/(?:姓名|名字|我叫|称呼)[：:]\s*(\S+)/);
    const userName = nameMatch?.[1] || '主人';

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: task.type === 'custom'
          ? `你是用户的 AI 助手。请严格按照用户的指令直接输出内容。\n【重要】\n1. 直接输出结果，不要说"好的""收到""立即执行"等对话语气的话\n2. 内容是写给用户看的，称呼用户为「${userName}」\n3. 你是 AI，不要把自己写成内容的主体${systemContext ? `\n\n${systemContext}` : ''}`
          : `你是用户的 AI 助手。现在正在执行一个自动化任务，以下是本周的真实数据，请严格基于这些数据生成内容，不要编造。\n\n${systemContext}`,
      },
      {
        role: 'user',
        content: task.prompt,
      },
    ];

    try {
      const result = await provider.chatComplete(messages, {
        model,
        temperature: 0.5,
      });

      if (result.content) {
        // 任务显示名：custom 类型优先用 task.name
        const builtinLabel: Record<string, string> = {
          weekly_report: '周报',
          todo_check: '待办检查',
          reflect_remind: '反思建议',
        };
        const label = builtinLabel[task.type] ?? task.name ?? task.id;

        // onOpen 的简单提醒任务：直接用 Notice 展示（内容短），同时归档
        if (task.schedule === 'onOpen') {
          new Notice(`🤖 ${label}\n\n${result.content}`, 8000);
        } else {
          new Notice(`🤖 自驱动任务「${label}」已执行完成`);
        }

        // 所有任务结果追加到 lingxi-harness/task-results/{taskId}.md（不新建，带时间戳）
        const resultDir = 'lingxi-harness/task-results';
        await this.ensureDir(resultDir);
        const resultFile = `${resultDir}/${task.id}.md`;
        const timestamp = new Date().toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        });
        const entry = `\n\n---\n\n## ${label} · ${timestamp}\n\n${result.content}`;

        const exists = await this.app.vault.adapter.exists(resultFile);
        if (exists) {
          // 追加到已有文件
          const existing = await this.app.vault.adapter.read(resultFile);
          await this.app.vault.adapter.write(resultFile, existing + entry);
        } else {
          // 首次创建，加文件标题
          await this.app.vault.adapter.write(resultFile, `# ${label} 执行记录${entry}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const label = ({ weekly_report: '周报', todo_check: '待办检查', reflect_remind: '反思建议' } as Record<string, string>)[task.type] ?? task.name ?? task.id;
      if (msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('ERR_NETWORK')) {
        new Notice(`⚠️ 任务「${label}」执行失败：网络不通，请检查网络连接或模型 API 地址是否正确`, 6000);
      } else {
        new Notice(`⚠️ 任务「${label}」执行失败：${msg.slice(0, 60)}`, 5000);
      }
      console.error(`[Lingxi Harness] 任务执行 LLM 调用失败: ${task.id}`, error);
      throw error;
    }
  }

  /**
   * 聚合本周真实数据作为周报/反思的上下文
   * 四类来源：① worklog 日志 ② 对话摘要 ③ 本周新增记忆 ④ 本周修改笔记
   */
  private async gatherWeeklyContext(days: number): Promise<string> {
    const parts: string[] = [];

    // ① 工作日志（最可靠的每日记录）
    const worklogContent = await this.worklogManager.getRecentLogs(days);
    if (worklogContent) {
      parts.push(`## 本周工作日志（最近 ${days} 天）\n\n${worklogContent}`);
    } else {
      parts.push(`## 本周工作日志\n\n（本周暂无日志记录）`);
    }

    // ② 对话摘要
    const convSummary = this.conversationManager.getRecentConversationsSummary(days);
    if (convSummary) {
      parts.push(`## 本周对话记录摘要\n\n${convSummary}`);
    }

    // ③ 本周新增的记忆
    const recentMemories = this.memoryManager.getRecentMemories(days);
    if (recentMemories.length > 0) {
      const typeLabel: Record<string, string> = {
        fact: '事实', preference: '偏好', decision: '决策', task: '待办',
      };
      const memLines = recentMemories.map(m =>
        `- [${typeLabel[m.type] ?? m.type}] ${m.content}（${m.created}）`
      );
      parts.push(`## 本周新增记忆（${recentMemories.length} 条）\n\n${memLines.join('\n')}`);
    }

    // ④ 本周修改的 Vault 笔记
    const recentFiles = await this.getRecentlyModifiedFiles(days);
    if (recentFiles.length > 0) {
      const fileLines = recentFiles.map(f => `- ${f.name}（${new Date(f.mtime).toISOString().slice(0, 10)}）`);
      parts.push(`## 本周修改的笔记（${recentFiles.length} 个）\n\n${fileLines.join('\n')}`);
    }

    // ⑤ 用户画像
    const profile = this.memoryManager.getProfile();
    if (profile && profile.trim()) {
      parts.push(`## 用户背景\n\n${profile}`);
    }

    return parts.join('\n\n---\n\n');
  }

  /**
   * 获取最近 N 天内修改过的 Vault .md 文件列表
   * 排除系统目录（lingxi-harness、skills-scenes、.obsidian）
   */
  private async getRecentlyModifiedFiles(days: number): Promise<Array<{ name: string; mtime: number }>> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const excludePrefixes = [
      'lingxi-harness',
      this.settings.scenesFolder,
      this.app.vault.configDir,
      this.settings.defaultArchiveFolder,
    ];

    const files = this.app.vault.getMarkdownFiles();
    return files
      .filter(f => {
        if (f.stat.mtime < cutoff) return false;
        return !excludePrefixes.some(prefix => f.path.startsWith(prefix));
      })
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, 30) // 最多取 30 个，避免 prompt 过长
      .map(f => ({
        name: f.basename,
        mtime: f.stat.mtime,
      }));
  }

  /**
   * 加载所有任务
   */
  private async loadTasks(): Promise<void> {
    this.tasks = [];

    try {
      const folder = this.app.vault.getAbstractFileByPath(TASKS_DIR);
      if (!folder || !(folder instanceof TFolder)) return;

      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === 'md') {
          try {
            const content = await this.app.vault.read(child);
            const task = this.parseTaskFile(content, child.basename);
            if (task) {
              this.tasks.push(task);
            }
          } catch (error) {
            console.error(`[Lingxi Harness] 加载任务失败: ${child.path}`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Lingxi Harness] 加载任务目录失败:', error);
    }
  }

  /**
   * 解析任务文件
   */
  private parseTaskFile(content: string, basename: string): ScheduleTask | null {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fmMatch) return null;

    const frontmatter = fmMatch[1];
    const body = fmMatch[2].trim();

    const getField = (key: string): string => {
      const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
      return match ? match[1].trim() : '';
    };

    return {
      id: basename,
      type: (getField('type') as ScheduleTaskType) || 'custom',
      name: getField('name') || undefined,
      schedule: (getField('schedule') as ScheduleFrequency) || 'weekly',
      lastRun: getField('lastRun') || '',
      enabled: getField('enabled') === 'true',
      prompt: body,
      intervalDays: parseInt(getField('intervalDays')) || undefined,
    };
  }

  /**
   * 创建任务（内部）
   */
  private async createTask(taskDef: {
    id: string;
    type: ScheduleTaskType;
    schedule: ScheduleFrequency;
    enabled: boolean;
    prompt: string;
    name?: string;
    intervalDays?: number;
  }): Promise<void> {
    const task: ScheduleTask = {
      ...taskDef,
      lastRun: '',
    };

    const content = this.serializeTask(task);
    const filePath = `${TASKS_DIR}/${task.id}.md`;
    await this.app.vault.adapter.write(filePath, content);
    this.tasks.push(task);
  }

  /**
   * 保存任务到文件
   */
  private async saveTask(task: ScheduleTask): Promise<void> {
    const content = this.serializeTask(task);
    const filePath = `${TASKS_DIR}/${task.id}.md`;
    await this.app.vault.adapter.write(filePath, content);
  }

  /**
   * 序列化任务为 Markdown
   */
  private serializeTask(task: ScheduleTask): string {
    const lines = [
      '---',
      `type: ${task.type}`,
      `schedule: ${task.schedule}`,
      `lastRun: ${task.lastRun}`,
      `enabled: ${task.enabled}`,
    ];
    if (task.name) lines.push(`name: ${task.name}`);
    if (task.intervalDays) lines.push(`intervalDays: ${task.intervalDays}`);
    lines.push('---', '', task.prompt);
    return lines.join('\n');
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(path: string): Promise<void> {
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) {
      await this.app.vault.adapter.mkdir(path);
    }
  }
}
