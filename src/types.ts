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
  type: 'function';
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
  /** 流式 tool_call 的索引，用于正确累积多个 tool_call */
  toolCallIndex?: number;
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
  /** 该 Provider 支持的 Embedding 模型名（留空表示不支持） */
  defaultEmbeddingModel?: string;
}

/** 服务商预设（内置，不可删除） */
export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  defaultEmbeddingModel?: string;
  /** 获取 Key 的链接 */
  keyUrl?: string;
}

/** 内置服务商预设表 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    defaultEmbeddingModel: 'text-embedding-v3',
    keyUrl: 'https://dashscope.console.aliyun.com/apiKey',
  },
  {
    id: 'doubao',
    name: '豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-32k',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    id: 'zhipu',
    name: '智谱',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    defaultEmbeddingModel: 'embedding-3',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'MiniMax-Text-01',
    keyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    defaultEmbeddingModel: 'BAAI/bge-large-zh-v1.5',
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    defaultEmbeddingModel: 'text-embedding-3-small',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
];

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

// ===== 笔记引用层 =====

/** 引用的笔记 */
export interface NoteReference {
  /** 笔记在 Vault 中的路径 */
  path: string;
  /** 笔记显示名称（不含 .md） */
  name: string;
}

// ===== 归档层 =====

/** 归档选项 */
export interface ArchiveOptions {
  content: string;
  skill?: Skill;
  title?: string;
  tags?: string[];
  /** Frontmatter type 字段，默认 note；知识卡片传 card */
  type?: string;
  /** 覆盖目标文件夹 */
  folder?: string;
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

// ===== Harness 层（记忆 + 压缩 + 自驱动） =====

/** 记忆类型 */
export type MemoryType = 'fact' | 'preference' | 'decision' | 'task';

/** 记忆条目（对应 memories/ 下的单个 .md 文件） */
export interface MemoryEntry {
  /** 文件名（不含 .md） */
  id: string;
  /** 记忆类型 */
  type: MemoryType;
  /** 记忆正文内容 */
  content: string;
  /** 标签 */
  tags: string[];
  /** 创建时间 */
  created: string;
  /** 最后访问时间 */
  lastAccessed: string;
  /** 来源：conversation | manual */
  source: 'conversation' | 'manual';
}

/** 记忆提取结果（LLM 输出的 JSON 数组元素） */
export interface ExtractedMemory {
  type: MemoryType;
  content: string;
  tags: string[];
}

/** 自驱动任务定义 */
export type ScheduleTaskType = 'weekly_report' | 'todo_check' | 'reflect_remind' | 'custom';
export type ScheduleFrequency = 'daily' | 'weekly' | 'custom' | 'onOpen';

export interface ScheduleTask {
  /** 文件名（不含 .md） */
  id: string;
  /** 任务类型 */
  type: ScheduleTaskType;
  /** 显示名称（custom 任务可自定义） */
  name?: string;
  /** 执行频率 */
  schedule: ScheduleFrequency;
  /** 上次执行时间 */
  lastRun: string;
  /** 是否启用 */
  enabled: boolean;
  /** 任务正文（Prompt） */
  prompt: string;
  /** 自定义间隔（天数，schedule='custom' 时生效） */
  intervalDays?: number;
}

/** 压缩级别 */
export type CompactionLevel = 'micro' | 'auto' | 'manual';

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
  // Embedding 模型提供商 ID（复用对话 Provider；若配置了独立 Key 则优先使用独立配置）
  ragEmbeddingProvider: string;
  // Embedding 模型名称
  ragEmbeddingModel: string;
  // Embedding 独立 API Key（留空则复用所选提供商的对话 Key）
  ragEmbeddingApiKey: string;
  // Embedding 独立 Base URL（留空则复用所选提供商的 Base URL）
  ragEmbeddingBaseUrl: string;
  // RAG 检索返回的最大片段数
  ragTopK: number;
  // RAG 相似度阈值（0-1，低于此值不返回）
  ragSimilarityThreshold: number;
  // Harness: 持久记忆
  harnessEnabled: boolean;
  // 自动提取记忆（对话结束后）
  harnessAutoExtract: boolean;
  // 记忆条目上限
  harnessMemoryLimit: number;
  // 召回条数
  harnessRecallTopK: number;
  // 上下文压缩
  harnessCompactionEnabled: boolean;
  // 压缩触发阈值（占 token 窗口百分比，如 0.85）
  harnessCompactionThreshold: number;
  // 自驱动任务
  harnessSchedulerEnabled: boolean;
}

/** RAG 单条命中来源（用于 UI 展示） */
export interface RAGSource {
  fileName: string;
  similarity: number; // 0-1
}

/** RAG 检索结果（context 注入 System Prompt，sources 用于 UI 展示） */
export interface RAGRetrieveResult {
  context: string;
  sources: RAGSource[];
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
      defaultEmbeddingModel: 'text-embedding-v3',
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
      defaultModel: 'glm-4-flash',
      defaultEmbeddingModel: 'embedding-3',
    },
    {
      id: 'minimax',
      name: 'MiniMax',
      baseUrl: 'https://api.minimax.chat/v1',
      apiKey: '',
      defaultModel: 'MiniMax-Text-01',
    },
    {
      id: 'siliconflow',
      name: 'SiliconFlow',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: '',
      defaultModel: 'deepseek-ai/DeepSeek-V3',
      defaultEmbeddingModel: 'BAAI/bge-large-zh-v1.5',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      defaultModel: 'gpt-4o-mini',
      defaultEmbeddingModel: 'text-embedding-3-small',
    },
  ],
  defaultTextModel: 'deepseek:deepseek-chat',
  defaultVisionModel: '',
  scenesFolder: 'skills-scenes',
  defaultArchiveFolder: 'AI笔记',
  autoArchive: true,
  confirmBeforeArchive: false,
  sendShortcut: 'enter',
  streamOutput: true,
  temperature: 0.7,
  maxContextMessages: 20,
  ragEnabled: false,
  ragEmbeddingProvider: '',
  ragEmbeddingModel: '',
  ragEmbeddingApiKey: '',
  ragEmbeddingBaseUrl: '',
  ragTopK: 3,
  ragSimilarityThreshold: 0.3,
  harnessEnabled: true,
  harnessAutoExtract: true,
  harnessMemoryLimit: 500,
  harnessRecallTopK: 5,
  harnessCompactionEnabled: true,
  harnessCompactionThreshold: 0.85,
  harnessSchedulerEnabled: false,
};