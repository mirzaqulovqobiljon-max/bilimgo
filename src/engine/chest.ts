/**
 * Sehrli sandiq: har bir jumboq kodning bitta raqamini (0–9) beradi.
 * Arifmetik jumboqlar ("12 − 8 = ?") avtomatik tekshiriladi — javob yagona va to'g'ri bo'lishi shart.
 */
export interface ChestPuzzle {
  q: string;
  answer: number;
  hint: string;
}

const OPS: Record<string, (a: number, b: number) => number> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '−': (a, b) => a - b,
  '×': (a, b) => a * b,
  x: (a, b) => a * b,
  '*': (a, b) => a * b,
  ':': (a, b) => a / b,
  '÷': (a, b) => a / b,
  '/': (a, b) => a / b,
};

/** "a op b [op c ...] = ?" ko'rinishidagi misolni chapdan o'ngga, ko'paytirish/bo'lish ustuvorligi bilan hisoblaydi. */
export function evalArithmetic(q: string): number | null {
  const m = q.match(/^\s*([0-9+\-−×x*:÷/\s()]+?)\s*=\s*\?\s*$/);
  if (!m) return null;
  const tokens = m[1]!.match(/\d+|[+\-−×x*:÷/]/g);
  if (!tokens || tokens.length < 3 || tokens.length % 2 === 0) return null;
  // ko'paytirish/bo'lishni avval
  const stack: (number | string)[] = [Number(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]!;
    const n = Number(tokens[i + 1]);
    if (!(op in OPS) || Number.isNaN(n)) return null;
    if ('×x*:÷/'.includes(op)) stack.push(OPS[op]!(stack.pop() as number, n));
    else stack.push(op, n);
  }
  let acc = stack[0] as number;
  for (let i = 1; i < stack.length; i += 2) acc = OPS[stack[i] as string]!(acc, stack[i + 1] as number);
  return Number.isFinite(acc) ? acc : null;
}

export function chestProblems(puzzles: readonly ChestPuzzle[]): string[] {
  const out: string[] = [];
  puzzles.forEach((p, i) => {
    const n = `jumboq ${i + 1}`;
    if (!Number.isInteger(p.answer) || p.answer < 0 || p.answer > 9) out.push(`${n}: javob bitta raqam (0–9) bo'lishi kerak`);
    const v = evalArithmetic(p.q);
    if (v !== null && v !== p.answer) out.push(`${n}: misol natijasi ${v}, javob esa ${p.answer}`);
    if (new RegExp(`(^|[^0-9])${p.answer}([^0-9]|$)`).test(p.hint) && /=\s*\d/.test(p.hint)) {
      out.push(`${n}: maslahat javobni oshkor qilyapti`);
    }
  });
  return out;
}

/** Nechta raqam o'z joyida to'g'ri (iliq maslahat uchun — qaysi biri ekanini aytmaymiz). */
export function correctDigits(code: readonly number[], puzzles: readonly ChestPuzzle[]): number {
  return puzzles.reduce((n, p, i) => n + (code[i] === p.answer ? 1 : 0), 0);
}

export const spin = (d: number, delta: 1 | -1) => (d + delta + 10) % 10;
