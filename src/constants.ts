/** 常量定义 */

/** 聊天视图类型标识 */
export const CHAT_VIEWTYPE = 'ai-chat-view';

/** 插件显示名称 */
export const PLUGIN_DISPLAY_NAME = 'AI Chat';

/** 事件名称 */
export const EVENT_NAMES = {
  CHAT_IS_VISIBLE: 'ai-chat:chat-is-visible',
  ACTIVE_LEAF_CHANGE: 'ai-chat:active-leaf-change',
  SEND_MESSAGE: 'ai-chat:send-message',
} as const;
