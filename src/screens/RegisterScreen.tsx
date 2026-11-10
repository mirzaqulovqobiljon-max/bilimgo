import { useEffect, useState, type FormEvent } from 'react';
import { BoboAvatar } from '../components/Bobo';
import type { Profile } from '../engine/progress';
import { TIER_LABEL, gradeToTier } from '../engine/rules';
import { ApiError, type ApiClient, type ClassInfo } from '../net/api';
import type { Account } from '../net/account';

type Mode = 'checking' | 'choose' | 'code' | 'pick' | 'new' | 'guest';

interface Props {
  onDone(p: Profile, account?: Account): void;
  /** Server bo'lsa — sinf kodi bilan kirish. Bo'lmasa (masalan, internet yo'q) — faqat shu qurilmada. */
  api?: ApiClient;
}

const ERRORS: Record<string, string> = {
  class_not_found: "Bunday sinf topilmadi. Kodni o'qituvchingdan so'ra.",
  name_taken: "Bu ism sinfda bor. Ro'yxatdan o'zingni tanla.",
  invalid_input: 'Ismni faqat harflar bilan yoz.',
  too_many_requests: "Juda ko'p urinish. Bir daqiqa kutib, qayta urin.",
  network: "Internet yo'q. Hozircha \"Faqat shu qurilmada\" o'ynashing mumkin.",
};
const errText = (e: unknown) => ERRORS[e instanceof ApiError ? e.code : 'network'] ?? "Nimadir xato ketdi. Qayta urinib ko'r.";

/**
 * Kirish: sinf kodi (o'qituvchi beradi) + ism. Parol, telefon, manzil so'ralmaydi.
 * Server bo'lmasa — mehmon rejimi: ism va sinf faqat shu qurilmada.
 */
export function RegisterScreen({ onDone, api }: Props) {
  const [mode, setMode] = useState<Mode>(api ? 'checking' : 'guest');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [cls, setCls] = useState<{ class: ClassInfo; students: { id: string; name: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!api) return;
    let alive = true;
    api.available().then((ok) => alive && setMode(ok ? 'choose' : 'guest'));
    return () => {
      alive = false;
    };
  }, [api]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const finishJoin = (r: Awaited<ReturnType<ApiClient['join']>>) =>
    onDone(
      { name: r.student.name, grade: r.student.grade },
      { token: r.token, studentId: r.student.id, name: r.student.name, grade: r.student.grade, className: r.class.name, school: r.class.school },
    );

  const trimmed = name.trim();
  const guestValid = trimmed.length >= 1 && trimmed.length <= 30 && grade !== null;

  const hero = (text: string) => (
    <div className="register-hero">
      <BoboAvatar size={96} />
      <div>
        <h1>Ipak Yo'li sarguzashti</h1>
        <p className="bubble-static">{text}</p>
      </div>
    </div>
  );

  if (mode === 'checking') return <main className="register">{hero('Assalomu alaykum! Bir lahza…')}</main>;

  if (mode === 'choose')
    return (
      <main className="register">
        {hero("Assalomu alaykum! Men Hikmat boboman. Qanday kiramiz?")}
        <div className="register-form">
          <button type="button" className="btn primary big" onClick={() => setMode('code')}>
            🏫 Sinf kodi bilan kirish
          </button>
          <button type="button" className="btn ghost" onClick={() => setMode('guest')}>
            Faqat shu qurilmada o'ynash
          </button>
          <p className="muted small center">
            <a href="#oqituvchi">O'qituvchilar uchun panel</a>
          </p>
        </div>
      </main>
    );

  if (mode === 'code')
    return (
      <main className="register">
        {hero("Sinf kodini yoz. Uni o'qituvching beradi.")}
        <form
          className="register-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run(async () => {
              setCls(await api!.joinInfo(code));
              setMode('pick');
            });
          }}
        >
          <label>
            <span>Sinf kodi</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="Masalan: K7P3QA"
              autoComplete="off"
              autoCapitalize="characters"
              className="code-input"
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn primary big" disabled={busy || code.trim().length < 6}>
            Davom etish
          </button>
          <button type="button" className="btn ghost" onClick={() => setMode('choose')}>
            ← Ortga
          </button>
        </form>
      </main>
    );

  if ((mode === 'pick' || mode === 'new') && cls)
    return (
      <main className="register">
        {hero(mode === 'pick' ? 'Ismingni top va bos.' : 'Ismingni yoz.')}
        <p className="class-line">
          🏫 {cls.class.school}, <b>{cls.class.name}</b>
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {mode === 'pick' ? (
          <div className="register-form">
            <ul className="name-list">
              {cls.students.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="btn name-btn"
                    disabled={busy}
                    onClick={() => void run(async () => finishJoin(await api!.join({ code, studentId: s.id })))}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn primary big" onClick={() => setMode('new')}>
              ✋ Men yangiman
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode('code')}>
              ← Boshqa kod
            </button>
          </div>
        ) : (
          <form
            className="register-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run(async () => finishJoin(await api!.join({ code, name: trimmed })));
            }}
          >
            <label>
              <span>Isming</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} autoComplete="off" placeholder="Masalan: Aziza" />
            </label>
            <button type="submit" className="btn primary big" disabled={busy || !trimmed}>
              Sayohatni boshlash
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode('pick')}>
              ← Ro'yxatga qaytish
            </button>
          </form>
        )}
      </main>
    );

  // guest
  return (
    <main className="register">
      {hero('Assalomu alaykum! Men Hikmat boboman. Ismingni ayt.')}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (guestValid) onDone({ name: trimmed, grade: grade! });
        }}
        className="register-form"
      >
        <label>
          <span>Isming</span>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} autoComplete="off" placeholder="Masalan: Aziza" maxLength={30} />
        </label>
        <fieldset>
          <legend>Nechanchi sinfda o'qiysan?</legend>
          <div className="grade-grid">
            {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
              <button key={g} type="button" className={grade === g ? 'grade on' : 'grade'} aria-pressed={grade === g} onClick={() => setGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        </fieldset>
        {grade !== null && (
          <p className="tier-note">
            Darajang: <b>{TIER_LABEL[gradeToTier(grade)]}</b>
          </p>
        )}
        <button type="submit" className="btn primary big" disabled={!guestValid}>
          Sayohatni boshlash
        </button>
        {api && (
          <button type="button" className="btn ghost" onClick={() => setMode('choose')}>
            ← Ortga
          </button>
        )}
      </form>
    </main>
  );
}
