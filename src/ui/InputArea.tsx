/**
 * 输入区域组件
 * 支持文本输入、图片上传（粘贴/拖拽/选择）
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Skill } from '@/types';

/** 待上传的图片项 */
export interface ImageAttachment {
  id: string;
  file: File;
  dataUrl: string; // base64 data URI
}

interface InputAreaProps {
  onSend: (text: string, images?: ImageAttachment[]) => void;
  selectedSkill: Skill | null;
  onClearSkill: () => void;
  isLoading: boolean;
  sendShortcut: 'enter' | 'ctrl-enter';
}

/** 将 File 对象转为 base64 data URI */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 生成简单唯一 ID */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

export const InputArea: React.FC<InputAreaProps> = ({
  onSend,
  selectedSkill,
  onClearSkill,
  isLoading,
  sendShortcut,
}) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [text]);

  // ===== 图片处理 =====

  /** 添加图片文件（支持批量） */
  const addImages = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newAttachments: ImageAttachment[] = [];
    for (const file of imageFiles) {
      try {
        const dataUrl = await fileToDataUrl(file);
        newAttachments.push({ id: genId(), file, dataUrl });
      } catch (err) {
        console.error('[Lingxi] 读取图片失败:', err);
      }
    }
    setImages(prev => [...prev, ...newAttachments]);
  }, []);

  /** 移除某张图片 */
  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  /** 点击按钮选择图片 */
  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** 文件选择回调 */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addImages(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addImages]);

  /** 粘贴图片 */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length > 0) {
      e.preventDefault();
      const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      addImages(files);
    }
  }, [addImages]);

  /** 拖拽相关 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addImages(files);
  }, [addImages]);

  // ===== 发送 =====

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && images.length === 0) || isLoading) return;

    onSend(trimmed, images.length > 0 ? images : undefined);
    setText('');
    setImages([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, images, isLoading, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendShortcut === 'enter') {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSend();
      }
    } else {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    }
  }, [sendShortcut, handleSend]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  return (
    <div
      className={`ai-chat-input-area ${isDragOver ? 'ai-chat-input-area-dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽提示遮罩 */}
      {isDragOver && (
        <div className="ai-chat-drop-overlay">
          <span>📎 松开以添加图片</span>
        </div>
      )}

      {/* 选中的 Skill 标签 */}
      {selectedSkill && (
        <div className="ai-chat-skill-tag">
          <span className="ai-chat-skill-tag-icon">⚡</span>
          <span>{selectedSkill.name}</span>
          <button
            className="ai-chat-skill-tag-close"
            onClick={onClearSkill}
            title="取消 Skill"
          >
            ✕
          </button>
        </div>
      )}

      {/* 图片预览区 */}
      {images.length > 0 && (
        <div className="ai-chat-image-preview-bar">
          {images.map(img => (
            <div key={img.id} className="ai-chat-image-preview-item">
              <img src={img.dataUrl} alt="预览" />
              <button
                className="ai-chat-image-preview-remove"
                onClick={() => removeImage(img.id)}
                title="移除图片"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ai-chat-input-wrapper">
        {/* 图片上传按钮 */}
        <button
          className="ai-chat-toolbar-btn"
          onClick={handleImageButtonClick}
          disabled={isLoading}
          title="上传图片（也可粘贴或拖拽）"
        >
          🖼️
        </button>

        {/* 隐藏的文件选择器 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          className="ai-chat-textarea"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={selectedSkill
            ? `使用「${selectedSkill.name}」，输入内容...`
            : '输入消息...'}
          rows={1}
          disabled={isLoading}
        />

        <button
          className={`ai-chat-send-btn ${isLoading ? 'ai-chat-send-btn-disabled' : ''}`}
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && images.length === 0)}
          title="发送"
        >
          {isLoading ? (
            <span className="ai-chat-loading-icon">⏳</span>
          ) : (
            <span>➤</span>
          )}
        </button>
      </div>

      <div className="ai-chat-input-hint">
        {sendShortcut === 'enter' ? 'Enter 发送，Shift+Enter 换行' : 'Ctrl+Enter 发送'}
        {' · 支持粘贴/拖拽图片'}
      </div>
    </div>
  );
};
