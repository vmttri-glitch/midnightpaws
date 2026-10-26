// Publishes the built web version (dist/) to the gh-pages branch, which GitHub Pages serves.
// Usage: npm run deploy:web   (builds first, then runs this)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'inherit' });
const gitOut = (args, cwd) => execFileSync('git', args, { cwd }).toString().trim();

if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing — run `npm run build` first.');
  process.exit(1);
}

const remote = gitOut(['remote', 'get-url', 'origin']);
const commit = gitOut(['rev-parse', '--short', 'HEAD']);
const work = mkdtempSync(join(tmpdir(), 'midnightpaws-pages-'));

try {
  cpSync('dist', work, { recursive: true });
  writeFileSync(join(work, '.nojekyll'), ''); // serve files as-is (no Jekyll processing)
  git(['init', '-q', '-b', 'gh-pages'], work);
  git(['add', '-A'], work);
  git(['commit', '-q', '-m', `Deploy web build from ${commit}`], work);
  git(['push', '-f', remote, 'gh-pages'], work);
  console.log('Published to gh-pages.');
} finally {
  rmSync(work, { recursive: true, force: true });
}
