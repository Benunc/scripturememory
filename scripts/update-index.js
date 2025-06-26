import fs from 'fs';
import path from 'path';

// First, copy the production index.html to dist
const prodIndexPath = path.join(process.cwd(), 'index.prod.html');
const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');

// Read the production index.html
let prodIndex = fs.readFileSync(prodIndexPath, 'utf-8');

// Find the main.js and CSS files in the dist/assets directory
const assetsDir = path.join(process.cwd(), 'dist', 'assets');
const files = fs.readdirSync(assetsDir);
const mainJsFile = files.find(file => file.startsWith('main.') && file.endsWith('.js'));
const cssFiles = files.filter(file => file.endsWith('.css'));

if (!mainJsFile) {
  console.error('Could not find main.js file in dist/assets');
  process.exit(1);
}

// Add CSS links to the head
const cssLinks = cssFiles.map(file => 
  `<link rel="stylesheet" href="/assets/${file}">`
).join('\n    ');

// Update the script source and add CSS links in the production index.html
prodIndex = prodIndex.replace(
  /<script type="module" src="[^"]+"><\/script>/,
  `<script type="module" src="/assets/${mainJsFile}"></script>`
);

// Add CSS links before the script tag
prodIndex = prodIndex.replace(
  /<script type="module"/,
  `${cssLinks}\n    <script type="module"`
);

// Write the updated index.html to dist
fs.writeFileSync(distIndexPath, prodIndex);

