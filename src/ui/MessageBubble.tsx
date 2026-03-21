/**
 * 消息气泡组件
 * 渲染用户和 AI 的聊天消息
 */

import React, { useCallback } from 'react';
import { ChatMessage, ContentPart } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onSaveAsNote?: (content: string) => void;
  onCopy?: (content: string) => void;
}

/**
 * 简单的 Markdown 渲染（不依赖外部库）
 */
function renderMarkdown(text: string): React.ReactNode {
  // 按段落分割
  const paragraphs = text.split('\n\n');

  return paragraphs.map((para, i) => {
    // 代码块
    if (para.startsWith('```')) {
      const lines = para.split('\n');
      const lang = lines[0].replace('```', '').trim();
      const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
      return (
        <pre key={i} className="ai-chat-code-block">
          {lang && <div className="ai-chat-code-lang">{lang}</div>}
          <code>{code}</code>
        </pre>
      );
    }

    // 标题
    const headingMatch = para.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      return <Tag key={i}>{headingMatch[2]}</Tag>;
    }

    // 有序列表
    if (/^\d+\.\s/.test(para)) {
      const items = para.split('\n').filter(l => l.trim());
      return (
        <ol key={i} className="ai-chat-list">
          {items.map((item, j) => (
            <li key={j}>{item.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ol>
      );
    }

    // 无序列表
    if (/^[-*]\s/.test(para)) {
      const items = para.split('\n').filter(l => l.trim());
      return (
        <ul key={i} className="ai-chat-list">
          {items.map((item, j) => (
            <li key={j}>{item.replace(/^[-*]\s*/, '')}</li>
          ))}
        </ul>
      );
    }

    // 处理行内格式
    return <p key={i}>{renderInlineMarkdown(para)}</p>;
  });
}

/**
 * 行内 Markdown 渲染
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // 简化处理：加粗、斜体、行内代码
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 行内代码
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<code key={key++} className="ai-chat-inline-code">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 加粗
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 找到下一个特殊字符或结尾
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // 未匹配到的特殊字符，当作普通文本
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return <>{parts}</>;
}

/**
 * 提取消息中的图片列表
 */
function getMessageImages(content: string | ContentPart[]): string[] {
  if (typeof content === 'string') return [];
  return content
    .filter(p => p.type === 'image_url' && p.image_url?.url)
    .map(p => p.image_url!.url);
}

function getMessageText(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content.map(p => p.text || '').join('');
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming,
  onSaveAsNote,
  onCopy,
}) => {
  const isUser = message.role === 'user';
  const content = getMessageText(message.content);
  const images = getMessageImages(message.content);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(content);
    onCopy?.(content);
  }, [content, onCopy]);

  const handleSave = useCallback(() => {
    onSaveAsNote?.(content);
  }, [content, onSaveAsNote]);

  return (
    <div className={`ai-chat-message ${isUser ? 'ai-chat-message-user' : 'ai-chat-message-ai'}`}>
      <div className="ai-chat-message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="ai-chat-message-content">
        <div className="ai-chat-message-body">
          {/* 显示图片（用户消息中的附图） */}
          {images.length > 0 && (
            <div className="ai-chat-message-images">
              {images.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`图片 ${idx + 1}`}
                  className="ai-chat-message-image"
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
            </div>
          )}

          {/* 文本内容 */}
          {content && (
            isUser ? (
              <p>{content}</p>
            ) : (
              renderMarkdown(content)
            )
          )}
          {isStreaming && <span className="ai-chat-cursor">▊</span>}
        </div>

        {/* 消息操作按钮：用户消息支持复制，AI 消息支持复制+保存 */}
        {!isStreaming && content && (
          <div className="ai-chat-message-actions">
            <button
              className="ai-chat-action-btn"
              onClick={handleCopy}
              title="复制"
            >
              📋 复制
            </button>
            {!isUser && (
              <button
                className="ai-chat-action-btn"
                onClick={handleSave}
                title="保存为笔记"
              >
                💾 保存为笔记
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
