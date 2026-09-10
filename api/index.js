const fs = require('fs');
const path = require('path');

// Explicit string literals for Vercel NFT (Node File Trace) AST analyzer
try {
    fs.readFileSync(path.join(__dirname, '../index.html'));
    fs.readFileSync(path.join(__dirname, '../admin.html'));
    fs.readFileSync(path.join(__dirname, '../guru.html'));
    fs.readFileSync(path.join(__dirname, '../siswa.html'));
    fs.readFileSync(path.join(__dirname, '../quizz.html'));
    fs.readFileSync(path.join(__dirname, '../administrasi_guru.html'));
    fs.readFileSync(path.join(__dirname, '../app.js'));
    fs.readFileSync(path.join(__dirname, '../style.css'));
    fs.readFileSync(path.join(__dirname, '../logo.png'));
    fs.readFileSync(path.join(__dirname, '../school_logo.png'));
    fs.readFileSync(path.join(__dirname, '../favicon.ico'));
    fs.readFileSync(path.join(__dirname, '../public/index.html'));
    fs.readFileSync(path.join(__dirname, '../public/app.js'));
    fs.readFileSync(path.join(__dirname, '../public/style.css'));
    fs.readFileSync(path.join(__dirname, '../public/logo.png'));
    fs.readFileSync(path.join(__dirname, '../js/core/app-state.js'));
    fs.readFileSync(path.join(__dirname, '../js/core/db-sync.js'));
    fs.readFileSync(path.join(__dirname, '../js/core/ui-helpers.js'));
    fs.readFileSync(path.join(__dirname, '../js/utils/formatters.js'));
    fs.readFileSync(path.join(__dirname, '../js/modules/admin.js'));
    fs.readFileSync(path.join(__dirname, '../js/modules/guru.js'));
    fs.readFileSync(path.join(__dirname, '../js/modules/quizz.js'));
    fs.readFileSync(path.join(__dirname, '../js/modules/siswa.js'));
} catch (e) {}

const app = require('../server');

module.exports = app;
