import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ContentBundle } from '../content/validate';
import { ApiError, type ApiClient, type ClassStats, type TeacherClass } from '../net/api';
import { GAME_LABEL } from '../minigames/registry';

const KEY = 'ipak-yoli:teacher';
const loadToken = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const saveToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

const ERR: Record<string, string> = {
  bad_credentials: "Email yoki parol noto'g'ri.",
  email_taken: "Bu email bilan o'qituvchi allaqachon ro'yxatdan o'tgan.",
  bad_invite: "Taklif kodi noto'g'ri. Uni maktab ma'muriyatidan oling.",
  invalid_input: "Ma'lumotlarni tekshiring (parol kamida 8 belgi).",
  ranking_not_allowed_for_grade: "1-8 sinflar uchun reyting yoqilmaydi (7-14 yoshlilar uchun ommaviy reyting yo'q).",
  too_many_requests: "Juda ko'p urinish. Bir daqiqadan keyin qayta urinib ko'ring.",
  network: "Server bilan aloqa yo'q. Internetni tekshiring.",
  unauthorized: 'Sessiya tugagan. Qayta kiring.',
};
const errText = (e: unknown) => ERR[e instanceof ApiError ? e.code : 'network'] ?? 'Xatolik yuz berdi.';

function Login({ api, onToken }: { api: ApiClient; onToken(t: string): void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ name: '', email: '', password: '', invite: '' });
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r =
        mode === 'login'
          ? await api.teacherLogin({ email: f.email, password: f.password })
          : await api.teacherRegister({ name: f.name, email: f.email, password: f.password, invite: f.invite || undefined });
      onToken(r.token);
    } catch (x) {
      setErr(errText(x));
    }
  };
  const field = (k: keyof typeof f, label: string, type = 'text') => (
    <label>
      <span>{label}</span>
      <input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} autoComplete={k === 'password' ? 'current-password' : 'off'} />
    </label>
  );
  return (
    <main className="teacher narrow">
      <h1>O'qituvchi paneli</h1>
      <form className="register-form" onSubmit={submit}>
        {mode === 'register' && field('name', 'Ism-sharifingiz')}
        {field('email', 'Email', 'email')}
        {field('password', 'Parol', 'password')}
        {mode === 'register' && field('invite', 'Taklif kodi (maktabdan)')}
        {err && <p className="form-error" role="alert">{err}</p>}
        <button type="submit" className="btn primary big">
          {mode === 'login' ? 'Kirish' : "Ro'yxatdan o'tish"}
        </button>
        <button type="button" className="btn ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? "Yangi o'qituvchi? Ro'yxatdan o'tish" : 'Akkauntim bor — kirish'}
        </button>
      </form>
      <p className="muted small">
        <a href="#">← O'yinga qaytish</a>
      </p>
    </main>
  );
}

