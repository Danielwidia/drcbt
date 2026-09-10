/**
 * bundle.js
 * Combines modular JavaScript files in js/ into root app.js and public/app.js
 * Run using: node bundle.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesInOrder = [
  'js/core/app-state.js',
  'js/core/db-sync.js',
  'js/core/ui-helpers.js',
  'js/utils/formatters.js',
  'js/modules/siswa.js',
  'js/modules/guru.js',
  'js/modules/admin.js',
  'js/modules/quizz.js'
];

console.log('🚀 Bundling JS modules into app.js...');

let combinedContent = `/**\n * DR CBT - Combined Application Bundle\n * Generated from modular files in js/\n * Last Built: ${new Date().toISOString()}\n */\n\n`;

filesInOrder.forEach(file => {
  if (fs.existsSync(file)) {
    const fileText = fs.readFileSync(file, 'utf8');
    combinedContent += `\n/* ==================== FILE: ${file} ==================== */\n` + fileText + '\n';
  } else {
    console.warn(`⚠️ Warning: ${file} not found!`);
  }
});

// Write to root app.js
fs.writeFileSync('app.js', combinedContent, 'utf8');
console.log(`✅ Updated app.js (${combinedContent.split('\n').length} lines)`);

// Write to public/app.js if public/ directory exists
if (fs.existsSync('public')) {
  fs.writeFileSync('public/app.js', combinedContent, 'utf8');
  console.log(`✅ Updated public/app.js`);
}

// Verify bundle syntax
try {
  execSync('node --check app.js', { stdio: 'pipe' });
  console.log('🎉 app.js bundle syntax check PASSED!');
} catch (err) {
  console.error('❌ ERROR: Generated app.js has syntax issues!', err.stderr.toString());
  process.exit(1);
}
