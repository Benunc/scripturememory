import fs from 'fs';
import path from 'path';

// Read the dist/index.html to find the correct script path
const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
const distIndex = fs.readFileSync(distIndexPath, 'utf-8');

// Extract the script path from the built index.html
const scriptMatch = distIndex.match(/<script type="module" src="([^"]+)"><\/script>/);
if (!scriptMatch) {
  console.error('Could not find script tag in built index.html');
  process.exit(1);
}

const scriptPath = scriptMatch[1];

// Read the production index.html
const prodIndexPath = path.join(process.cwd(), 'index.prod.html');
let prodIndex = fs.readFileSync(prodIndexPath, 'utf-8');

// Replace the script source
prodIndex = prodIndex.replace(
  /<script type="module" src="[^"]+"><\/script>/,
  `<script type="module" src="${scriptPath}"></script>`
);

// Write the updated production index.html
fs.writeFileSync(prodIndexPath, prodIndex);

// Copy to dist
fs.copyFileSync(prodIndexPath, path.join(process.cwd(), 'dist', 'index.html'));

console.log('Updated index.html with correct script path:', scriptPath); 