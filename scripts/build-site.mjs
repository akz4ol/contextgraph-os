#!/usr/bin/env node

/**
 * Build script for the ContextGraph OS website
 * Combines the marketing website and mdBook documentation into a single deployable site
 */

import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const websiteDir = join(rootDir, 'website');
const docsDir = join(rootDir, 'docs-site');

console.log('Building ContextGraph OS website...\n');

// Clean dist directory
if (existsSync(distDir)) {
  console.log('Cleaning dist directory...');
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });

// Build mdBook documentation
console.log('Building documentation with mdBook...');
try {
  execSync('mdbook build docs-site', { cwd: rootDir, stdio: 'inherit' });
} catch (error) {
  console.error('Failed to build documentation. Is mdBook installed?');
  console.error('Install with: cargo install mdbook --version 0.4.40');
  process.exit(1);
}

// Copy website files to dist
console.log('\nCopying website files...');
cpSync(websiteDir, distDir, { recursive: true });

// Copy docs to dist/docs
console.log('Copying documentation to /docs...');
const docsBookDir = join(docsDir, 'book');
const distDocsDir = join(distDir, 'docs');
mkdirSync(distDocsDir, { recursive: true });
cpSync(docsBookDir, distDocsDir, { recursive: true });

console.log('\nBuild complete!');
console.log(`Output: ${distDir}`);
console.log('  - Website: /');
console.log('  - Documentation: /docs/');
