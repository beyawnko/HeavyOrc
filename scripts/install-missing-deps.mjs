import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
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
  console.log(`Installing missing dependencies: ${missing.join(', ')}`);
  execSync(`npm install ${missing.join(' ')}`, { stdio: 'inherit' });
}
