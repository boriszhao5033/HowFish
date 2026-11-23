import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../context/DataContext', async () => {
  const { loadStaticAppData } = await import('../dataLoader');
  const data = loadStaticAppData();
  return {
    useData: () => ({ data, searchEngine: null, loading: false, error: null }),
  };
});

import { HorizontalScrollSyncBar } from '../../components/common/HorizontalScrollSyncBar';
import { TableZoomControls } from '../../components/common/TableZoomControls';
import { ColumnCustomizer } from '../../components/table/ColumnCustomizer';
import { AtlasPage } from '../../pages/AtlasPage';
import { TablePage } from '../../pages/TablePage';
import { DEFAULT_TABLE_STATE, useAppStore } from '../../store/useAppStore';

const columns = [
  { id: 'name', label: '物种名称', locked: true },
  { id: 'latin', label: '拉丁学名' },
  { id: 'season', label: '当季月份' },
];

function renderCustomizer(open: boolean, onClose = vi.fn()) {
  const utils = render(
    <ColumnCustomizer
      open={open}
      onClose={onClose}
      columns={columns}
      visibleIds={['name', 'latin']}
      presetLabel="核心选购列"
      onToggle={() => undefined}
      onReset={() => undefined}
      onShowAll={() => undefined}
    />,
  );
  return { ...utils, onClose };
}

function ScrollHarness() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  return (
    <div>
      <HorizontalScrollSyncBar scrollRef={scrollRef} />
      <div ref={scrollRef} data-testid="scroller" />
    </div>
  );
}

function makeScrollerScrollable(
  scroller: HTMLElement,
  scrollWidth: number,
  clientWidth: number,
): void {
  let scrollLeft = 0;
  Object.defineProperty(scroller, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth,
  });
  Object.defineProperty(scroller, 'clientWidth', {
    configurable: true,
    get: () => clientWidth,
  });
  Object.defineProperty(scroller, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
}

