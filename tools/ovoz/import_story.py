"""Ertak gaplarining TTS natijalarini (vaqt tartibida, story.uz.json tartibida yozilgan) MP3 ga o'tkazadi.

Ishlatish: python3 tools/ovoz/import_story.py <natijalar-papkasi> <boshlanish-vaqti-ms>
Natija fayli yangi formatda (JSON obyekt) ham, eski formatda ([{type,text}] massiv) ham bo'lishi mumkin.
"""
import base64, glob, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
from manifest import slug  # noqa: E402

OUT = ROOT / 'public' / 'audio' / 'uz'


def audio_b64(path):
    raw = open(path).read()
    d = json.loads(raw)
    if isinstance(d, list):
        d = json.loads(next(x['text'] for x in d if 'audio_base64' in x['text']))
    return d['audio_base64']


def main(folder, start_ms):
    story = json.loads((ROOT / 'src' / 'content' / 'story.uz.json').read_text())
    lines = [l for part in ('intro', 'outro') for sc in story[part]['scenes'] for l in sc['lines']]
    files = sorted((int(m.group(1)), f) for f in glob.glob(f'{folder}/mcp-voicelab-text_to_speech-*.txt')
                   if (m := re.search(r'-(\d{13})-', f)) and int(m.group(1)) >= int(start_ms))
    if len(files) != len(lines):
        sys.exit(f'XATO: {len(files)} ta fayl, {len(lines)} ta gap')
    done_path = ROOT / 'tools' / 'ovoz' / 'done.json'
    done = json.loads(done_path.read_text())
    for (_, f), l in zip(files, lines):
        id_ = f"{l['voice']}-{slug(l['text'])}"
        wav = Path('/tmp/ovoz') / f'{id_}.wav'
        wav.parent.mkdir(exist_ok=True)
        wav.write_bytes(base64.b64decode(audio_b64(f)))
        mp3 = OUT / f'{id_}.mp3'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11',
                        '-ar', '24000', '-ac', '1', '-b:a', '48k', str(mp3)], check=True)
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(mp3)],
                                   capture_output=True, text=True).stdout)
        print(f'{dur:5.2f}s  {len(l["text"]) / dur:4.1f} belgi/s  {l["voice"]:4}  {l["text"]}')
        done[id_] = {'text': l['text'], 'voice': l['voice'], 'file': f'audio/uz/{id_}.mp3', 'sec': round(dur, 2)}
    done_path.write_text(json.dumps(done, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main(*sys.argv[1:3])
