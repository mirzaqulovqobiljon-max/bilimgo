"""Ekrandagi matnni TTS uchun "o'qiladigan" matnga aylantirish (raqamlar, belgilar, harf nomlari)."""
import re

ONES = ['nol', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"]
TENS = ['', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', "to'qson"]
ORD = {1: 'birinchi', 2: 'ikkinchi', 3: 'uchinchi'}
# O'zbek lotin alifbosidagi harf nomlari
LETTER = {'A': 'a', 'B': 'be', 'D': 'de', 'E': 'e', 'F': 'ef', 'G': 'ge', 'H': 'ha', 'I': 'i', 'J': 'je', 'K': 'ka',
          'L': 'el', 'M': 'em', 'N': 'en', 'O': 'o', 'P': 'pe', 'Q': 'qe', 'R': 'er', 'S': 'es', 'T': 'te', 'U': 'u',
          'V': 've', 'X': 'xa', 'Y': 'ye', 'Z': 'ze', "O'": "o'", "G'": "g'e", 'Sh': 'sha', 'Ch': 'che'}

# Avtomatik aylantirib bo'lmaydigan matnlar uchun qo'lda yozilgan variant
OVERRIDE = {
    'Qatorni davom ettir: 🔴🔵🔴🔵🔴 ...': "Qatorni davom ettir: qizil, ko'k, qizil, ko'k, qizil. Keyingi rang qaysi?",
    '√144 = ?': "Bir yuz qirq to'rtning kvadrat ildizi necha bo'ladi?",
    # dev qisqa savollarni o'ziga xos ohangda so'raydi (ekrandagi matn o'zgarmaydi)
    'Qaysi biri meva?': "Ayt-chi, qaysi biri meva?",
    'Qaysi harf unli?': "Ayt-chi, qaysi harf unli?",
    'DNK eukariot hujayrada asosan qayerda joylashgan?': "De-en-ka eukariot hujayrada asosan qayerda joylashgan?",
}


def num(n: int) -> str:
    if n < 10:
        return ONES[n]
    if n < 100:
        t, o = divmod(n, 10)
        return TENS[t] + (f' {ONES[o]}' if o else '')
    if n < 1000:
        h, r = divmod(n, 100)
        return ('yuz' if h == 1 else f'{ONES[h]} yuz') + (f' {num(r)}' if r else '')
    th, r = divmod(n, 1000)
    return (f'{num(th)} ming') + (f' {num(r)}' if r else '')


def speak(text: str) -> str:
    if text in OVERRIDE:
        return OVERRIDE[text]
    s = text
    # "Bu so'z "B" harfi" -> harf nomi
    s = re.sub(r'"(O\'|G\'|Sh|Ch|[A-Z])" harfi', lambda m: f'"{LETTER[m.group(1)]}" harfi', s)
    # "A, L, K, T, I." — vergul bilan ajratilgan alohida harflar
    s = re.sub(r"\b((?:[A-Z]|Sh|Ch)(?:, (?:[A-Z]|Sh|Ch))+)\.", lambda m: ', '.join(LETTER[x] for x in m.group(1).split(', ')) + '.', s)
    # "a + b = ?" -> "... necha bo'ladi?"
    s = re.sub(r'^(\d+) ([+−×-]) (\d+) = \?$', lambda m: f"{m.group(1)} {m.group(2)} {m.group(3)} necha bo'ladi?", s)
    s = s.replace(' + ', " qo'shuv ").replace(' − ', ' ayiruv ').replace(' × ', ' karra ').replace(' = ', ' teng ')
    s = re.sub(r'(\d+)-(element|sentabr|sinf)', lambda m: f"{ORD.get(int(m.group(1)), num(int(m.group(1))) + 'nchi')} {m.group(2)}", s)
    s = re.sub(r'\d+', lambda m: num(int(m.group())), s)
    # O'zbek imlosi: son + qo'shimcha qo'shib yoziladi (uchta, ikkiga, ikkini); "bir ta" -> "bitta"
    s = re.sub(r"\bbir (ta\w*)", lambda m: 'bit' + m.group(1), s, flags=re.I)
    s = re.sub(r"\b(" + '|'.join(ONES[2:] + TENS[1:]) + r") (ta\w*|ga|ni)\b", lambda m: m.group(1) + m.group(2), s, flags=re.I)
    s = s.replace(' ...', '.').replace('...', '.').replace('"', '').replace(' — ', ', ').replace('—', ',')
    s = re.sub(r'\s+([.,!?])', r'\1', s)
    s = re.sub(r'\s+', ' ', s).strip()
    # har bir gap katta harf bilan
    s = re.sub(r'(^|[.!?] )(\w)', lambda m: m.group(1) + m.group(2).upper(), s)
    return s


if __name__ == '__main__':
    import sys
    sys.path.insert(0, __file__.rsplit('/', 1)[0])
    from manifest import build
    for x in build():
        sp = speak(x['text'])
        if sp != x['text']:
            print(f"{x['text']!r:60} -> {sp}")
