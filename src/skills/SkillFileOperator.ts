/**
 * Skill 文件操作器
 * 负责 Scene/Skill Markdown 文件的 CRUD 操作
 * 配合 Function Calling 实现"一切皆对话"
 */

import { App, TFile } from 'obsidian';
import { Scene } from '@/types';
import { SceneManager } from './SceneManager';

/** Skill 创建参数 */
export interface CreateSkillParams {
  /** 目标场景 ID（文件夹名） */
  sceneId: string;
  /** 分类名（子文件夹名，如"选题管理"） */
  category: string;
  /** Skill 名称 */
  name: string;
  /** 一句话描述 */
  description: string;
  /** 触发关键词列表 */
  triggerKeywords: string[];
  /** System Prompt 正文 */
  systemPrompt: string;
  /** 输出格式（可选） */
  outputFormat?: string;
  /** 归档输出文件夹（可选） */
  outputFolder?: string;
  /** 输出模板类型 */
  outputTemplate?: 'card' | 'note' | 'raw';
  /** 模型偏好 */
  modelPreference?: 'text' | 'vision' | 'any';
}

/** Skill 更新参数 */
export interface UpdateSkillParams {
  /** Skill ID（格式：sceneId/skillBasename） */
  skillId: string;
  /** 可更新的字段（全部可选） */
  name?: string;
  description?: string;
  triggerKeywords?: string[];
  category?: string;
  systemPrompt?: string;
  outputFormat?: string;
  outputFolder?: string;
  outputTemplate?: 'card' | 'note' | 'raw';
  modelPreference?: 'text' | 'vision' | 'any';
}

/** Scene 创建参数 */
export interface CreateSceneParams {
  /** 场景 ID（文件夹名，中文） */
  sceneId: string;
  /** 场景显示名称 */
  name: string;
  /** 场景描述 */
  description: string;
  /** 触发关键词 */
  triggerKeywords: string[];
  /** 图标 emoji */
  icon: string;
  /** 场景核心理念（一段话描述核心价值观或方法论） */
  coreIdea?: string;
  /** 完整工作流步骤（每步一句话描述，如 ["选题收集 → 碎片想法记录到收集箱", "选题深化 → 粗糙想法变成可执行方案"]） */
  workflowSteps?: string[];
  /** 使用提示（给用户的使用建议，如 ["将文章内容复制粘贴到对话框中", "所有输出会自动归档"]） */
  usageTips?: string[];
  /** 场景 Prompt 正文（可选，如果提供则直接使用，不自动生成） */
  scenePrompt?: string;
}

/** Scene 更新参数 */
export interface UpdateSceneParams {
  /** 场景 ID */
  sceneId: string;
  /** 可更新的字段 */
  name?: string;
  description?: string;
  triggerKeywords?: string[];
  icon?: string;
  scenePrompt?: string;
}

/** 操作结果 */
export interface OperationResult {
  success: boolean;
  message: string;
  /** 创建/更新后的文件路径 */
  filePath?: string;
}

export class SkillFileOperator {
  private app: App;
  private scenesFolder: string;
  private sceneManager: SceneManager;

  constructor(app: App, scenesFolder: string, sceneManager: SceneManager) {
    this.app = app;
    this.scenesFolder = scenesFolder;
    this.sceneManager = sceneManager;
  }

  // ========== Skill CRUD ==========

