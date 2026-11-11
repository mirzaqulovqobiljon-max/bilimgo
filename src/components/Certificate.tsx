import type { Progress } from '../engine/progress';
import { totalStars } from '../engine/progress';
import { TIER_LABEL, gradeToTier } from '../engine/rules';
import { img } from '../assets';

export type CertificateLevel = 'oltin' | 'kumush' | 'bronza';

/** Sertifikat darajasi yulduzlar ulushiga qarab (rejadagi 7-bo'lim: "yulduz — sertifikat darajasi"). */
export function certificateLevel(stars: number, maxStars: number): CertificateLevel {
  const r = maxStars > 0 ? stars / maxStars : 0;
  if (r >= 0.85) return 'oltin';
  if (r >= 0.6) return 'kumush';
  return 'bronza';
}

const LABEL: Record<CertificateLevel, string> = { oltin: 'Oltin', kumush: 'Kumush', bronza: 'Bronza' };

/** O'yin oxirida: chop etiladigan sertifikat. O'qituvchi imzolaydi (rejada shunday). */
export function Certificate({ progress, maxStars, date = new Date() }: { progress: Progress; maxStars: number; date?: Date }) {
  const stars = totalStars(progress);
  const lvl = certificateLevel(stars, maxStars);
  const profile = progress.profile!;
  const print = () => {
    try {
      window.print();
    } catch {
      /* ba'zi oynalarda chop etish bloklangan */
    }
  };
  return (
    <section className={`certificate cert-${lvl}`} aria-label="Sertifikat" style={{ backgroundImage: `url(${img.certificate})` }}>
      <p className="cert-top">Ipak Yo'li sarguzashti</p>
      <h1>SERTIFIKAT</h1>
      <p className="cert-badge">{LABEL[lvl]} daraja</p>
      <p>Ushbu sertifikat</p>
      <p className="cert-name">{profile.name}</p>
      <p>
        ({profile.grade}-sinf, {TIER_LABEL[gradeToTier(profile.grade)]}) ga Bilim kitobini devdan qaytarib,
        7 bosqichli sayohatni muvaffaqiyatli yakunlagani uchun beriladi.
      </p>
      <p className="cert-stars">
        ⭐ {stars} / {maxStars}
      </p>
      <div className="cert-sign">
        <span>Sana: {date.toLocaleDateString('uz-UZ')}</span>
        <span>O'qituvchi imzosi: ____________</span>
      </div>
      <button type="button" className="btn small ghost no-print" onClick={print}>
        🖨️ Chop etish
      </button>
    </section>
  );
}
