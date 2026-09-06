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
} catch (e) {}

const app = require('../server');

module.exports = app;
