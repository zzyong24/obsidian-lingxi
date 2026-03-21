/**
 * Tool Call 处理器
 * 注册 Function Calling 工具定义，执行 AI 发起的工具调用
 * 实现"一切皆对话"的 Skill/Scene CRUD 操作
 */

import { ToolDefinition, ToolCall, ChatMessage } from '@/types';
import { SkillFileOperator, CreateSkillParams, UpdateSkillParams, CreateSceneParams, UpdateSceneParams } from './SkillFileOperator';
import { SceneManager } from './SceneManager';

/** 工具执行结果 */
export interface ToolResult {
  toolCallId: string;
  result: string;
}

export class ToolCallHandler {
  private skillFileOperator: SkillFileOperator;
  private sceneManager: SceneManager;

  constructor(skillFileOperator: SkillFileOperator, sceneManager: SceneManager) {
    this.skillFileOperator = skillFileOperator;
    this.sceneManager = sceneManager;
  }

  /**
   * 获取所有可用的工具定义（注册给 AI）
   */
  getToolDefinitions(): ToolDefinition[] {
    return [
      // ===== Skill 操作 =====
      {
        type: 'function',
        function: {
          name: 'create_skill',
          description: '在指定场景下创建一个新的 Skill 文件。创建前需确保场景已存在。',
          parameters: {
            type: 'object',
            properties: {
              sceneId: { type: 'string', description: '目标场景 ID（场景文件夹名，如"自媒体"、"学习"）' },
              category: { type: 'string', description: '分类名（用于子文件夹和面板分组，如"选题管理"、"素材创作"）' },
              name: { type: 'string', description: 'Skill 显示名称' },
              description: { type: 'string', description: '一句话描述这个 Skill 的功能' },
              triggerKeywords: { type: 'array', items: { type: 'string' }, description: '触发关键词列表，3-5 个' },
              systemPrompt: { type: 'string', description: 'AI 的核心指令，包含角色定义、工作流程、分析框架' },
              outputFormat: { type: 'string', description: '输出格式模板（可选，定义 AI 回复的结构）' },
              outputFolder: { type: 'string', description: '归档输出文件夹名（可选，默认与分类名相同）' },
              outputTemplate: { type: 'string', enum: ['card', 'note', 'raw'], description: '输出模板类型（可选，默认 note）' },
              modelPreference: { type: 'string', enum: ['text', 'vision', 'any'], description: '模型偏好（可选，默认 text）' },
            },
            required: ['sceneId', 'category', 'name', 'description', 'triggerKeywords', 'systemPrompt'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_skill',
          description: '更新已有的 Skill 的配置或 System Prompt。只需传入要修改的字段。',
          parameters: {
            type: 'object',
            properties: {
              skillId: { type: 'string', description: 'Skill ID（格式：场景ID/Skill文件名，如"自媒体/热点选题"）' },
              name: { type: 'string', description: '新的名称（可选）' },
              description: { type: 'string', description: '新的描述（可选）' },
              triggerKeywords: { type: 'array', items: { type: 'string' }, description: '新的触发关键词（可选）' },
              category: { type: 'string', description: '新的分类（可选，会移动文件）' },
              systemPrompt: { type: 'string', description: '新的 System Prompt（可选）' },
              outputFormat: { type: 'string', description: '新的输出格式（可选）' },
              outputFolder: { type: 'string', description: '新的输出文件夹（可选）' },
              outputTemplate: { type: 'string', enum: ['card', 'note', 'raw'], description: '新的模板类型（可选）' },
              modelPreference: { type: 'string', enum: ['text', 'vision', 'any'], description: '新的模型偏好（可选）' },
            },
            required: ['skillId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delete_skill',
          description: '删除一个 Skill（移入回收站）。删除前应向用户确认。',
          parameters: {
            type: 'object',
            properties: {
              skillId: { type: 'string', description: 'Skill ID（格式：场景ID/Skill文件名）' },
            },
            required: ['skillId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_skills',
          description: '列出当前所有场景和 Skills 的概要信息，包括名称、分类、描述、触发关键词。',
          parameters: {
            type: 'object',
            properties: {
              sceneId: { type: 'string', description: '指定场景 ID 只列出该场景的 Skills（可选，不传则列出全部）' },
            },
            required: [],
          },
        },
      },
      // ===== Scene 操作 =====
      {
        type: 'function',
        function: {
          name: 'create_scene',
          description: '创建一个新的场景，包含目录结构和场景描述文件。【重要】1. 必须填写 coreIdea、workflowSteps、usageTips 字段，生成详细的场景文档（参考知识学习场景的格式）；2. 创建场景后，必须紧接着调用 create_skill 为该场景创建至少 2-3 个核心 Skill，否则场景将是空的无法使用。',
          parameters: {
            type: 'object',
            properties: {
              sceneId: { type: 'string', description: '场景 ID（将作为文件夹名，建议中文，如"健康管理"、"投资理财"）' },
              name: { type: 'string', description: '场景显示名称' },
              description: { type: 'string', description: '场景描述（一句话概括场景定位和覆盖范围）' },
              triggerKeywords: { type: 'array', items: { type: 'string' }, description: '触发关键词列表（5-10 个，覆盖用户常用表达）' },
              icon: { type: 'string', description: '场景图标 emoji（如 📱、📚、💪）' },
              coreIdea: { type: 'string', description: '场景核心理念（用一两句话描述核心价值观或方法论，如"输入→加工→输出→反馈的学习闭环"）' },
              workflowSteps: { type: 'array', items: { type: 'string' }, description: '完整工作流步骤（每步格式："步骤名 → 一句话描述"，如 ["内容收集 → 粘贴文章/段落，AI 帮你提炼加工", "知识卡片 → 生成摘要、关键要点、深度思考问题"]）' },
              usageTips: { type: 'array', items: { type: 'string' }, description: '使用提示（给用户的 2-4 条使用建议）' },
              scenePrompt: { type: 'string', description: '场景级 Prompt（可选，如果不传将根据以上字段自动生成完整文档。仅在需要完全自定义场景文档时使用）' },
            },
            required: ['sceneId', 'name', 'description', 'triggerKeywords', 'icon', 'coreIdea', 'workflowSteps', 'usageTips'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_scene',
          description: '更新已有场景的配置信息。只需传入要修改的字段。',
          parameters: {
            type: 'object',
            properties: {
              sceneId: { type: 'string', description: '场景 ID' },
              name: { type: 'string', description: '新的名称（可选）' },
              description: { type: 'string', description: '新的描述（可选）' },
              triggerKeywords: { type: 'array', items: { type: 'string' }, description: '新的触发关键词（可选）' },
              icon: { type: 'string', description: '新的图标 emoji（可选）' },
              scenePrompt: { type: 'string', description: '新的场景 Prompt（可选）' },
            },
            required: ['sceneId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delete_scene',
          description: '删除一个场景（移入回收站）。如果场景下有 Skills，需要先删除所有 Skills。',
          parameters: {
            type: 'object',
            properties: {
              sceneId: { type: 'string', description: '场景 ID' },
            },
            required: ['sceneId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_scenes',
          description: '列出当前所有场景的概要信息，包括名称、图标、描述、Skill 数量。',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
    ];
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const { id, function: fn } = toolCall;
    let args: Record<string, unknown>;

    try {
      args = JSON.parse(fn.arguments) as Record<string, unknown>;
    } catch {
      return { toolCallId: id, result: JSON.stringify({ success: false, message: '工具参数解析失败' }) };
    }

    let result: string;

    switch (fn.name) {
      case 'create_skill':
        result = JSON.stringify(await this.skillFileOperator.createSkill(args as unknown as CreateSkillParams));
        break;
      case 'update_skill':
        result = JSON.stringify(await this.skillFileOperator.updateSkill(args as unknown as UpdateSkillParams));
        break;
      case 'delete_skill':
        result = JSON.stringify(await this.skillFileOperator.deleteSkill(args.skillId as string));
        break;
      case 'list_skills':
        result = JSON.stringify(this.skillFileOperator.listSkills(args.sceneId as string | undefined));
        break;
      case 'create_scene':
        result = JSON.stringify(await this.skillFileOperator.createScene(args as unknown as CreateSceneParams));
        break;
      case 'update_scene':
        result = JSON.stringify(await this.skillFileOperator.updateScene(args as unknown as UpdateSceneParams));
        break;
      case 'delete_scene':
        result = JSON.stringify(await this.skillFileOperator.deleteScene(args.sceneId as string));
        break;
      case 'list_scenes':
        result = JSON.stringify(this.skillFileOperator.listScenes());
        break;
      default:
        result = JSON.stringify({ success: false, message: `未知工具: ${fn.name}` });
    }

    return { toolCallId: id, result };
  }

  /**
   * 判断当前用户输入是否应该启用 Tool Call 工具
   * 只有涉及 Skill/Scene 管理操作时才注入工具定义，避免普通对话浪费 token
   */
  shouldEnableTools(text: string): boolean {
    const lowerText = text.toLowerCase();

    // 阶段1：精确短语匹配
    const exactPhrases = [
      'skill管理', 'skill列表', '场景管理', '场景列表',
      'create skill', 'new skill', 'update skill', 'delete skill',
      'create scene', 'new scene', 'update scene', 'delete scene',
      'list skills', 'list scenes',
    ];
    if (exactPhrases.some(p => lowerText.includes(p))) return true;

    // 阶段2：动词 + 对象 组合匹配（模糊匹配，支持中间插入任意字符）
    const actionWords = ['创建', '新建', '做个', '添加', '更新', '修改', '编辑', '改一下', '删除', '移除', '去掉', '查看', '列出', '有哪些', '我的', '帮我'];
    const objectWords = ['skill', 'skills', '技能', '场景', 'scene', 'scenes'];

    const hasAction = actionWords.some(a => lowerText.includes(a));
    const hasObject = objectWords.some(o => lowerText.includes(o));

    return hasAction && hasObject;
  }

  /**
   * 判断当前对话上下文中是否已经处于工具调用流程中
   * 如果对话历史中存在 tool_calls 或 tool 消息，说明正在进行 CRUD 操作，
   * 后续轮次应继续启用工具（即使用户输入"确认"等简短文本也不中断工具链）
   */
  shouldKeepToolsEnabled(messages: ChatMessage[]): boolean {
    // 检查最近的消息中是否有 tool_calls 或 tool 角色消息
    // 只检查最近 10 条消息，避免历史太远的工具调用干扰
    const recent = messages.slice(-10);
    return recent.some(m =>
      m.role === 'tool' ||
      (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0)
    );
  }
}
