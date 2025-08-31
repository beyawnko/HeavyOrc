import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

const deps = ['react-virtuoso', 'wasm-feature-detect'];

const missing = deps.filter(dep => {
  try {
    require.resolve(dep);
    return false;
  } catch {
    return true;
  }
});

if (missing.length) {
  const packagesToInstall = missing.map(dep => `"${dep}@${allDeps[dep]}"`).join(' ');
  console.log(`Installing missing dependencies to match package.json: ${missing.join(', ')}`);
  execSync(`npm install ${packagesToInstall} --no-save`, { stdio: 'inherit' });
}
