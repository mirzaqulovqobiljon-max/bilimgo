import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { TeacherApp } from './teacher/TeacherApp';
import { content } from './test/utils';
import { fakeServer } from './test/fakeServer';
import { createLocalStore } from './engine/storage';
import { seededRng } from './engine/random';
import { memoryKV } from './net/kv';
import { loadAccount } from './net/account';
import { playLevel } from './test/autoplay';

vi.mock('./components/map/phaserMap', () => ({ createMap: vi.fn(() => ({ destroy: vi.fn() })) }));

const renderApp = (srv: ReturnType<typeof fakeServer>, kv = memoryKV()) =>
  render(<App content={content} store={createLocalStore()} rng={seededRng(3)} delayMs={0} api={srv.api} kv={kv} />);

describe("sinf kodi bilan kirish", () => {
  it('existing student picks their name; progress syncs to the server; class goal is shown', async () => {
    const srv = fakeServer();
    const u = userEvent.setup({ delay: null });
    renderApp(srv);
    await u.click(await screen.findByRole('button', { name: /Sinf kodi bilan kirish/ }));
    await u.type(screen.getByLabelText('Sinf kodi'), 'k7p3qa');
    await u.click(screen.getByRole('button', { name: 'Davom etish' }));
    expect(await screen.findByText(/15-maktab/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Aziza' }));

    expect(await screen.findByText(/Kichik sayyoh · 3-A/)).toBeInTheDocument();
    expect(loadAccount()?.name).toBe('Aziza');
    expect(await screen.findByRole('region', { name: 'Sinf maqsadi' })).toHaveTextContent('⭐ 0 / 500');
    // Kichik sinf: reyting yo'q
    expect(screen.queryByRole('list', { name: 'Sinf reytingi' })).toBeNull();

    await playLevel(u, content, 'Ona qishloq');
    await vi.waitFor(() => expect(screen.getByRole('status', { name: 'Natijalar saqlandi' })).toBeInTheDocument());
    const doc = srv.docs.get('11111111-1111-4111-8111-111111111111')!;
    expect(doc.completedLevels).toEqual(['ona-qishloq']);
    expect(doc.inventory.kalit?.length).toBe(3);
  });

  it('new student types a name; duplicate name gets a friendly message', async () => {
    const srv = fakeServer();
    const u = userEvent.setup({ delay: null });
    renderApp(srv);
    await u.click(await screen.findByRole('button', { name: /Sinf kodi bilan kirish/ }));
    await u.type(screen.getByLabelText('Sinf kodi'), 'K7P3QA');
    await u.click(screen.getByRole('button', { name: 'Davom etish' }));
    await u.click(await screen.findByRole('button', { name: /Men yangiman/ }));
    await u.type(screen.getByLabelText('Isming'), 'aziza');
    await u.click(screen.getByRole('button', { name: 'Sayohatni boshlash' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Bu ism sinfda bor");
    await u.clear(screen.getByLabelText('Isming'));
    await u.type(screen.getByLabelText('Isming'), 'Bekzod');
    await u.click(screen.getByRole('button', { name: 'Sayohatni boshlash' }));
    expect(await screen.findByText('Bekzod')).toBeInTheDocument();
  });

  it('wrong code -> clear message; no server -> guest mode directly', async () => {
    const srv = fakeServer();
    const u = userEvent.setup({ delay: null });
    const { unmount } = renderApp(srv);
    await u.click(await screen.findByRole('button', { name: /Sinf kodi bilan kirish/ }));
    await u.type(screen.getByLabelText('Sinf kodi'), 'ZZZZZZ');
    await u.click(screen.getByRole('button', { name: 'Davom etish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bunday sinf topilmadi');
    unmount();
    srv.online = false;
    renderApp(srv);
    expect(await screen.findByLabelText('Isming')).toBeInTheDocument();
    expect(screen.getByText("Nechanchi sinfda o'qiysan?")).toBeInTheDocument();
  });

  it('plays offline: shows offline status and syncs everything later', async () => {
    const srv = fakeServer();
    const kv = memoryKV();
    const u = userEvent.setup({ delay: null });
    renderApp(srv, kv);
    await u.click(await screen.findByRole('button', { name: /Sinf kodi bilan kirish/ }));
    await u.type(screen.getByLabelText('Sinf kodi'), 'K7P3QA');
    await u.click(screen.getByRole('button', { name: 'Davom etish' }));
    await u.click(await screen.findByRole('button', { name: 'Aziza' }));
    await screen.findByText(/Kichik sayyoh · 3-A/);

    srv.online = false;
    await playLevel(u, content, 'Ona qishloq');
    await vi.waitFor(() => expect(screen.getByRole('status', { name: /Internet yo'q/ })).toBeInTheDocument());
    expect(srv.docs.get('11111111-1111-4111-8111-111111111111')?.completedLevels ?? []).toEqual([]);

    srv.online = true;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(srv.docs.get('11111111-1111-4111-8111-111111111111')?.completedLevels).toEqual(['ona-qishloq']));
    await vi.waitFor(() => expect(screen.getByRole('status', { name: 'Natijalar saqlandi' })).toBeInTheDocument());
  });
});

describe("o'qituvchi paneli", () => {
  it('login, class list, create class, stats with hardest tasks, delete student (2-step)', async () => {
    const srv = fakeServer();
    const u = userEvent.setup({ delay: null });
    render(<TeacherApp content={content} api={srv.api} />);
    await u.type(screen.getByLabelText('Email'), 'malika@maktab.uz');
    await u.type(screen.getByLabelText('Parol'), 'notogri');
    await u.click(screen.getByRole('button', { name: 'Kirish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Email yoki parol noto'g'ri");
    await u.clear(screen.getByLabelText('Parol'));
    await u.type(screen.getByLabelText('Parol'), 'kuchli-parol-1');
    await u.click(screen.getByRole('button', { name: 'Kirish' }));

    expect(await screen.findByText(/3-A — kod: K7P3QA/)).toBeInTheDocument();
    await u.type(screen.getByLabelText('Sinf nomi'), '10-B');
    await u.selectOptions(screen.getByLabelText('Sinf (1-11)'), '10');
    await u.type(screen.getByLabelText('Maktab'), 'Lisey');
    await u.click(screen.getByRole('button', { name: 'Sinf yaratish' }));
    expect(await screen.findByText(/10-B — kod:/)).toBeInTheDocument();

    await u.click(screen.getByText(/3-A — kod: K7P3QA/));
    expect(await screen.findByLabelText('Sinf kodi')).toHaveTextContent('K7P3QA');
    expect(screen.getByText(/1-8 sinflarda reyting yo'q/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    const hard = screen.getByRole('heading', { name: 'Qayerda qiynalishyapti?' }).parentElement!;
    expect(within(hard).getByText('Raqamli krossvord')).toBeInTheDocument(); // topshiriq nomi kontentdan
    expect(within(hard).getByText(/3\. Katta daryo · Krossvord/)).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: "Azizani o'chirish" }));
    await u.click(screen.getByRole('button', { name: "Yo'q" }));
    expect(screen.getByText('Aziza')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: "Azizani o'chirish" }));
    await u.click(screen.getByRole('button', { name: "O'chirish" }));
    await vi.waitFor(() => expect(screen.queryByText('Aziza')).toBeNull());
  });

  it('ranking toggle exists only for grades 9-11', async () => {
    const srv = fakeServer();
    srv.classes.push({ id: 2, name: '11-A', grade: 11, school: 'Lisey', code: 'ABCDEF', rankingEnabled: false });
    localStorage.setItem('ipak-yoli:teacher', 'x');
    const u = userEvent.setup({ delay: null });
    // token yaroqsiz -> login sahifasiga qaytadi
    render(<TeacherApp content={content} api={srv.api} />);
    expect(await screen.findByRole('button', { name: 'Kirish' })).toBeInTheDocument();
    await u.type(screen.getByLabelText('Email'), 'm@m.uz');
    await u.type(screen.getByLabelText('Parol'), 'kuchli-parol-1');
    await u.click(screen.getByRole('button', { name: 'Kirish' }));
    await u.click(await screen.findByText(/11-A — kod/));
    expect(await screen.findByRole('checkbox', { name: /reytingni/ })).toBeInTheDocument();
  });
});
