/**
 * 日期时间工具函数
 * 所有时间均基于用户本地时区，避免使用 toISOString() 产生 UTC+0 时间
 */

/**
 * 获取本地时间的 ISO 格式字符串（YYYY-MM-DD HH:mm:ss）
 * 例：2026-03-21 22:18:39
 */
export function localNow(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取本地时间的 ISO 格式字符串（带时区偏移）
 * 例：2026-03-21T22:18:39+08:00
 */
export function localISOString(): string {
  const d = new Date();
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const offsetHours = Math.floor(absOffset / 60).toString().padStart(2, '0');
  const offsetMinutes = (absOffset % 60).toString().padStart(2, '0');

  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
}
