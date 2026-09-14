import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const target = new URL(specifier, context.parentURL);

    if (!extname(fileURLToPath(target))) {
      for (const extension of ['.ts', '.tsx']) {
        const candidate = new URL(`${target.href}${extension}`);
        if (existsSync(fileURLToPath(candidate))) {
          return { shortCircuit: true, url: candidate.href };
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