  /**
   * 创建一个新的 Skill 文件
   */
  async createSkill(params: CreateSkillParams): Promise<OperationResult> {
    try {
      // 验证场景是否存在
      const scene = this.sceneManager.getSceneById(params.sceneId);
      if (!scene) {
        return { success: false, message: `场景「${params.sceneId}」不存在，请先创建场景` };
      }

      // 构建文件路径
      const fileName = this.sanitizeFileName(params.name);
      const folderPath = `${this.scenesFolder}/${params.sceneId}/_skills/${params.category}`;
      const filePath = `${folderPath}/${fileName}.md`;

      // 检查是否已存在
      if (this.app.vault.getAbstractFileByPath(filePath)) {
        return { success: false, message: `Skill 文件已存在: ${filePath}` };
      }

      // 确保目录存在
      await this.ensureFolder(folderPath);

      // 生成文件内容
      const content = this.buildSkillFileContent(params);

      // 创建文件
      await this.app.vault.create(filePath, content);

      // 通知 SceneManager 重新扫描以加载新 Skill
      await this.sceneManager.fullScan();

      return {
        success: true,
        message: `✅ Skill「${params.name}」已创建，文件路径: ${filePath}`,
        filePath,
      };
    } catch (error) {
      return {
        success: false,
        message: `创建 Skill 失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 更新已有的 Skill 文件
   */
  async updateSkill(params: UpdateSkillParams): Promise<OperationResult> {
    try {
      // 查找现有 Skill
      const existingSkill = this.sceneManager.getSkillById(params.skillId);
      if (!existingSkill) {
        return { success: false, message: `未找到 Skill: ${params.skillId}` };
      }

      const file = this.app.vault.getAbstractFileByPath(existingSkill.filePath);
      if (!file || !(file instanceof TFile)) {
        return { success: false, message: `Skill 文件不存在: ${existingSkill.filePath}` };
      }

      // 合并更新字段
      const createParams: CreateSkillParams = {
        sceneId: existingSkill.sceneId,
        category: params.category ?? existingSkill.category,
        name: params.name ?? existingSkill.name,
        description: params.description ?? existingSkill.description,
        triggerKeywords: params.triggerKeywords ?? existingSkill.triggerKeywords,
        systemPrompt: params.systemPrompt ?? existingSkill.systemPrompt,
        outputFormat: params.outputFormat ?? existingSkill.outputFormat,
        outputFolder: params.outputFolder ?? existingSkill.outputFolder,
        outputTemplate: params.outputTemplate ?? existingSkill.outputTemplate,
        modelPreference: params.modelPreference ?? existingSkill.modelPreference,
      };

      // 生成新内容
      const content = this.buildSkillFileContent(createParams);

      // 如果分类变了，需要移动文件
      if (params.category && params.category !== existingSkill.category) {
        const newFolderPath = `${this.scenesFolder}/${existingSkill.sceneId}/_skills/${params.category}`;
        const newFileName = this.sanitizeFileName(createParams.name);
        const newFilePath = `${newFolderPath}/${newFileName}.md`;

        await this.ensureFolder(newFolderPath);
        await this.app.vault.modify(file, content);
        await this.app.fileManager.renameFile(file, newFilePath);

        return {
          success: true,
          message: `✅ Skill「${createParams.name}」已更新并移动到: ${newFilePath}`,
          filePath: newFilePath,
        };
      }

      // 直接修改文件内容
      await this.app.vault.modify(file, content);

      return {
        success: true,
        message: `✅ Skill「${createParams.name}」已更新`,
        filePath: existingSkill.filePath,
      };
    } catch (error) {
      return {
        success: false,
        message: `更新 Skill 失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 删除 Skill 文件
   */
  async deleteSkill(skillId: string): Promise<OperationResult> {
    try {
      const skill = this.sceneManager.getSkillById(skillId);
      if (!skill) {
        return { success: false, message: `未找到 Skill: ${skillId}` };
      }

      const file = this.app.vault.getAbstractFileByPath(skill.filePath);
      if (!file) {
        return { success: false, message: `Skill 文件不存在: ${skill.filePath}` };
      }

      await this.app.fileManager.trashFile(file);

      return {
        success: true,
        message: `✅ Skill「${skill.name}」已删除（移入回收站）`,
      };
    } catch (error) {
      return {
        success: false,
        message: `删除 Skill 失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 列出场景下所有 Skills（或全局）
   */
  listSkills(sceneId?: string): { scene: string; skills: Array<{ id: string; name: string; category: string; description: string; keywords: string[] }> }[] {
    const scenes = sceneId
      ? [this.sceneManager.getSceneById(sceneId)].filter(Boolean) as Scene[]
      : this.sceneManager.getAllScenes();

    return scenes.map(scene => ({
      scene: `${scene.icon} ${scene.name}`,
      skills: scene.skills.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        keywords: s.triggerKeywords,
      })),
    }));
  }

  // ========== Scene CRUD ==========

  /**
   * 创建新场景
   */
  async createScene(params: CreateSceneParams): Promise<OperationResult> {
    try {
      const folderPath = `${this.scenesFolder}/${params.sceneId}`;
      const filePath = `${folderPath}/_scene.md`;

      // 检查 _scene.md 是否已存在（而不是检查文件夹，因为文件夹可能已存在但 _scene.md 缺失）
      if (this.app.vault.getAbstractFileByPath(filePath)) {
        return { success: false, message: `场景「${params.sceneId}」的 _scene.md 已存在` };
      }

      // 确保场景目录存在（如果已存在则跳过创建）
      await this.ensureFolder(folderPath);

      // 创建 _scene.md
      const sceneMd = this.buildSceneFileContent(params);
      await this.app.vault.create(filePath, sceneMd);

      // 自动更新场景索引 _scenes_index.md
      await this.appendSceneToIndex(params);

      // 通知 SceneManager 重新扫描以加载新场景
      await this.sceneManager.fullScan();

      return {
        success: true,
        message: `✅ 场景「${params.icon} ${params.name}」已创建，路径: ${folderPath}。请注意：场景下还没有任何 Skill，建议继续调用 create_skill 为该场景创建 Skill。`,
        filePath,
      };
    } catch (error) {
      return {
        success: false,
        message: `创建场景失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 更新场景信息（修改 _scene.md）
   */
  async updateScene(params: UpdateSceneParams): Promise<OperationResult> {
    try {
      const scene = this.sceneManager.getSceneById(params.sceneId);
      if (!scene) {
        return { success: false, message: `场景「${params.sceneId}」不存在` };
      }

      const filePath = `${scene.folderPath}/_scene.md`;
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        return { success: false, message: `场景描述文件不存在: ${filePath}` };
      }

      // 合并参数
      const createParams: CreateSceneParams = {
        sceneId: params.sceneId,
        name: params.name ?? scene.name,
        description: params.description ?? scene.description,
        triggerKeywords: params.triggerKeywords ?? scene.triggerKeywords,
        icon: params.icon ?? scene.icon,
        scenePrompt: params.scenePrompt ?? scene.scenePrompt,
      };

      const content = this.buildSceneFileContent(createParams);
      await this.app.vault.modify(file, content);

      return {
        success: true,
        message: `✅ 场景「${createParams.icon} ${createParams.name}」已更新`,
        filePath,
      };
    } catch (error) {
      return {
        success: false,
        message: `更新场景失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 删除场景（整个文件夹移入回收站）
   */
  async deleteScene(sceneId: string): Promise<OperationResult> {
    try {
      const scene = this.sceneManager.getSceneById(sceneId);
      if (!scene) {
        return { success: false, message: `场景「${sceneId}」不存在` };
      }

      const folder = this.app.vault.getAbstractFileByPath(scene.folderPath);
      if (!folder) {
        return { success: false, message: `场景文件夹不存在: ${scene.folderPath}` };
      }

      // 检查是否有 Skills
      if (scene.skills.length > 0) {
        return {
          success: false,
          message: `场景「${scene.name}」下还有 ${scene.skills.length} 个 Skill，请先删除所有 Skill 后再删除场景`,
        };
      }

      await this.app.fileManager.trashFile(folder);

      // 从场景索引中移除
      await this.removeSceneFromIndex(sceneId, scene.name);

      // 通知 SceneManager 重新扫描
      await this.sceneManager.fullScan();

      return {
        success: true,
        message: `✅ 场景「${scene.icon} ${scene.name}」已删除（移入回收站）`,
      };
    } catch (error) {
      return {
        success: false,
        message: `删除场景失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 列出所有场景概要
   */
  listScenes(): Array<{ id: string; name: string; icon: string; description: string; skillCount: number; keywords: string[] }> {
    return this.sceneManager.getAllScenes().map(scene => ({
      id: scene.id,
      name: scene.name,
      icon: scene.icon,
      description: scene.description,
      skillCount: scene.skills.length,
      keywords: scene.triggerKeywords,
    }));
  }

  // ========== 场景索引更新 ==========

  /**
   * 将新创建的场景追加到 _scenes_index.md
   */
  private async appendSceneToIndex(params: CreateSceneParams): Promise<void> {
    const indexPath = `${this.scenesFolder}/_scenes_index.md`;
    const indexFile = this.app.vault.getAbstractFileByPath(indexPath);

    // 构建新场景的索引段落
    const newEntry = `\n---\n\n### ${params.icon} ${params.name}\n\n- **场景 ID**：${params.sceneId}\n- **关键词**：${params.triggerKeywords.join('、')}\n- **简介**：${params.description}\n- **包含 Skills**：（暂无，待创建）\n`;

    if (indexFile && indexFile instanceof TFile) {
      try {
        const content = await this.app.vault.read(indexFile);
        // 在「场景匹配规则」之前插入，如果没有这个标记就直接追加
        const ruleMarker = '## 场景匹配规则';
        const markerIndex = content.indexOf(ruleMarker);
        let updatedContent: string;
        if (markerIndex !== -1) {
          updatedContent = content.slice(0, markerIndex) + newEntry + '\n' + content.slice(markerIndex);
        } else {
          updatedContent = content + newEntry;
        }
        await this.app.vault.modify(indexFile, updatedContent);
        console.debug(`[Lingxi] 已更新场景索引: ${params.name}`);
      } catch (error) {
        console.error(`[Lingxi] 更新场景索引失败:`, error);
      }
    } else {
      console.warn(`[Lingxi] 场景索引文件不存在: ${indexPath}，跳过更新`);
    }
  }

  /**
   * 从 _scenes_index.md 中移除场景条目
   */
  private async removeSceneFromIndex(sceneId: string, sceneName: string): Promise<void> {
    const indexPath = `${this.scenesFolder}/_scenes_index.md`;
    const indexFile = this.app.vault.getAbstractFileByPath(indexPath);

    if (indexFile && indexFile instanceof TFile) {
      try {
        const content = await this.app.vault.read(indexFile);
        // 尝试匹配从 ### 开始到下一个 ### 或 ## 之间的内容
        const regex = new RegExp(`\\n---\\n\\n### [^\\n]* ${sceneName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n---\\n\\n### |\\n## |$)`, 'g');
        const updatedContent = content.replace(regex, '');
        if (updatedContent !== content) {
          await this.app.vault.modify(indexFile, updatedContent);
          console.debug(`[Lingxi] 已从场景索引移除: ${sceneName}`);
        }
      } catch (error) {
        console.error(`[Lingxi] 移除场景索引条目失败:`, error);
      }
    }
  }

  // ========== 内部工具方法 ==========

  /**
   * 构建 Skill 文件的完整 Markdown 内容
   */
  private buildSkillFileContent(params: CreateSkillParams): string {
    const keywordsStr = JSON.stringify(params.triggerKeywords);
    let content = `---
name: ${params.name}
description: ${params.description}
trigger_keywords: ${keywordsStr}
category: ${params.category}
output_folder: ${params.outputFolder || params.category}
output_template: ${params.outputTemplate || 'note'}
model_preference: ${params.modelPreference || 'text'}
---

## System Prompt

${params.systemPrompt}
`;

    if (params.outputFormat) {
      content += `\n## 输出格式\n\n${params.outputFormat}\n`;
    }

    return content;
  }

  /**
   * 构建 Scene 描述文件 (_scene.md) 内容
   */
  private buildSceneFileContent(params: CreateSceneParams): string {
    const keywordsStr = JSON.stringify(params.triggerKeywords);
    let content = `---
name: ${params.name}
description: ${params.description}
trigger_keywords: ${keywordsStr}
icon: ${params.icon}
---
`;

    // 如果提供了 scenePrompt，直接使用
    if (params.scenePrompt) {
      content += `\n${params.scenePrompt}\n`;
      return content;
    }

    // 否则，根据结构化参数自动生成丰富的场景文档
    content += `\n# ${params.icon} ${params.name}场景\n\n`;
    content += `> ${params.description}\n\n`;

    // 核心理念
    if (params.coreIdea) {
      content += `## 核心理念\n\n${params.coreIdea}\n\n`;
    }

    // 完整工作流
    if (params.workflowSteps && params.workflowSteps.length > 0) {
      content += `## 完整工作流\n\n\`\`\`\n`;
      params.workflowSteps.forEach((step, index) => {
        const emoji = index === params.workflowSteps!.length - 1 ? '🔄' : `${index + 1}️⃣`;
        const arrow = index < params.workflowSteps!.length - 1 ? '\n    ↓\n' : '\n';
        content += `${emoji} ${step}${arrow}`;
      });
      content += `\`\`\`\n\n`;
    }

    // 可用 Skills 占位
    content += `## 可用 Skills\n\n> 💡 Skills 创建后会自动更新到此处。\n\n`;
    content += `（暂无 Skills，请通过对话创建）\n\n`;

    // 使用提示
    if (params.usageTips && params.usageTips.length > 0) {
      content += `## 使用提示\n\n`;
      params.usageTips.forEach(tip => {
        content += `- ${tip}\n`;
      });
      content += `\n`;
    }

    // 场景 Rules 占位
    content += `## 场景 Rules\n\n本场景加载以下规则文件：\n- （暂无，可通过对话创建）\n`;

    return content;
  }

  /**
   * 清理文件名（去除不安全字符）
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[/:*?"<>|\\\n\r]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .trim() || '未命名';
  }

  /**
   * 确保文件夹存在（递归创建）
   */
  private async ensureFolder(folderPath: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(folderPath);
    if (existing) return;

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