beforeEach(() => {
  useAppStore.setState({
    compareIds: [],
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
  vi.restoreAllMocks();
});

describe('ColumnCustomizer', () => {
  it('renders nothing into document.body when closed', () => {
    const { container } = renderCustomizer(false);
    expect(container.childElementCount).toBe(0);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toBe('');
  });

  it('renders the dialog when open', () => {
    renderCustomizer(true);
    expect(screen.getByRole('dialog', { name: '自定义列' })).toBeTruthy();
    expect(screen.getByText('完成')).toBeTruthy();
    expect(screen.getByLabelText('关闭自定义列')).toBeTruthy();
  });

  it('calls onClose from the close button and the 完成 button', () => {
    const first = renderCustomizer(true);
    fireEvent.click(screen.getByLabelText('关闭自定义列'));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    cleanup();

    const second = renderCustomizer(true);
    fireEvent.click(screen.getByText('完成'));
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on backdrop click and Escape', () => {
    const backdrop = renderCustomizer(true);
    fireEvent.click(screen.getByTestId('column-customizer-backdrop'));
    expect(backdrop.onClose).toHaveBeenCalledTimes(1);
    cleanup();

    const escape = renderCustomizer(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(escape.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('HorizontalScrollSyncBar', () => {
  it('renders nothing until the scroller actually overflows', () => {
    render(<ScrollHarness />);
    expect(screen.queryByTestId('horizontal-scroll-sync-bar')).toBeNull();
  });

  it('syncs the slider value and bounds to the scroller scrollLeft', () => {
    render(<ScrollHarness />);
    const scroller = screen.getByTestId('scroller');
    makeScrollerScrollable(scroller, 1200, 400);

    fireEvent.scroll(scroller);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(screen.getByTestId('horizontal-scroll-sync-bar')).toBeTruthy();
    expect(slider.max).toBe('800');
    expect(slider.value).toBe('0');

    scroller.scrollLeft = 250;
    fireEvent.scroll(scroller);
    expect(slider.value).toBe('250');

    fireEvent.change(slider, { target: { value: '500' } });
    expect(slider.value).toBe('500');
    expect(scroller.scrollLeft).toBe(500);
  });
});

function ZoomHarness() {
  const [zoom, setZoom] = useState(1);
  return <TableZoomControls zoom={zoom} onChange={setZoom} />;
}

describe('TableZoomControls', () => {
  it('zooms in and out in 0.1 steps and resets from the percentage button', () => {
    render(<ZoomHarness />);

    expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('放大'));
    expect(screen.getByText('110%')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('放大'));
    expect(screen.getByText('120%')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('缩小'));
    expect(screen.getByText('110%')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('重置缩放'));
    expect(screen.getByText('100%')).toBeTruthy();
  });
});

describe('TablePage schema columns', () => {
  it('renders 生物分类 and per-region short availability columns without legacy taxonomy columns', () => {
    render(
      <MemoryRouter>
        <TablePage />
      </MemoryRouter>,
    );

    const headers = Array.from(
      document.querySelectorAll('[role="columnheader"]'),
    ).map((element) => (element.textContent ?? '').trim());

    expect(headers).toContain('生物分类');
    for (const label of ['澳洲市场', '中国北方', '江浙沪', '闽粤港台']) {
      expect(headers).toContain(label);
    }
    for (const legacy of ['总目', '目', '所属科', '所属属']) {
      expect(headers).not.toContain(legacy);
    }
    expect(document.querySelector('.sticky.left-0')).toBeNull();
    expect(screen.getByTestId('table-zoom-controls')).toBeTruthy();
  });
});

describe('AtlasPage table zoom', () => {
  it('renders zoom controls in the 分类表 view', () => {
    render(
      <MemoryRouter initialEntries={['/atlas']}>
        <AtlasPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /分类表/ }));
    expect(screen.getByTestId('table-zoom-controls')).toBeTruthy();
  });
});


describe('AtlasPage diagram zoom', () => {
  it('renders zoom controls in the 树状图 diagram view', () => {
    render(
      <MemoryRouter initialEntries={['/atlas']}>
        <AtlasPage />
      </MemoryRouter>,
    );

    const controls = screen.getByTestId('table-zoom-controls');
    expect(within(controls).getByLabelText('放大')).toBeTruthy();
    expect(within(controls).getByLabelText('缩小')).toBeTruthy();
    expect(within(controls).getByText('100%')).toBeTruthy();
  });
});

describe('TablePage compact compare button', () => {
  it('keeps the 物种名称 column wide and shrinks the 对比 button when zooming out', () => {
    const heightDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'clientHeight',
    );
    const widthDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'clientWidth',
    );
    Object.defineProperty(Element.prototype, 'clientHeight', {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(Element.prototype, 'clientWidth', {
      configurable: true,
      get: () => 1200,
    });

    render(
      <MemoryRouter>
        <TablePage />
      </MemoryRouter>,
    );

    const nameHeader = Array.from(
      document.querySelectorAll<HTMLElement>('[role="columnheader"]'),
    ).find((element) =>
      (element.textContent ?? '').includes('物种名称'),
    );
    expect(nameHeader).toBeTruthy();
    const headerWidth = Number.parseFloat(nameHeader?.style.width ?? '0');
    expect(headerWidth).toBeGreaterThanOrEqual(260);

    const queryCompare = () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('[role="cell"] button'),
      ).find((element) => (element.textContent ?? '').includes('对比')) ??
      null;

    const before = queryCompare();
    expect(before).toBeTruthy();
    const beforeHeight = Number.parseFloat(before?.style.height ?? '0');
    const beforeFont = Number.parseFloat(before?.style.fontSize ?? '0');
    expect(beforeHeight).toBeGreaterThan(0);
    expect(beforeFont).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('缩小'));

    const after = queryCompare();
    expect(after).toBeTruthy();
    const afterHeight = Number.parseFloat(after?.style.height ?? '0');
    const afterFont = Number.parseFloat(after?.style.fontSize ?? '0');
    expect(afterHeight).toBeLessThan(beforeHeight);
    expect(afterFont).toBeLessThan(beforeFont);

    if (heightDescriptor) {
      Object.defineProperty(Element.prototype, 'clientHeight', heightDescriptor);
    }
    if (widthDescriptor) {
      Object.defineProperty(Element.prototype, 'clientWidth', widthDescriptor);
    }
  });
});
