"""TTS natija fayllarini (vaqt tartibida) manifest iboralariga moslab, MP3 ga o'tkazadi.

Ishlatish: python3 tools/ovoz/import_results.py <natijalar-papkasi> <boshlanish-vaqti-ms> <todo.json> <indekslar: 0-44,85-157,...>
Har bir iboraning davomiyligi matn uzunligiga mosligini tekshiradi (xaritalash siljimasin).
"""
import base64, glob, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'audio' / 'uz'

def parse_ranges(s):
    out = []
    for part in s.split(','):
        a, _, b = part.partition('-')
        out += list(range(int(a), int(b or a) + 1))
    return out

def main(folder, start_ms, todo_path, ranges):
    files = sorted(
        (int(m.group(1)), f) for f in glob.glob(f'{folder}/mcp-voicelab-text_to_speech-*.txt')
        if (m := re.search(r'-(\d{13})-', f)) and int(m.group(1)) >= int(start_ms)
    )
    todo = json.load(open(todo_path))
    idx = parse_ranges(ranges)
    if len(files) != len(idx):
        sys.exit(f'XATO: {len(files)} ta fayl, lekin {len(idx)} ta ibora kutilgan')
    OUT.mkdir(parents=True, exist_ok=True)
    rates, report = [], []
    for (_, f), i in zip(files, idx):
        item = todo[i]
        wav = Path('/tmp/ovoz') / f"{item['id']}.wav"
        wav.parent.mkdir(exist_ok=True)
        wav.write_bytes(base64.b64decode(json.load(open(f))['audio_base64']))
        mp3 = OUT / f"{item['id']}.mp3"
        # mono, 48 kbps, ovoz balandligi tenglashtiriladi (bobo va dev bir xil balandlikda)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11',
                        '-ar', '24000', '-ac', '1', '-b:a', '48k', str(mp3)], check=True)
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(mp3)],
                                   capture_output=True, text=True).stdout)
        rate = len(item['speak']) / dur
        rates.append(rate)
        report.append((i, item, dur, rate))
    med = sorted(rates)[len(rates) // 2]
    bad = [(i, it['speak'], round(d, 1), round(r, 1)) for i, it, d, r in report if not (0.55 * med <= r <= 1.8 * med)]
    print(f'{len(report)} ta MP3 yozildi; o\'rtacha tezlik {med:.1f} belgi/s')
    for b in bad:
        print('  SHUBHALI:', b)
    done_path = ROOT / 'tools' / 'ovoz' / 'done.json'
    done = json.loads(done_path.read_text()) if done_path.exists() else {}
    for i, it, d, r in report:
        done[it['id']] = {'text': it['text'], 'voice': it['voice'], 'file': f"audio/uz/{it['id']}.mp3", 'sec': round(d, 2)}
    done_path.write_text(json.dumps(done, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main(*sys.argv[1:5])
