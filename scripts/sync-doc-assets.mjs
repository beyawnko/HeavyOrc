import { cpSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..', '.github', 'assets');
const destDir = resolve(__dirname, '..', 'public', 'assets');

cpSync(srcDir, destDir, { recursive: true });

