import Phaser from 'phaser';
import { MAP_H, MAP_W, type MapNode } from './mapModel';
import { img } from '../../assets';

/**
 * Xarita Phaser 3'da: rasm assetlarisiz, faqat Graphics + Text bilan chiziladi —
 * arzon telefonlarda ham yengil (yuklanadigan rasm 0 KB).
 */
export interface MapHandle {
  destroy(): void;
}

const COLORS = {
  done: 0xf2b134,
  open: 0x1e9fb8,
  soon: 0x7cc6b8,
  locked: 0x9e9e9e,
};

class MapScene extends Phaser.Scene {
  constructor(
    private nodes: MapNode[],
    private onSelect: (id: string) => void,
    /** Fon rasmi brauzerda (CSS) yuklandimi; yuklanmasa — zaxira fon chiziladi. */
    private bgLoaded: Promise<boolean>,
  ) {
    super('map');
  }

  /** Rasmsiz zaxira fon (eski chizilgan xarita). */
  private drawFallback(g: Phaser.GameObjects.Graphics) {
    g.fillGradientStyle(0xbfe3f2, 0xbfe3f2, 0xf3dfb3, 0xf3dfb3, 1);
    g.fillRect(0, 0, MAP_W, MAP_H);
    g.fillStyle(0xa5d67a, 1).fillEllipse(90, 600, 260, 140);
    // O'rmon
    g.fillStyle(0x2e6b3a, 1);
    for (const [x, y] of [[300, 470], [320, 520], [215, 470], [330, 560]] as const) g.fillTriangle(x - 14, y + 18, x + 14, y + 18, x, y - 22);
    // Daryo
    g.fillStyle(0x5cb8e0, 0.85);
    g.beginPath();
    g.moveTo(0, 400); g.lineTo(MAP_W, 370); g.lineTo(MAP_W, 398); g.lineTo(0, 432);
    g.closePath(); g.fillPath();
    // Cho'l barxanlari
    g.fillStyle(0xe7c27d, 1).fillEllipse(300, 330, 140, 40).fillEllipse(200, 312, 90, 22);
    // Tog'lar
    g.fillStyle(0x8d9fb0, 1);
    g.fillTriangle(0, 300, 70, 210, 150, 300).fillTriangle(110, 300, 190, 190, 250, 300);
    g.fillStyle(0xffffff, 1).fillTriangle(55, 230, 70, 210, 85, 230).fillTriangle(172, 214, 190, 190, 206, 214);
    // G'or va qal'a atrofi
    g.fillStyle(0x6d6d78, 1).fillEllipse(285, 200, 120, 70);
    g.fillStyle(0x4a4a58, 1).fillTriangle(110, 120, 180, 40, 250, 120);
  }

  preload() {
    this.load.image('caravan', img.caravan);
  }

  create() {
    const g = this.add.graphics();
    const res = Math.min(2, window.devicePixelRatio || 1);
    const text = (x: number, y: number, s: string, size: number, color = '#3b2a1a') =>
      this.add
        .text(x, y, s, { fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, color, align: 'center' })
        .setOrigin(0.5)
        .setResolution(res);

    void this.bgLoaded.then((ok) => {
      if (ok || !this.sys.isActive()) return;
      const fb = this.add.graphics().setDepth(-2);
      this.drawFallback(fb);
      fb.generateTexture('map-fallback', MAP_W, MAP_H);
      fb.destroy();
      this.add.image(0, 0, 'map-fallback').setOrigin(0, 0).setDepth(-2);
    });
    // Yo'l (nuqtali chiziq)
    const pts = this.nodes.map((n) => new Phaser.Math.Vector2(n.x, n.y));
    if (pts.length > 1) {
      const curve = new Phaser.Curves.Spline(pts);
      const sampled = curve.getSpacedPoints(90);
      g.fillStyle(0xfff3d6, 0.95);
      sampled.forEach((p, i) => i % 2 === 0 && g.fillCircle(p.x, p.y, 4));
      g.fillStyle(0x8a5a2b, 0.9);
      sampled.forEach((p, i) => i % 2 === 0 && g.fillCircle(p.x, p.y, 2.5));
    }

    // Optimallashtirish: yo'l nuqtalari har kadrda qayta chizilmasin — bir marta teksturaga "pishiramiz".
    g.generateTexture('map-bg', MAP_W, MAP_H);
    g.destroy();
    this.add.image(0, 0, 'map-bg').setOrigin(0, 0).setDepth(-1);

    for (const node of this.nodes) {
      const color = COLORS[node.status];
      const ring = this.add.circle(node.x, node.y, 30, 0xffffff, 0.9).setStrokeStyle(4, color);
      const disc = this.add.circle(node.x, node.y, 25, color, node.status === 'locked' ? 0.55 : 1);
      text(node.x, node.y, node.status === 'locked' ? '🔒' : node.icon, 24);
      text(node.x, node.y + 44, `${node.order}. ${node.title}`, 13, node.status === 'locked' ? '#6b6b6b' : '#3b2a1a')
        .setBackgroundColor('rgba(255,255,255,0.75)')
        .setPadding(4, 2, 4, 2);
      if (node.status === 'done') text(node.x + 22, node.y - 22, '⭐', 16);

      disc.setInteractive({ useHandCursor: true }).on('pointerup', () => this.onSelect(node.id));
      ring.setInteractive({ useHandCursor: true }).on('pointerup', () => this.onSelect(node.id));

      if (node.status === 'open') {
        this.tweens.add({ targets: ring, scale: 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      if (node.current) {
        const camel = this.textures.exists('caravan')
          ? this.add.image(node.x - 42, node.y - 18, 'caravan').setDisplaySize(44, 44)
          : text(node.x - 40, node.y - 18, '🐫', 30);
        this.tweens.add({ targets: camel, y: node.y - 24, duration: 600, yoyo: true, repeat: -1 });
      }
    }
  }
}

export function createMap(parent: HTMLElement, nodes: MapNode[], onSelect: (id: string) => void): MapHandle {
  const bgLoaded = new Promise<boolean>((resolve) => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = img.map;
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: MAP_W,
    height: MAP_H,
    transparent: true, // fon rasmini brauzer chizadi (pastda) — aniq va arzon
    backgroundColor: '#f3dfb3',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    fps: { target: 30, limit: 30 }, // batareya va eski telefonlar uchun: 30 kadrdan ortiq chizilmaydi
    banner: false,
    scene: new MapScene(nodes, onSelect, bgLoaded),
  });
  // Tezlik: xarita rasmi canvas'ning CSS foni — brauzer uni ekran aniqligida bir marta chizadi,
  // Phaser esa 360x640 da faqat nuqtalar va animatsiyalarni chizadi (2x Phaser: 13 FPS, bu usul: ~34 FPS).
  game.canvas.style.backgroundImage = `url("${img.map}")`;
  game.canvas.style.backgroundSize = '100% 100%';
  return { destroy: () => game.destroy(true) };
}
