import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../context/DataContext', async () => {
  const { loadStaticAppData } = await import('../dataLoader');
  const data = loadStaticAppData();
  return {
    useData: () => ({ data, searchEngine: null, loading: false, error: null }),
  };
});

vi.mock('../csvExport', () => ({
  downloadSpeciesCsv: vi.fn(),
}));

import { ProfilePage } from '../../pages/ProfilePage';
import { TablePage } from '../../pages/TablePage';
import { DEFAULT_TABLE_STATE, useAppStore } from '../../store/useAppStore';
import { isWeChatBrowser, WECHAT_OPEN_IN_BROWSER_TIP } from '../browserEnv';

const WECHAT_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47(0x18002f2c) NetType/WIFI Language/zh_CN';
const WECHAT_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.47.2560(0x28002F30) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64';
const SAFARI_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CHROME_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function setUserAgent(value: string): void {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  useAppStore.setState({
    selectedRegion: 'cn_north',
    compareIds: [],
    favorites: [],
    userTags: {},
    userNotes: {},
    tableState: {
      ...DEFAULT_TABLE_STATE,
      preset: 'full',
      hiddenColumns: [],
      columnsCustomized: true,
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window.navigator as unknown as { userAgent?: string }).userAgent;
});

describe('isWeChatBrowser', () => {
  it('detects WeChat on iOS and Android', () => {
    expect(isWeChatBrowser(WECHAT_IOS_UA)).toBe(true);
    expect(isWeChatBrowser(WECHAT_ANDROID_UA)).toBe(true);
    expect(isWeChatBrowser()).toBe(false);
  });

  it('does not flag ordinary Safari or Chrome user agents', () => {
    expect(isWeChatBrowser(SAFARI_IOS_UA)).toBe(false);
    expect(isWeChatBrowser(CHROME_DESKTOP_UA)).toBe(false);
    expect(isWeChatBrowser('')).toBe(false);
  });
});

describe('WeChat in-app browser guidance', () => {
  it('shows the gentle WeChat banner after a CSV export attempt in TablePage', () => {
    setUserAgent(WECHAT_IOS_UA);
    render(createElement(MemoryRouter, null, createElement(TablePage)));

    fireEvent.click(screen.getByRole('button', { name: /导出 CSV/ }));

    const tip = screen.getByTestId('wechat-csv-tip');
    expect(tip.textContent).toContain(WECHAT_OPEN_IN_BROWSER_TIP);
  });

  it('keeps TablePage free of the WeChat banner in normal Safari', () => {
    setUserAgent(SAFARI_IOS_UA);
    render(createElement(MemoryRouter, null, createElement(TablePage)));

    fireEvent.click(screen.getByRole('button', { name: /导出 CSV/ }));

    expect(screen.queryByTestId('wechat-csv-tip')).toBeNull();
  });

  it('shows the WeChat guidance banner on ProfilePage and allows dismissal', () => {
    setUserAgent(WECHAT_ANDROID_UA);
    render(createElement(MemoryRouter, null, createElement(ProfilePage)));

    const tip = screen.getByTestId('wechat-browser-tip');
    expect(tip.textContent).toContain(WECHAT_OPEN_IN_BROWSER_TIP);

    fireEvent.click(screen.getByLabelText('关闭微信打开提示'));
    expect(screen.queryByTestId('wechat-browser-tip')).toBeNull();
  });

  it('hides the ProfilePage banner outside WeChat', () => {
    setUserAgent(CHROME_DESKTOP_UA);
    render(createElement(MemoryRouter, null, createElement(ProfilePage)));

    expect(screen.queryByTestId('wechat-browser-tip')).toBeNull();
  });
});