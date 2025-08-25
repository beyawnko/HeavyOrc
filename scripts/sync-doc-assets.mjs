import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..', '.github', 'assets');
const destDir = resolve(__dirname, '..', 'public', 'assets');

if (!existsSync(srcDir)) {
  console.warn(`Documentation assets not found at ${srcDir}; skipping sync.`);
} else {
  try {
    rmSync(destDir, { recursive: true, force: true });
    cpSync(srcDir, destDir, { recursive: true });
    console.log(`Synced documentation assets from ${srcDir} to ${destDir}`);
  } catch (err) {
    console.error('Failed to sync documentation assets:', err);
    process.exit(1);
  }
}