function ClassView({ api, cls, content, onBack }: { api: ApiClient; cls: TeacherClass; content: ContentBundle; onBack(): void }) {
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const load = useCallback(() => api.stats(cls.id).then(setStats, (e) => setErr(errText(e))), [api, cls.id]);
  useEffect(() => void load(), [load]);

  const taskInfo = useMemo(() => {
    const m = new Map<string, { title: string; level: string; game: string }>();
    for (const t of content.tasks) {
      const level = content.levels.find((l) => l.id === t.level);
      m.set(t.id, { title: t.title, level: level ? `${level.order}. ${level.title}` : t.level, game: GAME_LABEL[t.game].name });
    }
    return m;
  }, [content]);

  if (!stats) return <main className="teacher">{err ? <p className="form-error">{err}</p> : <p>Yuklanmoqda…</p>}</main>;
  const c = stats.class;
  const pct = Math.min(100, Math.round((stats.goal.stars / stats.goal.target) * 100));

  return (
    <main className="teacher">
      <button type="button" className="btn small ghost" onClick={onBack}>
        ← Sinflar
      </button>
      <h1>
        {c.name} <small className="muted">· {c.school} · {c.grade}-sinf</small>
      </h1>
      {err && <p className="form-error" role="alert">{err}</p>}

      <section className="t-card code-card">
        <p>O'quvchilar uchun sinf kodi (doskaga yozing):</p>
        <p className="big-code" aria-label="Sinf kodi">{c.code}</p>
        <button
          type="button"
          className="btn small ghost"
          onClick={() => api.rotateCode(c.id).then(() => load(), (e) => setErr(errText(e)))}
        >
          Kodni yangilash
        </button>
      </section>

      <section className="t-card">
        <h2>Sinf maqsadi</h2>
        <p>
          ⭐ {stats.goal.stars} / {stats.goal.target}
        </p>
        <div className="goal-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
        {c.grade >= 9 ? (
          <label className="toggle">
            <input
              type="checkbox"
              checked={c.rankingEnabled}
              onChange={(e) => api.setRanking(c.id, e.target.checked).then(() => load(), (x) => setErr(errText(x)))}
            />{' '}
            Sinf ichidagi reytingni o'quvchilarga ko'rsatish
          </label>
        ) : (
          <p className="muted small">1-8 sinflarda reyting yo'q — faqat jamoaviy maqsad (rejadagi pedagogik qoida).</p>
        )}
      </section>

      <section className="t-card">
        <h2>O'quvchilar ({stats.students.length})</h2>
        {stats.students.length === 0 ? (
          <p className="muted">Hali hech kim kirmagan. O'quvchilarga kodni bering.</p>
        ) : (
          <table className="t-table">
            <thead>
              <tr>
                <th>Ism</th>
                <th>⭐</th>
                <th>Topshiriq</th>
                <th>Bosqich</th>
                <th>Oxirgi kirish</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stats.students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.stars}</td>
                  <td>{s.tasks}</td>
                  <td>{s.levels}/7</td>
                  <td>{s.lastSeen ? new Date(s.lastSeen).toLocaleDateString('uz-UZ') : '—'}</td>
                  <td>
                    {confirmDel === s.id ? (
                      <>
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={() => api.deleteStudent(c.id, s.id).then(() => (setConfirmDel(null), load()), (e) => setErr(errText(e)))}
                        >
                          O'chirish
                        </button>{' '}
                        <button type="button" className="btn small ghost" onClick={() => setConfirmDel(null)}>
                          Yo'q
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn small ghost" aria-label={`${s.name}ni o'chirish`} onClick={() => setConfirmDel(s.id)}>
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="t-card">
        <h2>Qayerda qiynalishyapti?</h2>
        <p className="muted small">O'rtacha xato eng ko'p topshiriqlar yuqorida.</p>
        {stats.tasks.length === 0 ? (
          <p className="muted">Hali ma'lumot yo'q.</p>
        ) : (
          <table className="t-table">
            <thead>
              <tr>
                <th>Topshiriq</th>
                <th>O'yinchi</th>
                <th>O'rt. xato</th>
                <th>O'rt. ⭐</th>
              </tr>
            </thead>
            <tbody>
              {stats.tasks.slice(0, 15).map((t) => {
                const info = taskInfo.get(t.taskId);
                return (
                  <tr key={t.taskId}>
                    <td>
                      <b>{info?.title ?? t.taskId}</b>
                      <br />
                      <small className="muted">
                        {info?.level} · {info?.game}
                      </small>
                    </td>
                    <td>{t.players}</td>
                    <td>{t.avgMistakes}</td>
                    <td>{t.avgStars}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {stats.ranking && (
        <section className="t-card">
          <h2>Reyting</h2>
          <ol>
            {stats.ranking.map((r) => (
              <li key={r.rank}>
                {r.name} — ⭐ {r.stars}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}

export function TeacherApp({ content, api: base }: { content: ContentBundle; api: ApiClient }) {
  const [token, setToken] = useState<string | null>(loadToken);
  const api = useMemo(() => base.withToken(token), [base, token]);
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [open, setOpen] = useState<TeacherClass | null>(null);
  const [form, setForm] = useState({ name: '', grade: 5, school: '' });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api.classes().then(setClasses, (e) => {
        if (e instanceof ApiError && e.status === 401) {
          saveToken(null);
          setToken(null);
        } else setErr(errText(e));
      }),
    [api],
  );
  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  if (!token)
    return (
      <Login
        api={api}
        onToken={(t) => {
          saveToken(t);
          setToken(t);
        }}
      />
    );
  if (open) return <ClassView api={api} cls={open} content={content} onBack={() => (setOpen(null), void load())} />;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const c = await api.createClass({ name: form.name.trim(), grade: form.grade, school: form.school.trim() });
      setForm({ ...form, name: '' });
      setClasses([...(classes ?? []), c]);
    } catch (x) {
      setErr(errText(x));
    }
  };

  return (
    <main className="teacher">
      <header className="t-head">
        <h1>Sinflarim</h1>
        <button
          type="button"
          className="btn small ghost"
          onClick={() => {
            void api.logout().catch(() => {});
            saveToken(null);
            setToken(null);
          }}
        >
          Chiqish
        </button>
      </header>
      {err && <p className="form-error" role="alert">{err}</p>}
      {classes === null ? (
        <p>Yuklanmoqda…</p>
      ) : (
        <ul className="t-classes">
          {classes.map((c) => (
            <li key={c.id}>
              <button type="button" className="task-card" onClick={() => setOpen(c)}>
                <span className="task-icon" aria-hidden="true">🏫</span>
                <span className="task-text">
                  <b>
                    {c.name} — kod: {c.code}
                  </b>
                  <small>
                    {c.school} · {c.grade}-sinf · {c.students} o'quvchi
                  </small>
                </span>
                <span className="task-go" aria-hidden="true">▶</span>
              </button>
            </li>
          ))}
          {classes.length === 0 && <li className="muted">Hali sinf yo'q. Quyida yarating.</li>}
        </ul>
      )}
      <form className="t-card register-form" onSubmit={create}>
        <h2>Yangi sinf</h2>
        <label>
          <span>Sinf nomi</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: 3-A" maxLength={30} />
        </label>
        <label>
          <span>Sinf (1-11)</span>
          <select value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}>
            {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                {g}-sinf
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Maktab</span>
          <input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="Masalan: 15-maktab, Chilonzor" maxLength={120} />
        </label>
        <button type="submit" className="btn primary" disabled={!form.name.trim() || !form.school.trim()}>
          Sinf yaratish
        </button>
      </form>
    </main>
  );
}
