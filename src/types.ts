/**
 * 全局类型定义
 */

// ===== 模型层 =====

/** 聊天消息内容块（支持文本和图片） */
export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string }; // base64 data URI
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/** Function Calling 工具调用 */
export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

/** 工具定义（用于 Function Calling） */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** 聊天请求选项 */
export interface ChatOptions {
  model?: string;
  temperature?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

/** 流式输出块 */
export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

// ===== Provider 层 =====

/** 模型提供商配置 */
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  models?: string[];
}

// ===== Skill 层 =====

/** 场景定义（一级分类） */
export interface Scene {
  id: string;                    // 场景文件夹名作为 ID
  name: string;                  // Frontmatter: name（或 id）
  description: string;           // Frontmatter: description
  triggerKeywords: string[];     // Frontmatter: trigger_keywords
  icon: string;                  // Frontmatter: icon（如 📱）
  scenePrompt: string;           // _scene.md 的正文内容（加载到场景 context）
  rulesContent: string;          // 该场景下 _rules/ 所有文件拼接的内容
  skills: Skill[];               // 该场景下的所有 Skills
  folderPath: string;            // 场景文件夹完整路径
}

/** 场景索引（全局加载的轻量信息） */
export interface SceneIndex {
  content: string;               // _scenes_index.md 的正文内容
}

/** Skill 定义 */
export interface Skill {
  id: string;                    // 文件名（不含 .md）作为唯一 ID
  name: string;                  // Frontmatter: name
  description: string;           // Frontmatter: description
  triggerKeywords: string[];     // Frontmatter: trigger_keywords
  category: string;              // Frontmatter: category
  outputFolder: string;          // Frontmatter: output_folder
  outputTemplate: 'card' | 'note' | 'raw';
  modelPreference: 'text' | 'vision' | 'any';
  systemPrompt: string;          // ## System Prompt 下的正文
  outputFormat?: string;         // ## 输出格式 下的内容
  filePath: string;              // Vault 中的完整路径
  sceneId: string;               // 所属场景 ID
}

// ===== 归档层 =====

/** 归档选项 */
export interface ArchiveOptions {
  content: string;
  skill?: Skill;
  title?: string;
  tags?: string[];
}

/** 归档结果 */
export interface ArchiveResult {
  filePath: string;
  fileName: string;
}

// ===== 对话层 =====

/** 对话记录 */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  activeSkill?: string;
}

/** 对话管理器配置 */
export interface ConversationManagerConfig {
  maxContextMessages: number;
  maxContextTokens: number;
  persistHistory: boolean;
  historyFolder: string;
}

// ===== 设置层 =====

/** 插件设置 */
export interface AIChatSettings {
  // 模型提供商配置
  providers: ProviderConfig[];
  // 默认文本模型（格式: providerId:modelName）
  defaultTextModel: string;
  // 默认视觉模型
  defaultVisionModel: string;
  // 场景根文件夹路径（包含所有场景）
  scenesFolder: string;
  // 默认归档文件夹
  defaultArchiveFolder: string;
  // Skill 模式自动归档
  autoArchive: boolean;
  // 归档前确认
  confirmBeforeArchive: boolean;
  // 发送快捷键
  sendShortcut: 'enter' | 'ctrl-enter';
  // 流式输出
  streamOutput: boolean;
  // 温度
  temperature: number;
  // 上下文窗口大小（消息数）
  maxContextMessages: number;
  // RAG 相关设置
  ragEnabled: boolean;
  // Embedding 模型提供商 ID
  ragEmbeddingProvider: string;
  // Embedding 模型名称
  ragEmbeddingModel: string;
  // RAG 检索返回的最大片段数
  ragTopK: number;
  // RAG 相似度阈值（0-1，低于此值不返回）
  ragSimilarityThreshold: number;
}

/** 默认设置 */
export const DEFAULT_SETTINGS: AIChatSettings = {
  providers: [
    {
      id: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      defaultModel: 'deepseek-chat',
    },
    {
      id: 'qwen',
      name: '通义千问',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: '',
      defaultModel: 'qwen-plus',
    },
    {
      id: 'doubao',
      name: '豆包',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: '',
      defaultModel: 'doubao-pro-32k',
    },
    {
      id: 'kimi',
      name: 'Kimi',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: '',
      defaultModel: 'moonshot-v1-32k',
    },
    {
      id: 'zhipu',
      name: '智谱',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: '',
      defaultModel: 'glm-4',
    },
  ],
  defaultTextModel: 'deepseek:deepseek-chat',
  defaultVisionModel: '',
  scenesFolder: 'skills-scenes',
  defaultArchiveFolder: '_ai_output',
  autoArchive: true,
  confirmBeforeArchive: false,
  sendShortcut: 'enter',
  streamOutput: true,
  temperature: 0.7,
  maxContextMessages: 20,
  ragEnabled: false,
  ragEmbeddingProvider: '',
  ragEmbeddingModel: '',
  ragTopK: 3,
  ragSimilarityThreshold: 0.3,
};
