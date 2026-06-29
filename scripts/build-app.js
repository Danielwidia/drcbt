/**
 * Build Script - CBT Dorkas
 * Membuat dist/CBT-Dorkas.exe dan menyalin semua file statis ke dist/APP/
 * Jalankan: node scripts/build-app.js
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const { load } = require('resedit/cjs');
const mysqlMgr = require('../mysql-manager'); // ← Tambahkan manager mysql


const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const APP_DIR = path.join(DIST, 'APP');
const LOCAL_IMAGES_DIR = path.join(ROOT, 'images');

// Warna console
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(color, msg) { console.log(`${color}${msg}${RESET}`); }

async function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function runBuild() {
    // ─── Langkah 1: Buat folder dist dan dist/APP ─────────────────────────────────
    log(BLUE, '\n📁 Menyiapkan folder dist/APP...');
    if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
    if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });

    const DIST_IMAGES_DIR = path.join(APP_DIR, 'images');
    if (!fs.existsSync(DIST_IMAGES_DIR)) fs.mkdirSync(DIST_IMAGES_DIR, { recursive: true });
    if (!fs.existsSync(LOCAL_IMAGES_DIR)) fs.mkdirSync(LOCAL_IMAGES_DIR, { recursive: true });
    
    log(GREEN, '   ✅ Folder dist/APP/ siap');
    log(GREEN, '   ✅ Folder dist/APP/images/ siap');

    // ─── Langkah 2: Copy file statis ke dist/APP ─────────────────────────────────
    log(BLUE, '\n📋 Menyalin file statis ke dist/APP/...');

    const STATIC_FILES = [
        'index.html',
        'admin.html',
        'guru.html',
        'siswa.html',
        'quizz.html',
        'administrasi_guru.html',
        'app.js',
        'wordParser.js',
        'style.css',
        'logo.png',
        '.env',
    ];

    let copiedCount = 0;
    let skippedCount = 0;

    for (const file of STATIC_FILES) {
        const src = path.join(ROOT, file);
        const dest = path.join(APP_DIR, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            log(GREEN, `   ✅ ${file}`);
            copiedCount++;
        } else {
            log(YELLOW, `   ⚠️  ${file} tidak ditemukan, dilewati`);
            skippedCount++;
        }
    }

    log(GREEN, `\n   Disalin: ${copiedCount} file | Dilewati: ${skippedCount} file`);

    // ─── Langkah 3: Sinkronisasi Data & Gambar ────────────────────────────────────
    log(BLUE, '\n🔄 Menyinkronkan data dan melokalisasi gambar...');
    
    // Optionally skip DB initialization (useful for packaging without running MySQL)
    const SKIP_DB = process.env.SKIP_DB === '1' || process.env.SKIP_DB === 'true';
    let sqlDb = null;
    let db = {
        subjects: [],
        rombels: [],
        questions: [],
        students: [{ id: 'ADM', password: 'admin321', name: 'Administrator', role: 'admin' }],
        results: [],
        schedules: [],
        timeLimits: {},
        quizzes: []
    };

    // Load local database from MySQL backend
    let mysqlStartedByBuild = false;
    try {
        if (!SKIP_DB) {
            // Coba jalankan MySQL Portable jika tidak sedang berjalan
            try {
                const busy = await mysqlMgr.isPortBusy();
                if (!busy) {
                    log(YELLOW, '   ℹ️  MySQL tidak terdeteksi, mencoba menjalankan Portable MySQL...');
                    await mysqlMgr.start();
                    mysqlStartedByBuild = true;
                }
            } catch (e) {
                log(YELLOW, '   ⚠️  Gagal menjalankan Portable MySQL otomatis: ' + e.message);
            }

            sqlDb = require('../db');
            if (sqlDb && typeof sqlDb.readDB === 'function') {
                const localData = sqlDb.readDB();
                if (localData) {
                    db = { ...db, ...localData };
                    log(GREEN, '   ✅ Data lokal (MySQL) dimuat');
                }
            } else {
                log(YELLOW, '   ⚠️  Melewati pembacaan MySQL (tidak ada koneksi)');
                sqlDb = null;
            }
        }
    } catch (e) {
        log(RED, '   ❌ Gagal memuat data MySQL: ' + e.message);
        log(YELLOW, '      Mencoba melanjutkan tanpa sinkronisasi DB...');
        sqlDb = null; // Pastikan sqlDb null agar tidak error lagi di akhir
    }

    // Check for Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
        log(YELLOW, '   ℹ️  Supabase terdeteksi, mencoba sinkronisasi...');
        try {
            const supabaseClient = createClient(supabaseUrl, supabaseKey);
            const { data, error } = await supabaseClient
                .from('cbt_database')
                .select('data')
                .eq('id', 1)
                .single();
            
            if (error) throw error;
            if (data && data.data) {
                // Merge data (keep local students if they are admins?) or just replace
                db = { ...db, ...data.data };
                log(GREEN, '   ✅ Data dari Supabase berhasil disinkronkan');
            }
        } catch (e) {
            log(RED, '   ⚠️  Gagal sinkronisasi Supabase: ' + e.message);
            log(YELLOW, '      Menggunakan data lokal yang ada.');
        }
    }

    // Process Images
    log(BLUE, '   🖼️  Memproses gambar soal...');
    let imgCount = 0;
    let downloadCount = 0;

    if (db.questions && Array.isArray(db.questions)) {
        for (const q of db.questions) {
            if (q.images && Array.isArray(q.images)) {
                for (let i = 0; i < q.images.length; i++) {
                    const imgUrl = q.images[i];
                    if (imgUrl && imgUrl.startsWith('http')) {
                        // Remote URL (Supabase storage etc)
                        const fileName = path.basename(imgUrl.split('?')[0]);
                        const dest = path.join(LOCAL_IMAGES_DIR, fileName);
                        
                        // Download if not exists locally
                        if (!fs.existsSync(dest)) {
                            try {
                                await downloadImage(imgUrl, dest);
                                downloadCount++;
                            } catch (e) {
                                log(RED, `      ❌ Gagal download: ${imgUrl} -> ${e.message}`);
                            }
                        }
                        
                        // Localize path in DB (relative to APP root)
                        q.images[i] = `/images/${fileName}`;
                        imgCount++;
                    } else if (imgUrl && imgUrl.startsWith('/images/')) {
                        // Already local reference
                        imgCount++;
                    }
                }
            }
        }
    }

    log(GREEN, `   ✅ ${imgCount} referensi gambar dilokalisasi (${downloadCount} baru diunduh)`);

    // Write final db updates back to the MySQL backend
    try {
        if (!SKIP_DB && sqlDb && typeof sqlDb.writeDB === 'function') {
            sqlDb.writeDB(db);
            log(GREEN, '   ✅ Data ditulis ke MySQL backend');
        } else {
            log(YELLOW, '   ⚠️  Melewati penulisan data ke MySQL (tidak ada koneksi)');
        }
    } catch (e) {
        log(RED, '   ❌ Gagal menulis balik ke MySQL: ' + e.message);
    }

    // Copy ALL images from local images/ to dist/APP/images
    log(BLUE, '\n📁 Menyalin semua gambar ke dist/APP/images...');
    if (fs.existsSync(LOCAL_IMAGES_DIR)) {
        const images = fs.readdirSync(LOCAL_IMAGES_DIR);
        let imageCopiedCount = 0;
        for (const img of images) {
            const src = path.join(LOCAL_IMAGES_DIR, img);
            const dest = path.join(DIST_IMAGES_DIR, img);
            if (fs.statSync(src).isFile()) {
                fs.copyFileSync(src, dest);
                imageCopiedCount++;
            }
        }
        log(GREEN, `   ✅ ${imageCopiedCount} gambar disalin ke dist/APP/images/`);
    }

    // JSON file lama sebagai fallback kosong saja
    const resultsPath = path.join(APP_DIR, 'results.json');
    if (!fs.existsSync(resultsPath)) {
        fs.writeFileSync(resultsPath, '[]', 'utf8');
    }

    log(GREEN, '   ✅ Proses sinkronisasi data dan aset selesai.');
    if (sqlDb && typeof sqlDb.closeDb === 'function') {
        sqlDb.closeDb();
    }

    // ─── Langkah 4: Copy Portable MySQL (jika ada) ─────────────────────────
    log(BLUE, '\n📦 Menyalin Portable MySQL ke dist/APP/mysql...');
    const SRC_MYSQL = path.join(ROOT, 'mysql');
    const DEST_MYSQL = path.join(APP_DIR, 'mysql');

    if (fs.existsSync(SRC_MYSQL)) {
        try {
            // Gunakan fs.cpSync (Node 16.7+) untuk copy rekursif
            if (fs.cpSync) {
                // Hapus folder mysql lama di dist agar benar-benar fresh
                if (fs.existsSync(DEST_MYSQL)) {
                    try { fs.rmSync(DEST_MYSQL, { recursive: true, force: true }); } catch (e) { log(YELLOW, '   ⚠️  Tidak dapat menghapus folder dest mysql (terkunci?), melakukan merge copy...'); }
                }
                
                fs.cpSync(SRC_MYSQL, DEST_MYSQL, { 
                    recursive: true, 
                    force: true,
                    filter: (src) => {
                        // Lewati beberapa file log besar jika ada
                        const name = path.basename(src).toLowerCase();
                        if (name.endsWith('.err') || name.indexOf('mysql-bin') !== -1) return false;
                        return true;
                    }
                });
                log(GREEN, '   ✅ Portable MySQL berhasil disinkronkan ke dist/APP/mysql');
            } else {
                log(YELLOW, '   ⚠️  fs.cpSync tidak tersedia, menyalin menggunakan command shell...');
                if (process.platform === 'win32') {
                    // Pakai robocopy atau xcopy
                    try {
                        execSync(`robocopy "${SRC_MYSQL}" "${DEST_MYSQL}" /MIR /XF *.err *.log /R:0 /W:0`, { stdio: 'ignore' });
                    } catch (e) {
                         // robocopy returns non-zero even on success (exit codes 0-7 are success/info)
                         if (e.status > 7) throw e;
                    }
                }
                log(GREEN, '   ✅ Portable MySQL disinkronkan (via shell)');
            }
        } catch (e) {
            log(RED, '   ❌ Gagal menyalin MySQL: ' + e.message);
            log(YELLOW, '      Tips: Pastikan aplikasi/MySQL tidak sedang berjalan saat proses build ini.');
        }
    } else {
        log(YELLOW, '   ⚠️  Folder mysql tidak ditemukan di root, dilewati');
    }
    
    // Matikan MySQL jika kita yang menjalankannya di awal
    if (mysqlStartedByBuild) {
        log(BLUE, '\n🛑 Menghentikan Portable MySQL...');
        mysqlMgr.stop();
        // Beri waktu sebentar untuk MySQL shutdown
        await new Promise(r => setTimeout(r, 2000));
    }
    
    log(GREEN, '\n✨ Step 1 (build-app) Berhasil!');
    // Paksa keluar agar tidak menggantung handles async (seperti worker threads)
    setTimeout(() => process.exit(0), 500);
}

runBuild().catch(err => {
    log(RED, '\n❌ Terjadi kesalahan sinkronisasi: ' + err.message);
    console.error(err);
    process.exit(1);
});
