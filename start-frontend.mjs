#!/usr/bin/env node
/**
 * Test Case Generator Frontend - Entry Point
 *
 * Run with:
 *     node start-frontend.mjs
 *
 * Or with npm from root:
 *     npm run dev
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, 'frontend');

const dev = spawn('npm', ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true,
});

dev.on('error', (err) => {
  console.error('Failed to start frontend:', err);
  process.exit(1);
});

dev.on('close', (code) => {
  process.exit(code ?? 0);
});
