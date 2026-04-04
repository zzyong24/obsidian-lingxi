/**
 * ContentFetcher — URL 内容抓取器
 * 使用 Obsidian 内置 requestUrl 抓取静态 HTML 并提取正文
 * 不支持 JS 渲染页面（抖音/小红书等），遇到时给出友好提示
 */

import { requestUrl } from 'obsidian';

/** 抓取结果 */
export interface FetchResult {
  /** 是否成功 */
  ok: boolean;
  /** 页面标题 */
  title: string;
  /** 正文内容（Markdown 格式） */
  content: string;
  /** 作者（如能提取） */
  author: string;
  /** 原始 URL */
  url: string;
  /** 错误信息（失败时） */
  error?: string;
  /** 是否为 JS 渲染页面（无法抓取） */
  jsRendered?: boolean;
}

/** 判断是否为已知的 JS 渲染平台 */
const JS_RENDERED_PATTERNS = [
  /douyin\.com/,
  /dy\.com/,
  /xiaohongshu\.com/,
  /xhslink\.com/,
  /bilibili\.com/,
  /b23\.tv/,
  /weibo\.com/,
  /tiktok\.com/,
  /instagram\.com/,
  /twitter\.com/,
  /x\.com/,
];

/** 判断 URL 是否合法 */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export class ContentFetcher {

  /**
   * 抓取 URL 并提取正文
   */
  async fetch(url: string): Promise<FetchResult> {
    // 检查是否为已知 JS 渲染平台
    if (JS_RENDERED_PATTERNS.some(p => p.test(url))) {
      return {
        ok: false,
        title: '',
        content: '',
        author: '',
        url,
        jsRendered: true,
        error: '该平台使用动态渲染，无法自动抓取。请复制文章正文后直接粘贴到对话框，灵犀将帮你整理成知识卡片 📋',
      };
    }

    try {
      const response = await requestUrl({ url, method: 'GET' });
      const html = response.text;

      if (!html || html.length < 100) {
        return { ok: false, title: '', content: '', author: '', url, error: '页面内容为空' };
      }

      // 提取标题
      const title = this.extractTitle(html);

      // 提取正文
      const content = this.extractContent(html, url);

      // 提取作者
      const author = this.extractAuthor(html);

      if (!content || content.length < 50) {
        return {
          ok: false, title, content: '', author, url,
          jsRendered: true,
          error: '页面正文为空，可能需要登录或使用动态渲染。请复制正文后直接粘贴到对话框 📋',
        };
      }

      return { ok: true, title, content, author, url };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, title: '', content: '', author: '', url, error: `抓取失败：${msg}` };
    }
  }

  // ==================== 私有方法 ====================

  private extractTitle(html: string): string {
    // og:title 优先
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitle?.[1]) return this.decodeHtml(ogTitle[1].trim());

    // <title> 标签
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) return this.decodeHtml(titleMatch[1].trim());

    return '未知标题';
  }

  private extractAuthor(html: string): string {
    const patterns = [
      /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i,
      /"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return this.decodeHtml(m[1].trim());
    }
    return '';
  }

  /**
   * 提取正文：优先 article/main 标签，降级到 body 全文清洗
   */
  private extractContent(html: string, _url: string): string {
    // 移除 script/style/nav/header/footer/aside
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // 尝试提取 article / main / .content / .post-body 等
    const candidates = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
      /<div[^>]+class=["'][^"']*(?:article|post|content|entry|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ];

    let body = '';
    for (const pattern of candidates) {
      const m = cleaned.match(pattern);
      if (m?.[1] && m[1].length > 200) {
        body = m[1];
        break;
      }
    }

    if (!body) {
      // 降级：取 <body> 全文
      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      body = bodyMatch?.[1] || cleaned;
    }

    return this.htmlToMarkdown(body);
  }

  /** 简单 HTML → Markdown 转换 */
  private htmlToMarkdown(html: string): string {
    return html
      // 标题
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n#### $1\n')
      // 段落 / 换行
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      // 加粗 / 斜体
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
      // 链接
      .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      // 移除其余标签
      .replace(/<[^>]+>/g, '')
      // 解码 HTML 实体
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      // 清理多余空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private decodeHtml(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
