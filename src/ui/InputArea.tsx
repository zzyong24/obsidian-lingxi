/**
 * 输入区域组件
 * 支持文本输入、图片上传（粘贴/拖拽/选择）、@ 引用笔记
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Skill, NoteReference } from '@/types';
import { App, TFile } from 'obsidian';

/** 待上传的图片项 */
export interface ImageAttachment {
  id: string;
  file: File;
  dataUrl: string; // base64 data URI
}

interface InputAreaProps {
  app: App;
  onSend: (text: string, images?: ImageAttachment[], noteRefs?: NoteReference[]) => void;
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
  app,
  onSend,
  selectedSkill,
  onClearSkill,
  isLoading,
  sendShortcut,
}) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  // 笔记引用相关状态
  const [noteRefs, setNoteRefs] = useState<NoteReference[]>([]);
  const [showNoteSearch, setShowNoteSearch] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [noteSearchResults, setNoteSearchResults] = useState<TFile[]>([]);
  const [noteSearchIndex, setNoteSearchIndex] = useState(0);
  const [atTriggerPos, setAtTriggerPos] = useState<number>(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteSearchRef = useRef<HTMLDivElement>(null);

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

  // ===== 笔记引用处理 =====

  /** 搜索 Vault 中的笔记 */
  const searchNotes = useCallback((query: string) => {
    const files = app.vault.getMarkdownFiles();
    if (!query.trim()) {
      // 无搜索词时显示最近修改的前 10 个文件
      const sorted = [...files].sort((a, b) => b.stat.mtime - a.stat.mtime);
      return sorted.slice(0, 10);
    }
    const lowerQuery = query.toLowerCase();
    const matched = files.filter(f => {
      const name = f.basename.toLowerCase();
      const path = f.path.toLowerCase();
      return name.includes(lowerQuery) || path.includes(lowerQuery);
    });
    // 按相关度排序：名称匹配优先于路径匹配
    matched.sort((a, b) => {
      const aNameMatch = a.basename.toLowerCase().includes(lowerQuery) ? 0 : 1;
      const bNameMatch = b.basename.toLowerCase().includes(lowerQuery) ? 0 : 1;
      return aNameMatch - bNameMatch;
    });
    return matched.slice(0, 10);
  }, [app]);

  /** 更新搜索结果 */
  useEffect(() => {
    if (showNoteSearch) {
      const results = searchNotes(noteSearchQuery);
      setNoteSearchResults(results);
      setNoteSearchIndex(0);
    }
  }, [noteSearchQuery, showNoteSearch, searchNotes]);

  /** 选中一个笔记引用 */
  const selectNoteRef = useCallback((file: TFile) => {
    // 避免重复引用
    const alreadyReferenced = noteRefs.some(r => r.path === file.path);
    if (!alreadyReferenced) {
      setNoteRefs(prev => [...prev, { path: file.path, name: file.basename }]);
    }
    // 移除输入中的 @query 部分
    if (atTriggerPos >= 0) {
      const before = text.slice(0, atTriggerPos);
      const afterCursor = text.slice(textareaRef.current?.selectionStart || text.length);
      setText(before + afterCursor);
    }
    setShowNoteSearch(false);
    setNoteSearchQuery('');
    setAtTriggerPos(-1);
    textareaRef.current?.focus();
  }, [noteRefs, text, atTriggerPos]);

  /** 移除一个笔记引用 */
  const removeNoteRef = useCallback((path: string) => {
    setNoteRefs(prev => prev.filter(r => r.path !== path));
  }, []);

  /** 关闭笔记搜索 */
  const closeNoteSearch = useCallback(() => {
    setShowNoteSearch(false);
    setNoteSearchQuery('');
    setAtTriggerPos(-1);
  }, []);

  // 点击外部关闭搜索面板
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (noteSearchRef.current && !noteSearchRef.current.contains(e.target as Node)) {
        closeNoteSearch();
      }
    };
    if (showNoteSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNoteSearch, closeNoteSearch]);

  // ===== 发送 =====

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && images.length === 0 && noteRefs.length === 0) || isLoading) return;

    onSend(trimmed, images.length > 0 ? images : undefined, noteRefs.length > 0 ? noteRefs : undefined);
    setText('');
    setImages([]);
    setNoteRefs([]);
    closeNoteSearch();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, images, noteRefs, isLoading, onSend, closeNoteSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 如果笔记搜索面板打开，使用上下键和回车来操作
    if (showNoteSearch) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setNoteSearchIndex(prev => Math.min(prev + 1, noteSearchResults.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setNoteSearchIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (noteSearchResults.length > 0) {
          selectNoteRef(noteSearchResults[noteSearchIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeNoteSearch();
        return;
      }
    }

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
  }, [sendShortcut, handleSend, showNoteSearch, noteSearchResults, noteSearchIndex, selectNoteRef, closeNoteSearch]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart;
    setText(newText);

    // 检测 @ 触发笔记搜索
    if (cursorPos > 0) {
      // 向前找 @ 符号
      const textBeforeCursor = newText.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex >= 0) {
        // 确保 @ 前面是空格、行首或输入开头
        const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
          const query = textBeforeCursor.slice(lastAtIndex + 1);
          // query 中不应包含空格（空格表示结束搜索）
          if (!query.includes(' ') && !query.includes('\n')) {
            setShowNoteSearch(true);
            setNoteSearchQuery(query);
            setAtTriggerPos(lastAtIndex);
            return;
          }
        }
      }
    }
    // 没有匹配到 @ 搜索模式，关闭搜索面板
    if (showNoteSearch) {
      closeNoteSearch();
    }
  }, [showNoteSearch, closeNoteSearch]);

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

      {/* 引用的笔记标签 */}
      {noteRefs.length > 0 && (
        <div className="ai-chat-note-refs-bar">
          {noteRefs.map(ref => (
            <div key={ref.path} className="ai-chat-note-ref-tag">
              <span className="ai-chat-note-ref-icon">📄</span>
              <span className="ai-chat-note-ref-name" title={ref.path}>{ref.name}</span>
              <button
                className="ai-chat-note-ref-remove"
                onClick={() => removeNoteRef(ref.path)}
                title="移除引用"
              >
                ✕
              </button>
            </div>
          ))}
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

      {/* 笔记搜索面板 */}
      {showNoteSearch && (
        <div className="ai-chat-note-search-panel" ref={noteSearchRef}>
          <div className="ai-chat-note-search-header">
            <span className="ai-chat-note-search-title">📄 引用笔记</span>
            <span className="ai-chat-note-search-hint">
              {noteSearchQuery ? `搜索: ${noteSearchQuery}` : '输入关键词搜索…'}
            </span>
          </div>
          <div className="ai-chat-note-search-list">
            {noteSearchResults.length === 0 ? (
              <div className="ai-chat-note-search-empty">没有找到匹配的笔记</div>
            ) : (
              noteSearchResults.map((file, index) => (
                <div
                  key={file.path}
                  className={`ai-chat-note-search-item ${index === noteSearchIndex ? 'ai-chat-note-search-item-active' : ''}`}
                  onClick={() => selectNoteRef(file)}
                  onMouseEnter={() => setNoteSearchIndex(index)}
                >
                  <span className="ai-chat-note-search-item-icon">📄</span>
                  <div className="ai-chat-note-search-item-info">
                    <span className="ai-chat-note-search-item-name">{file.basename}</span>
                    <span className="ai-chat-note-search-item-path">{file.parent?.path || ''}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="ai-chat-input-wrapper">
        {/* 笔记引用按钮 */}
        <button
          className="ai-chat-toolbar-btn"
          onClick={() => {
            if (showNoteSearch) {
              closeNoteSearch();
            } else {
              // 在当前光标位置插入 @
              const textarea = textareaRef.current;
              if (textarea) {
                const pos = textarea.selectionStart;
                const newText = text.slice(0, pos) + '@' + text.slice(pos);
                setText(newText);
                setShowNoteSearch(true);
                setNoteSearchQuery('');
                setAtTriggerPos(pos);
                // 光标移到 @ 后面
                setTimeout(() => {
                  textarea.selectionStart = textarea.selectionEnd = pos + 1;
                  textarea.focus();
                }, 0);
              }
            }
          }}
          disabled={isLoading}
          title="引用笔记（输入 @ 也可触发）"
        >
          📄
        </button>

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
            : '输入消息，@ 引用笔记...'}
          rows={1}
          disabled={isLoading}
        />

        <button
          className={`ai-chat-send-btn ${isLoading ? 'ai-chat-send-btn-disabled' : ''}`}
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && images.length === 0 && noteRefs.length === 0)}
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
        {' · 支持粘贴/拖拽图片 · @ 引用笔记'}
      </div>
    </div>
  );
};
