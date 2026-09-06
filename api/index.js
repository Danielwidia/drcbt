const fs = require('fs');
const path = require('path');

// Direct fs.existsSync calls at top level so Vercel NFT (Node File Trace)
// statically analyzes and bundles all static assets into the serverless function.
[
    '../index.html',
    '../admin.html',
    '../guru.html',
    '../siswa.html',
    '../quizz.html',
    '../administrasi_guru.html',
    '../app.js',
    '../style.css',
    '../logo.png',
    '../school_logo.png',
    '../favicon.ico'
].forEach(relPath => {
    try {
        const fullPath = path.join(__dirname, relPath);
        fs.existsSync(fullPath);
    } catch (e) {}
});

const app = require('../server');

module.exports = app;
