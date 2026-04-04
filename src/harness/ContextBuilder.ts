/**
 * ContextBuilder — 上下文组装引擎
 * 职责：每次对话时，组装完整的 system prompt
 *
 * 组装顺序（类比 Claude Code 的 Init Sequence）：
 * [1] 基础指令（角色定义、输出规范）— 来自 SceneManager
 * [2] MEMORY.md（用户画像）
 * [3] 召回的记忆条目（top-K，按相关度）
 * [4] Scene Rules + Skill Prompt（现有逻辑，保留）
 * [5] 当前笔记上下文（如果从笔记中打开对话）
 * [6] 日期 + vault 结构摘要
 */

import { MemoryEntry, Skill, AIChatSettings } from '@/types';
import { SceneManager } from '@/skills';
import { MemoryManager } from './MemoryManager';

export class ContextBuilder {
  private sceneManager: SceneManager;
  private memoryManager: MemoryManager;
  private settings: AIChatSettings;

  constructor(
    sceneManager: SceneManager,
    memoryManager: MemoryManager,
    settings: AIChatSettings,
  ) {
    this.sceneManager = sceneManager;
    this.memoryManager = memoryManager;
    this.settings = settings;
  }

  /**
   * 更新设置引用
   */
  updateSettings(settings: AIChatSettings): void {
    this.settings = settings;
  }

  /**
   * 构建完整的 system prompt
   * @param sceneId 当前场景 ID
   * @param skill 当前激活的 Skill
   * @param query 用户当前输入（用于记忆召回）
   * @param ragContext RAG 检索结果
   */
  async build(
    sceneId?: string,
    skill?: Skill,
    query?: string,
    ragContext?: string,
  ): Promise<{ systemPrompt: string; memoryCount: number }> {
    const parts: string[] = [];
    let memoryCount = 0;

    // [1] 时间信息
    const now = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const timeInfo = `当前时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${weekDays[now.getDay()]}`;
    parts.push(timeInfo);

    // [2] 全局 Rules（来自 SceneManager）
    const globalRules = this.sceneManager.getGlobalRules();
    if (globalRules) {
      // 只取 globalRulesContent 部分（不含 sceneIndex，那个在 buildSystemPrompt 中按条件加载）
      parts.push(globalRules);
    }

    // [3] MEMORY.md 用户画像
    if (this.settings.harnessEnabled) {
      const profile = this.memoryManager.getProfile();
      if (profile && profile.trim()) {
        parts.push(`## 用户画像\n${profile}`);
      }
    }

    // [4] 召回的记忆条目
    if (this.settings.harnessEnabled && query) {
      const memories = await this.memoryManager.recall(query);
      if (memories.length > 0) {
        memoryCount = memories.length;
        const memoryBlock = this.formatMemories(memories);
        parts.push(memoryBlock);
      }
    }

    // [5] 场景索引（无场景时加载，帮助 AI 理解可用场景）
    if (!sceneId) {
      const sceneIndex = this.sceneManager.getSceneIndex();
      if (sceneIndex) {
        parts.push(sceneIndex);
      }
    }

    // [6] 场景级 Rules
    if (sceneId) {
      const scene = this.sceneManager.getSceneById(sceneId);
      if (scene?.rulesContent) {
        parts.push(scene.rulesContent);
      }
    }

    // [7] Skill System Prompt
    if (skill) {
      parts.push(skill.systemPrompt);
      if (skill.outputFormat) {
        parts.push(skill.outputFormat);
      }
    }

    // [8] RAG 检索结果
    if (ragContext) {
      parts.push(ragContext);
    }

    // [9] 输出格式约束
    parts.push('【重要输出要求】你的回复的第一行必须是一个 Markdown 一级标题（以 # 开头），作为本次回复内容的简洁标题（不超过 20 个字），标题应准确概括回复的核心主题。之后空一行再输出正文内容。');

    const systemPrompt = parts.join('\n\n---\n\n');
    return { systemPrompt, memoryCount };
  }

  /**
   * 格式化记忆条目为 system prompt 片段
   */
  private formatMemories(memories: MemoryEntry[]): string {
    const lines = memories.map(mem => {
      const typeLabel = {
        fact: '事实',
        preference: '偏好',
        decision: '决策',
        task: '待办',
      }[mem.type];
      return `- [${typeLabel}] ${mem.content}`;
    });

    return `## 关于用户的记忆（请参考但不要主动提及）\n${lines.join('\n')}`;
  }
}
