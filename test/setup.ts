// Test environment setup: provides the game's DOM (from index.html) and
// stubs browser APIs that jsdom does not implement (canvas rendering,
// request animation frame).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function createMockContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const target: Record<string, unknown> = { canvas };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string];
      return (..._args: unknown[]) =>
        prop === 'createLinearGradient' ? { addColorStop() {} } : undefined;
    },
    set(obj, prop, value) {
      obj[prop as string] = value;
      return true;
    },
  }) as CanvasRenderingContext2D;
}

HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
): CanvasRenderingContext2D {
  return createMockContext(this);
} as unknown as typeof HTMLCanvasElement.prototype.getContext;

globalThis.requestAnimationFrame = (() => 1) as typeof globalThis.requestAnimationFrame;
globalThis.cancelAnimationFrame = (() => {}) as typeof globalThis.cancelAnimationFrame;

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
document.body.innerHTML = body.replace(/<script\b[\s\S]*?<\/script>/g, '');
