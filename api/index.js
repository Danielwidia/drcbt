const path = require('path');

// Direct static file references so Vercel NFT traces & includes them in function bundle
const _staticFilesToBundle = [
    path.join(__dirname, '../index.html'),
    path.join(__dirname, '../admin.html'),
    path.join(__dirname, '../guru.html'),
    path.join(__dirname, '../siswa.html'),
    path.join(__dirname, '../quizz.html'),
    path.join(__dirname, '../administrasi_guru.html'),
    path.join(__dirname, '../app.js'),
    path.join(__dirname, '../style.css'),
    path.join(__dirname, '../logo.png'),
    path.join(__dirname, '../school_logo.png'),
    path.join(__dirname, '../favicon.ico')
];

const app = require('../server');

module.exports = app;
