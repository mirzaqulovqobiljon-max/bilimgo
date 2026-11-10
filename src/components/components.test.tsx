import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { Bag } from './Bag';
import { useBobo, useBoboScreen } from './BoboProvider';
import { ObstacleScene } from './ObstacleScene';
import { boboText, content, renderWithBobo } from '../test/utils';
import { initialProgress, recordTask, setProfile } from '../engine/progress';
import { buildMapNodes } from './map/mapModel';

const village = content.levels[0]!;
const key = content.items.find((i) => i.id === 'kalit')!;

describe('Hikmat bobo', () => {
  function Speaker({ what }: { what: string }) {
    const bobo = useBobo();
    useEffect(() => bobo.say(what), [bobo, what]);
    return null;
  }

  it('shows the phrase in a speech bubble', () => {
    renderWithBobo(<Speaker what="bobo.welcome" />);
    expect(screen.getByRole('status')).toHaveTextContent('Men Hikmat boboman');
  });

  it('never repeats the same praise twice in a row', () => {
    const pool = (content.bobo['bobo.praise'] as { text: string }[]).map((l) => l.text);
    function Praiser() {
      const bobo = useBobo();
      return <button onClick={() => bobo.say('bobo.praise')}>maqta</button>;
    }
    renderWithBobo(<Praiser />);
    let last = '';
    for (let i = 0; i < 20; i++) {
      fireEvent.click(screen.getByText('maqta'));
      const now = boboText();
      expect(pool).toContain(now);
      expect(now).not.toBe(last);
      last = now;
    }
  });

  it('"Bobo" button repeats the current rule', async () => {
    function Screen() {
      useBoboScreen('bobo.ona-qishloq.puzzle');
      const bobo = useBobo();
      return <button onClick={() => bobo.say('bobo.praise')}>boshqa</button>;
    }
    renderWithBobo(<Screen />);
    await userEvent.click(screen.getByText('boshqa'));
    expect(boboText()).not.toMatch(/bo'laklarga/);
    await userEvent.click(screen.getByRole('button', { name: 'Bobo, yordam ber' }));
    expect(boboText()).toMatch(/Rasm bo'laklarga bo'lindi/);
  });

  it('reminds after 30 seconds of silence, and the timer resets on touch', () => {
    vi.useFakeTimers();
    renderWithBobo(<div />, { idle: true });
    act(() => vi.advanceTimersByTime(20_000));
    fireEvent.pointerDown(window);
    act(() => vi.advanceTimersByTime(20_000));
    expect(boboText()).toBe('');
    act(() => vi.advanceTimersByTime(10_001));
    expect(boboText()).toMatch(/Qiyin bo'lsa, menga bos/);
    vi.useRealTimers();
  });

  it('mute button toggles', async () => {
    renderWithBobo(<div />);
    const b = screen.getByRole('button', { name: "Ovozni o'chirish" });
    await userEvent.click(b);
    expect(screen.getByRole('button', { name: 'Ovozni yoqish' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Sumka', () => {
  it('shows half-collected items as n/3 and the parts that are there', async () => {
    let p = setProfile(initialProgress(), { name: 'Ali', grade: 3 });
    p = recordTask(p, content.tasks[0]!, village, 3, 0).progress;
    p = recordTask(p, content.tasks.find((t) => t.id === 'ona-qishloq-02')!, village, 3, 0).progress;
    render(<Bag items={content.items} progress={p} />);
    await userEvent.click(screen.getByRole('button', { name: /Sumka/ }));
    const row = screen.getByTestId('bag-kalit');
    expect(row).toHaveTextContent('Kalit 2/3');
    expect(screen.getByLabelText('Kalit dastasi: bor')).toBeInTheDocument();
    expect(screen.getByLabelText("Kalit halqasi: yo'q")).toBeInTheDocument();
  });

  it('is empty at the start', async () => {
    render(<Bag items={content.items} progress={initialProgress()} />);
    await userEvent.click(screen.getByRole('button', { name: /Sumka/ }));
    expect(screen.getByText(/Hozircha bo'sh/)).toBeInTheDocument();
  });
});

describe('Darvoza (buyumni ishlatish)', () => {
  it('tap key, then tap the lock -> gate opens and onDone fires', async () => {
    const onDone = vi.fn();
    renderWithBobo(<ObstacleScene level={village} item={key} onDone={onDone} animationMs={0} />);
    await userEvent.click(screen.getByRole('button', { name: /qulflangan darvoza: kalitni/i }));
    expect(boboText()).toMatch(/Avval sumkadagi kalitni ol/);
    await userEvent.click(screen.getByRole('button', { name: 'Kalitni olish' }));
    await userEvent.click(screen.getByRole('button', { name: /qulflangan darvoza: kalitni/i }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Ochildi!')).toBeInTheDocument();
  });

  it('dragging the key onto the lock opens the gate; dropping elsewhere does not', async () => {
    const onDone = vi.fn();
    renderWithBobo(<ObstacleScene level={village} item={key} onDone={onDone} animationMs={0} />);
    const target = screen.getByRole('button', { name: /qulflangan darvoza/i });
    target.getBoundingClientRect = () => ({ left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100, x: 100, y: 100, toJSON: () => ({}) });
    const keyBtn = screen.getByRole('button', { name: 'Kalitni olish' });

    // missed drop
    fireEvent.pointerDown(keyBtn, { clientX: 10, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(keyBtn, { clientX: 30, clientY: 350, pointerId: 1 });
    fireEvent.pointerUp(keyBtn, { clientX: 30, clientY: 350, pointerId: 1 });
    expect(boboText()).toMatch(/yaqinroq/);
    expect(onDone).not.toHaveBeenCalled();

    // good drop
    fireEvent.pointerDown(keyBtn, { clientX: 10, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(keyBtn, { clientX: 100, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(keyBtn, { clientX: 150, clientY: 150, pointerId: 1 });
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });
});

describe('Xarita modeli', () => {
  it('7 points, only the first is open and the caravan stands there', () => {
    const nodes = buildMapNodes(content.levels, setProfile(initialProgress(), { name: 'A', grade: 1 }));
    expect(nodes).toHaveLength(7);
    expect(nodes.map((n) => n.status)).toEqual(['open', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(nodes.filter((n) => n.current).map((n) => n.id)).toEqual(['ona-qishloq']);
    // nuqtalar xarita ichida va bir-birining ustiga tushmaydi
    for (const a of nodes) {
      expect(a.x).toBeGreaterThan(30);
      expect(a.x).toBeLessThan(330);
      for (const b of nodes) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(70);
    }
  });
});
