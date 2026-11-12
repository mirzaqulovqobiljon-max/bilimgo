// Faqat sinov/yozib olish uchun: ertakni alohida ochadi (?part=intro|outro). Build'ga kirmaydi.
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import { StoryVideo } from '../../src/story/StoryVideo';
import { INTRO, OUTRO } from '../../src/story/script';

const outro = new URLSearchParams(location.search).get('part') === 'outro';
createRoot(document.getElementById('root')!).render(
  outro ? (
    <StoryVideo script={OUTRO} onDone={() => {}} title="Bilim kitobi qaytdi!" playLabel="▶ Yakunni ko'rish" endLabel="Sertifikatni olish 🏅" ariaLabel="Ertak: o'yin yakuni" />
  ) : (
    <StoryVideo script={INTRO} onDone={() => {}} title="Ipak yo'li sarguzashti" endLabel="Ha, yo'lga chiqamiz! 🐪" ariaLabel="Ertak: o'yin boshlanishi" />
  ),
);
