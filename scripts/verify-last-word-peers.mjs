import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Run through npm so the same npm CLI is used on Windows and Unix.
if (!process.env.npm_execpath) throw new Error('Run npm run verify:stack-peers');
const runtime = ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei',
  '@react-spring/three', '@use-gesture/react', 'motion', 'xstate', '@xstate/react', 'zustand', 'howler'];
const types = ['@types/react', '@types/three', '@types/howler'];
const installed = (names) => Object.fromEntries(names.map((name) => [name,
  JSON.parse(readFileSync(resolve('node_modules', name, 'package.json'), 'utf8')).version]));
const directory = resolve('.tmp/last-word/peer-check');
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'package.json'), JSON.stringify({
  name: 'last-word-peer-check', version: '1.0.0', private: true,
  dependencies: installed(runtime), devDependencies: installed(types),
}, null, 2) + '\n');
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'install',
  '--ignore-scripts', '--legacy-peer-deps=false', '--strict-peer-deps', '--no-audit', '--no-fund'],
{ cwd: directory, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
