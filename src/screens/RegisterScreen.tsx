import { useState, type FormEvent } from 'react';
import { BoboAvatar } from '../components/Bobo';
import type { Profile } from '../engine/progress';
import { TIER_LABEL, gradeToTier } from '../engine/rules';

/**
 * Prototipda faqat ism va sinf (qurilmada saqlanadi).
 * Maktab va o'qituvchi beradigan sinf kodi 4-bosqichda (backend) qo'shiladi.
 * Telefon, manzil, familiya so'ralmaydi.
 */
export function RegisterScreen({ onDone }: { onDone(p: Profile): void }) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number | null>(null);
  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 30 && grade !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onDone({ name: trimmed, grade: grade! });
  };

  return (
    <main className="register">
      <div className="register-hero">
        <BoboAvatar size={96} />
        <div>
          <h1>Ipak Yo'li sarguzashti</h1>
          <p className="bubble-static">Assalomu alaykum! Men Hikmat boboman. Ismingni ayt.</p>
        </div>
      </div>
      <form onSubmit={submit} className="register-form">
        <label>
          <span>Isming</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 30))}
            autoComplete="off"
            placeholder="Masalan: Aziza"
            maxLength={30}
          />
        </label>
        <fieldset>
          <legend>Nechanchi sinfda o'qiysan?</legend>
          <div className="grade-grid">
            {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
              <button
                key={g}
                type="button"
                className={grade === g ? 'grade on' : 'grade'}
                aria-pressed={grade === g}
                onClick={() => setGrade(g)}
              >
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
        <button type="submit" className="btn primary big" disabled={!valid}>
          Sayohatni boshlash
        </button>
      </form>
    </main>
  );
}
