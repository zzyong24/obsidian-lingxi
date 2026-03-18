/**
 * Markdown 工具函数
 */

/**
 * 提取 Markdown 文件的 Frontmatter
 */
export function extractFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result: Record<string, string> = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      result[kvMatch[1]] = kvMatch[2].replace(/^["']|["']$/g, '');
    }
  }

  return result;
}

/**
 * 获取 ChatMessage 的纯文本内容
 */
export function getMessageText(content: string | { type: string; text?: string }[]): string {
  if (typeof content === 'string') return content;
  return content.map(p => p.text || '').join('');
}
