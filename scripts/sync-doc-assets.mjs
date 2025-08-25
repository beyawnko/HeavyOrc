import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', '.github', 'assets', 'banner.svg');
const destDir = resolve(__dirname, '..', 'public', 'assets');
mkdirSync(destDir, { recursive: true });
const dest = resolve(destDir, 'banner.svg');
cpSync(src, dest);
