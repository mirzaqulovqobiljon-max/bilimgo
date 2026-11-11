"""Manifestni TTS to'plamlariga ajratish. Iboralar orasiga paragraf ajratgich qo'yiladi,
keyin audio eng uzun pauzalar bo'yicha qayta bo'linadi (split.py)."""
import json, sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from manifest import build
from speak import speak

VOICES = {
    'bobo': {'voice_id': 'voice_8bae02c6-d078-4757-9d62-0fce6da23cf7', 'speed': 0.9},   # Amir — iliq hikoyachi
    'dev': {'voice_id': 'voice_d8efc948-59f0-4172-bd33-6281f1a048de', 'speed': 1.0},    # Qora Shoh
}
SEP = '\n\n'
LIMIT = 360

def plan(only=None):
    items = [dict(x, speak=speak(x['text'])) for x in build()]
    if only:
        items = [x for x in items if x['id'] in only]
    batches = []
    for voice in VOICES:
        cur = []
        for x in [i for i in items if i['voice'] == voice]:
            if cur and sum(len(c['speak']) + 2 for c in cur) + len(x['speak']) > LIMIT:
                batches.append({'voice': voice, 'items': cur}); cur = []
            cur.append(x)
        if cur:
            batches.append({'voice': voice, 'items': cur})
    for i, b in enumerate(batches):
        b['n'] = i
        b['text'] = SEP.join(x['speak'] for x in b['items'])
        b.update(VOICES[b['voice']])
    return batches

if __name__ == '__main__':
    b = plan()
    json.dump(b, open('/tmp/ovoz-batches.json', 'w'), ensure_ascii=False, indent=1)
    print(len(b), "to'plam;", sum(len(x['items']) for x in b), 'ibora;', sum(len(x['text']) for x in b), 'belgi')
    print(json.dumps({'n': 0, 'voice_id': b[0]['voice_id'], 'speed': b[0]['speed'], 'text': b[0]['text']}, ensure_ascii=False))
