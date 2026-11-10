import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { BoboProvider } from '../components/BoboProvider';
import { Bobo } from '../components/Bobo';
import { loadContent } from '../content';
import { seededRng } from '../engine/random';

export const content = loadContent();

export function renderWithBobo(ui: ReactNode, opts: { idle?: boolean } = {}) {
  return render(
    <BoboProvider dict={content.bobo} rng={seededRng(1)} idleReminder={opts.idle ?? false}>
      {ui}
      <Bobo />
    </BoboProvider>,
  );
}

export const boboText = () => document.querySelector('.bobo-bubble')?.textContent ?? '';
