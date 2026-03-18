/**
 * 对话上下文管理器
 * 管理对话历史、消息截断、Skill 切换
 */

import { ChatMessage, Conversation } from '@/types';

/** 生成简单 UUID */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export class ConversationManager {
  private conversation: Conversation;
  private maxContextMessages: number;

  constructor(maxContextMessages: number = 20) {
    this.maxContextMessages = maxContextMessages;
    this.conversation = this.createNewConversation();
  }

  /**
   * 创建新的对话
   */
  private createNewConversation(): Conversation {
    return {
      id: generateId(),
      title: '',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeSkill: undefined,
    };
  }

  /**
   * 获取当前对话
   */
  getConversation(): Conversation {
    return this.conversation;
  }

  /**
   * 获取所有消息
   */
  getMessages(): ChatMessage[] {
    return this.conversation.messages;
  }

  /**
   * 获取发送给模型的上下文消息（带截断）
   * 策略：保留 system 消息 + 最近 N 条对话（滑动窗口）
   */
  getContextMessages(): ChatMessage[] {
    const messages = this.conversation.messages;

    // 分离 system 消息和非 system 消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // 滑动窗口截断
    const recentMessages = nonSystemMessages.slice(-this.maxContextMessages);

    return [...systemMessages, ...recentMessages];
  }

  /**
   * 追加消息到历史
   */
  append(message: ChatMessage): void {
    this.conversation.messages.push(message);
    this.conversation.updatedAt = new Date().toISOString();

    // 自动设置对话标题（取首条用户消息的前20个字）
    if (!this.conversation.title && message.role === 'user') {
      const content = typeof message.content === 'string'
        ? message.content
        : message.content.map(p => p.text || '').join('');
      this.conversation.title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
    }
  }

  /**
   * 新建对话（清空历史）
   */
  newConversation(): void {
    this.conversation = this.createNewConversation();
  }

  /**
   * 切换 Skill（保留历史，替换 system prompt）
   */
  switchSkill(skillId: string | undefined): void {
    this.conversation.activeSkill = skillId;
  }

  /**
   * 获取当前激活的 Skill ID
   */
  getActiveSkill(): string | undefined {
    return this.conversation.activeSkill;
  }

  /**
   * 清空消息
   */
  clearMessages(): void {
    this.conversation.messages = [];
    this.conversation.updatedAt = new Date().toISOString();
  }

  /**
   * 获取消息数量
   */
  getMessageCount(): number {
    return this.conversation.messages.length;
  }
}
