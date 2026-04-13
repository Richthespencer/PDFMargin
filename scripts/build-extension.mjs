import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = resolve(process.cwd());
const distDir = resolve(rootDir, 'dist');
const extensionDir = resolve(rootDir, 'extension');
const outputDir = resolve(rootDir, 'dist-extension');

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} failed with code ${code ?? 'unknown'}`));
    });

    child.on('error', rejectPromise);
  });
}

await run('npm', ['run', 'build']);
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(distDir, outputDir, { recursive: true });
await cp(resolve(extensionDir, 'manifest.json'), resolve(outputDir, 'manifest.json'));
await cp(resolve(extensionDir, 'background.js'), resolve(outputDir, 'background.js'));
await cp(resolve(extensionDir, 'icons'), resolve(outputDir, 'icons'), { recursive: true });
