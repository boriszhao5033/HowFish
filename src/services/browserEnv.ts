/**
 * Lightweight runtime environment probes.
 *
 * WeChat (`MicroMessenger`) on iOS blocks file downloads and has quirks around
 * `file://` pages, so the UI surfaces a one-line escape hatch when it detects
 * that embedded browser. The check is deliberately dependency-free.
 */
export const WECHAT_OPEN_IN_BROWSER_TIP =
  '点击右上角「···」在 Safari / 默认浏览器中打开，可添加到主屏幕离线使用及正常导出 CSV / 备份文件。';

export function isWeChatBrowser(ua?: string): boolean {
  const target =
    ua ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent ?? '');
  return /MicroMessenger/i.test(target);
}