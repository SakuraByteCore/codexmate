#!/usr/bin/env node

const { execSync } = require('child_process');

const arg = process.argv[2];

const resetCmd = arg ? `npm run reset -- ${arg}` : 'npm run reset';
execSync(resetCmd, { stdio: 'inherit' });
execSync('npm run dev', { stdio: 'inherit' });
