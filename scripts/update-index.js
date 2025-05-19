import fs from 'fs';
import path from 'path';

// First, copy the production index.html to dist
const prodIndexPath = path.join(process.cwd(), 'index.prod.html');
const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');

// Read the production index.html
let prodIndex = fs.readFileSync(prodIndexPath, 'utf-8');

// Find the main.js file in the dist/assets directory
const assetsDir = path.join(process.cwd(), 'dist', 'assets');
const files = fs.readdirSync(assetsDir);
const mainJsFile = files.find(file => file.startsWith('main.') && file.endsWith('.js'));

if (!mainJsFile) {
  console.error('Could not find main.js file in dist/assets');
  process.exit(1);
}

// Update the script source in the production index.html
prodIndex = prodIndex.replace(
  /<script type="module" src="[^"]+"><\/script>/,
  `<script type="module" src="/assets/${mainJsFile}"></script>`
);

// Write the updated index.html to dist
fs.writeFileSync(distIndexPath, prodIndex);

console.log('Updated index.html with correct script path:', `/assets/${mainJsFile}`); 