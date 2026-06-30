// Load .env awal dari direktori saat ini
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { parseWordDocument } = require('./wordParser');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const pdf = require('pdf-parse');
// Database: Supabase (cloud). MySQL tidak lagi digunakan.

const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // High limit for standalone build
});
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;
const rootPath = isPkg ? path.join(baseDir, 'APP') : (process.env.VERCEL ? process.cwd() : __dirname);

// Saat berjalan sebagai .exe, re-load .env dari folder APP agar bisa diedit tanpa rebuild
if (isPkg) {
    const envPath = path.join(rootPath, '.env');
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath, override: true });
        console.log(`✅ .env dimuat dari: ${envPath}`);
    } else {
        console.warn(`⚠️  File .env tidak ditemukan di: ${envPath}`);
    }
}

// ─── Logging & Static Middleware ──────────────────────────────────────────────
app.use((req, res, next) => {
    if (!req.url.startsWith('/api') && req.url !== '/' && !req.url.includes('.')) {
        console.log(`[ROUTE] ${req.method} ${req.url}`);
    }
    next();
});

// Explicitly serve /images folder
const imagesPath = path.join(rootPath, 'images');
console.log(`[INIT] Serving /images from: ${imagesPath}`);
app.use('/images', express.static(imagesPath));

// Fallback for AI images that might be in dist/APP/images
const fallbackImagesPath = path.join(baseDir, 'dist', 'APP', 'images');
if (fs.existsSync(fallbackImagesPath) && fallbackImagesPath !== imagesPath) {
    console.log(`[INIT] Serving /images fallback from: ${fallbackImagesPath}`);
    app.use('/images', express.static(fallbackImagesPath));
}

// Serve other static files from APP folder (external in .exe, local in dev)
app.use(express.static(rootPath));

// ─── Environment ──────────────────────────────────────────────────────────────
// Mode: Supabase sebagai database utama (cloud-based).
// Mendukung sinkronisasi otomatis dan backup ke cloud.
let USE_SUPABASE = false; // Default ke false, akan di-set ke true hanya jika Supabase berhasil
let supabase = null;        // Supabase client (dibuat saat dibutuhkan)
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.VERCEL === true;

// Path file lama (masih digunakan sebagai referensi / fallback migrasi)
const LOCAL_DATA = path.join(rootPath, 'database.json');
const LOCAL_RESULTS = path.join(rootPath, 'results.json');
const LOCAL_LIVE_EXAMS = path.join(rootPath, 'live-exams.json');

// Initialize Supabase client
const sb_url = process.env.SUPABASE_URL;
const sb_key = process.env.SUPABASE_KEY;
if (sb_url && sb_key) {
    try {
        supabase = createClient(sb_url, sb_key);
        USE_SUPABASE = true;
        console.log(`💾 Database Mode : Supabase (Cloud Backend)`);
        console.log(`   Project URL  : ${sb_url.split('//')[1]?.split('.')[0] || 'configured'}`);
        console.log(`   ✅ Supabase client initialized successfully`);
    } catch (err) {
        console.error(`❌ Failed to initialize Supabase:`, err.message);
        USE_SUPABASE = false;
        console.log(`💾 Database Mode : Supabase unavailable`);
    }
} else {
    console.warn(`⚠️  SUPABASE_URL dan SUPABASE_KEY belum dikonfigurasi`);
    console.log(`💾 Database Mode : Supabase unavailable`);
}

// Jika database Supabase masih kosong atau belum berisi data awal
async function autoMigrateIfNeeded() {
    console.log('[INIT] autoMigrateIfNeeded start');
    try {
        const RESCUE_FILE = path.join(rootPath, 'cbt_data_rescued.json');

        // SQLite — file tunggal (urutan prioritas)
        const SQLITE_SINGLE_CANDIDATES = [
            path.join(rootPath, 'cbt_data.db'),
            path.join(rootPath, 'cbt_data.db.migrated_backup'),
            path.join(baseDir, 'cbt_data.db'),
        ];

        // SQLite — file terpisah (skema baru)
        const SQLITE_SEPARATE = {
            questions: path.join(rootPath, 'cbt_questions.db'),
            results: path.join(rootPath, 'cbt_results.db'),
            users: path.join(rootPath, 'cbt_users.db'),
        };

        if (!USE_SUPABASE) {
            console.warn('[INIT] Supabase tidak dikonfigurasi; auto-migrasi Supabase dilewati.');
            return;
        }

        const existingDb = await readDB(true);
        const isEmptyDb = !existingDb || !Array.isArray(existingDb.students) || existingDb.students.length === 0;
        if (!isEmptyDb) {
            console.log('[INIT] Supabase database sudah berisi data. Auto-migrasi tidak diperlukan.');
            return;
        }

        console.log('[INIT] Supabase database kosong. Memeriksa file lokal untuk migrasi...');

        if (fs.existsSync(RESCUE_FILE)) {
            console.log('📦 Menemukan file RESCUE JSON, memulihkan dari ' + RESCUE_FILE + '...');
            const rescue = JSON.parse(fs.readFileSync(RESCUE_FILE, 'utf8'));
            await writeDB(rescue);
            console.log('✅ Pemulihan dari RESCUE JSON selesai.');
            return;
        }

        if (fs.existsSync(LOCAL_DATA)) {
            console.log('📦 Menemukan file database.json lokal, melakukan migrasi ke Supabase...');
            const mainDb = JSON.parse(fs.readFileSync(LOCAL_DATA, 'utf8'));
            await writeDB(mainDb);
            if (fs.existsSync(LOCAL_RESULTS)) {
                const results = JSON.parse(fs.readFileSync(LOCAL_RESULTS, 'utf8'));
                if (Array.isArray(results) && results.length > 0) {
                    await writeResults(results);
                    console.log(`   📊 Migrated ${results.length} results dari results.json`);
                }
            }
            console.log('✅ Auto-migrasi dari JSON selesai.');
        }
    } catch (e) {
        console.error('⚠️  Auto-migrasi gagal:', e.message);
    }
}



// ─── Default DB ───────────────────────────────────────────────────────────────
const DEFAULT_DB = {
    subjects: [
        { name: 'Pendidikan Agama', locked: false },
        { name: 'Bahasa Indonesia', locked: false },
        { name: 'Matematika', locked: false },
        { name: 'IPA', locked: false },
        { name: 'IPS', locked: false },
        { name: 'Bahasa Inggris', locked: false }
    ],
    rombels: ['Fase D (Kelas 7)', 'Fase D (Kelas 8)', 'Fase D (Kelas 9)'],
    questions: [],
    students: [{ id: 'ADM', password: 'admin321', name: 'Administrator', role: 'admin' }],
    results: [],
    schedules: [],
    timeLimits: {},
    quizzes: []
};

// ─── Real-time State Manager untuk API Keys ────────────────────────────────────
const realtimeState = {
    lastUpdated: {}, // { teacherId: timestamp }
    apiKeyChanges: {}, // { teacherId: { count, status, timestamp } }
    globalKeyChanges: { timestamp: null, count: 0, status: {} }
};

function updateRealtimeState(type, teacherId = null) {
    const now = new Date().toISOString();
    if (type === 'teacher-key' && teacherId) {
        realtimeState.lastUpdated[teacherId] = now;
        if (!realtimeState.apiKeyChanges[teacherId]) {
            realtimeState.apiKeyChanges[teacherId] = { count: 0, status: {}, timestamp: now };
        }
        realtimeState.apiKeyChanges[teacherId].timestamp = now;
    } else if (type === 'global-key') {
        realtimeState.globalKeyChanges.timestamp = now;
    }
}

// ─── Merge helpers ────────────────────────────────────────────────────────────
function mergeResults(existing = [], incoming = []) {
    const map = new Map();
    const key = r => `${r.studentId || ''}::${r.mapel || ''}::${r.rombel || ''}::${r.date || ''}`;
    existing.forEach(r => map.set(key(r), r));
    incoming.forEach(r => {
        const k = key(r);
        map.set(k, map.has(k) ? Object.assign({}, map.get(k), r) : r);
    });
    return Array.from(map.values());
}

// ─── Document Parsing Helpers ────────────────────────────────────────────────
async function parseBlueprint(fileBuffer, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    let text = "";

    try {
        if (ext === '.docx') {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            text = result.value;
        } else if (ext === '.doc') {
            // .doc (legacy Word) — fallback: baca sebagai plaintext, strip binary chars
            text = fileBuffer.toString('utf8').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ');
        } else if (ext === '.xlsx' || ext === '.xls') {
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                text += `Sheet: ${sheetName}\n` + xlsx.utils.sheet_to_txt(sheet) + "\n";
            });
        } else if (ext === '.pdf') {
            const data = await pdf(fileBuffer);
            text = data.text;
        } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            // Gambar: kirim ke Gemini Vision untuk ekstraksi teks (OCR)
            const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
            const base64Image = fileBuffer.toString('base64');
            text = await extractTextFromImage(base64Image, mimeType);
        } else {
            text = fileBuffer.toString('utf8');
        }
        return text.trim();
    } catch (err) {
        console.error(`Error parsing blueprint (${ext}):`, err.message);
        return "";
    }
}

/**
 * Kirim gambar ke Gemini Vision untuk OCR / ekstraksi teks kisi-kisi
 */
async function extractTextFromImage(base64Data, mimeType) {
    const rawKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    const keys = rawKey.split(',').map(k => k.trim()).filter(k => k);
    if (keys.length === 0) {
        console.warn('[OCR] No Gemini key configured, skipping image OCR.');
        return "[Gambar diunggah, tapi API Key Gemini belum dikonfigurasi untuk membaca isinya]";
    }

    const models = ['gemini-3.5-pro', 'gemini-3.5-flash', 'gemini-3.1-flash', 'gemini-3.1-flash-lite', 'gemini-3.0-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const prompt = "Ini adalah foto atau scan dokumen kisi-kisi / soal ujian. Tolong baca dan ekstrak SELURUH teks yang terlihat dalam gambar ini secara akurat. Jika ada tabel, pertahankan strukturnya. Jangan tambahkan komentar, langsung tulis teks yang ada di gambar saja.";

    for (const model of models) {
        for (const key of keys) {
            console.log(`[OCR] Attempting extraction with model: ${model}`);
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: mimeType, data: base64Data } }
                            ]
                        }]
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    console.log(`[OCR] ✅ Image text extracted (${result.length} chars) via ${model}`);
                    return result;
                }
                const errData = await response.json().catch(() => ({}));
                console.warn(`[OCR] Model ${model} failed: ${response.status} - ${errData.error?.message || ''}`);
            } catch (e) {
                console.error(`[OCR] Fetch error with ${model}:`, e.message);
            }
        }
    }
    return "[Gagal mengekstrak teks dari gambar. Pastikan Gemini API Key sudah dikonfigurasi.]";
}

function normalizeQuestionType(type = '') {
    const t = String(type || '').toLowerCase().trim();
    if (['single', 'pilihan_ganda', 'pg', 'multiple_choice'].includes(t)) return 'single';
    if (['multiple', 'pg_kompleks', 'complex', 'checkbox'].includes(t)) return 'multiple';
    if (['text', 'uraian', 'isian', 'essay', 'short_answer'].includes(t)) return 'text';
    if (['tf', 'boolean', 'benar_salah', 'true_false', 'bs'].includes(t)) return 'tf';
    if (['matching', 'jodohkan', 'pasangkan', 'pairing', 'match'].includes(t)) return 'matching';
    return 'single';
}

/**
 * Robustly normalizes an AI-generated question into the standard format used by the bank soal.
 * This includes statement extraction for TF, answer key mapping, and property verification.
 */
function fullNormalizeQuestion(q, mapel, rombel) {
    if (q.type === 'tf' || (Array.isArray(q.options) && q.options.length <= 2)) {
        console.log(`[NORMALIZE] TF Input: text="${q.text?.substring(0, 50)}...", type=${q.type}, options=${JSON.stringify(q.options)}, correct=${JSON.stringify(q.correct)}`);
    }
    const normalized = { ...q };
    if (normalized.text !== undefined && normalized.text !== null && typeof normalized.text !== 'string') {
        normalized.text = Array.isArray(normalized.text) ? normalized.text.join('\n') : String(normalized.text);
    }

    // Ensure mapel and rombel are set
    if (!normalized.mapel) normalized.mapel = mapel;
    if (!normalized.rombel) normalized.rombel = rombel;

    // Normalize type string
    normalized.type = normalizeQuestionType(normalized.type || 'single');

    // HELPERS
    const cleanOptionText = opt => {
        if (!opt || typeof opt !== 'string') return opt;
        return opt.replace(/^(?:[A-D][\.\)\:\-\s]|[o\-\*]?\s*\[[\s_xX]?\])\s*/i, '').trim();
    };
    const isGenericOption = opt => {
        if (!opt || String(opt).trim() === '') return true;
        const clean = String(opt).replace(/[\[\]\-\(\)\.\–\—\_]/g, '').trim().toLowerCase();
        return /^(benar|salah|true|false|ya|tidak|ok|yes|no|pilihan|option)$/.test(clean);
    };

    const parseBooleanAnswer = (value, options = null) => {
        if (typeof value === 'boolean') return value;

        // If value is a numeric index, check the content of the option at that index
        if (typeof value === 'number' && Array.isArray(options) && options.length > value) {
            const optText = String(options[value]).toLowerCase();
            const isPositive = ['benar', 'true', 'ya', 'yes', 'b', 'betul', 'ok', 'right', 'correct'].some(t => optText.includes(t));
            const isNegative = ['salah', 'false', 'tidak', 'no', 's', 'wrong', 'incorrect'].some(t => optText.includes(t));
            if (isPositive && !isNegative) return true;
            if (isNegative && !isPositive) return false;
            // Fallback for number 1 as true if no clear text match
            if (value === 1) return true;
            if (value === 0) return false; // wait, this is ambiguous. Most systems use 0=false, 1=true.
        }

        if (typeof value === 'number') return value === 1;
        if (value === null || value === undefined) return false;

        const clean = value.toString().trim().toLowerCase().replace(/[\(\)\[\]\.]/g, '');
        if (['benar', 'true', 't', 'ya', 'yes', '1', 'correct', 'right', 'b', 'betul', 'ok'].includes(clean)) return true;
        if (['salah', 'false', 'f', 'tidak', 'no', '0', 'incorrect', 'wrong', 's'].includes(clean)) return false;
        return false;
    };

    // AUTO-DETECT TF: If it's single choice but options are just Benar/Salah
    if (normalized.type !== 'tf' && Array.isArray(normalized.options) && normalized.options.length > 0 && normalized.options.length <= 2) {
        if (normalized.options.every(isGenericOption)) {
            normalized.type = 'tf';
        }
    }

    // Normalize TF (True/False) questions
    if (normalized.type === 'tf') {
        const normalizeOptionList = raw => {
            if (Array.isArray(raw)) {
                return raw.flatMap(item => {
                    if (typeof item === 'string') return item.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
                    if (typeof item === 'boolean') return [item ? "Benar" : "Salah"];
                    return [];
                }).map(s => s.trim()).filter(Boolean);
            }
            if (typeof raw === 'string') {
                return raw.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
            }
            return [];
        };

        const parseStatementsFromText = (textStr) => {
            const statements = [];
            const corrects = [];
            const lines = textStr.split(/\r?\n/).map(l => l.trim()).filter(l => l);
            for (const line of lines) {
                // If the line is JUST a generic option like "Benar" or "[ ] Salah", ignore it as a statement
                if (isGenericOption(line)) continue;

                const match = line.match(/^(?:pernyataan\s*\d*\s*[:\-–]\s*|(?:\d+\.|\-|\*)?\s*)(.+?)\s*(?:[\-:–]\s*(Benar|Salah|True|False|T|F|Ya|Tidak|Yes|No|B|S|Betul)|\((Benar|Salah|True|False|T|F|Ya|Tidak|Yes|No|B|S|Betul)\))?\s*$/i);
                if (match) {
                    const stmt = match[1].trim();
                    const answerRaw = match[2] || match[3] || '';
                    if (stmt && !/^(benar atau salah|pilihlah|berikut ini|instruksi|tentukan)/i.test(stmt) && !isGenericOption(stmt)) {
                        statements.push(stmt);
                        corrects.push(answerRaw ? parseBooleanAnswer(answerRaw) : null);
                    }
                }
            }
            return { statements, corrects };
        };

        normalized.options = normalizeOptionList(normalized.options);

        if (normalized.options.length === 1 && /\r?\n/.test(normalized.options[0])) {
            normalized.options = normalized.options[0].split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
        }

        // Detect embedded answers in options
        if (normalized.options.length > 0) {
            const parsedOptions = [];
            const parsedCorrects = [];
            for (const opt of normalized.options) {
                const match = opt.match(/^(.+?)\s*(?:[\-:–]\s*|\()?(Benar|Salah|True|False|T|F|Ya|Tidak|Yes|No|Betul)\)?$/i);
                if (match) {
                    parsedOptions.push(match[1].trim());
                    parsedCorrects.push(parseBooleanAnswer(match[2] || match[3]));
                } else {
                    parsedOptions.push(opt);
                    // Preservation logic: use original correct if available
                    let fallback = false;
                    if (Array.isArray(normalized.correct) && normalized.correct.length > parsedOptions.length - 1) {
                        fallback = parseBooleanAnswer(normalized.correct[parsedOptions.length - 1], q.options);
                    } else if (!Array.isArray(normalized.correct) && normalized.correct !== undefined && normalized.correct !== null) {
                        if (parsedOptions.length === 1) fallback = parseBooleanAnswer(normalized.correct, q.options);
                    }
                    parsedCorrects.push(fallback);
                }
            }
            normalized.options = parsedOptions;

            // Only overwrite if we found actual embedded answers or if original is missing/invalid
            const foundEmbedded = parsedCorrects.some((_, idx) => {
                const originalOpt = Array.isArray(q.options) ? q.options[idx] : null;
                if (typeof originalOpt !== 'string') return false;
                return /(Benar|Salah|True|False|T|F|Ya|Tidak|Yes|No|Betul)\)?$/i.test(originalOpt);
            });

            if (foundEmbedded || !Array.isArray(normalized.correct) || normalized.correct.length !== parsedCorrects.length) {
                normalized.correct = parsedCorrects;
            }
        }

        // Clean up statements and remove generic ones
        if (Array.isArray(normalized.options)) {
            normalized.options = normalized.options
                .map(opt => typeof opt === 'string' ? opt.replace(/^(?:pernyataan\s*\d*\s*[:\-–]\s*|(?:\d+\.|\-|\*)\s+)/i, '').trim() : opt)
                .filter(opt => !isGenericOption(opt));
        }

        const defaultTfInstruction = 'Tentukan apakah pernyataan berikut Benar atau Salah:';
        const optionsAreEmptyOrGeneric = !normalized.options || normalized.options.length === 0 || normalized.options.every(isGenericOption);

        if (optionsAreEmptyOrGeneric && normalized.text && typeof normalized.text === 'string' && normalized.text.length > 5) {
            const { statements, corrects } = parseStatementsFromText(normalized.text);
            if (statements.length > 0) {
                normalized.options = statements;
                const finalCorrects = [];
                const originalHasArray = Array.isArray(normalized.correct);
                const originalValue = normalized.correct;
                for (let i = 0; i < statements.length; i++) {
                    if (corrects[i] !== null) finalCorrects.push(corrects[i]);
                    else if (originalHasArray && originalValue.length > i) finalCorrects.push(parseBooleanAnswer(originalValue[i], q.options));
                    else if (!originalHasArray && originalValue !== undefined && originalValue !== null) {
                        if (i === 0) finalCorrects.push(parseBooleanAnswer(originalValue, q.options));
                        else finalCorrects.push(false);
                    }
                    else finalCorrects.push(false);
                }
                normalized.correct = finalCorrects;
                normalized.text = defaultTfInstruction;
            } else if (typeof normalized.text === 'string' && normalized.text.length > 10) {
                // If it's a single long text that doesn't look like an instruction, it's the statement
                const cleanStmt = normalized.text.replace(/^pernyataan\s*[:\-–]\s*/i, '').replace(/^(\d+\.|\-|\*)\s*/, '').trim();
                const isInstruction = /^(benar atau salah|pilihlah|berikut ini|instruksi|tentukan|pilih satu)/i.test(cleanStmt);

                if (!isInstruction && cleanStmt.length > 5) {
                    normalized.options = [cleanStmt];
                    normalized.text = defaultTfInstruction;
                    const singleCorrect = Array.isArray(normalized.correct) ? normalized.correct[0] : normalized.correct;
                    normalized.correct = [parseBooleanAnswer(singleCorrect !== undefined ? singleCorrect : false, q.options)];
                }
            }
        }

        if (!normalized.text || (typeof normalized.text === 'string' && normalized.text.trim() === '') || isGenericOption(normalized.text)) {
            normalized.text = defaultTfInstruction;
        }

        if (!Array.isArray(normalized.correct)) {
            const scalarVal = (normalized.correct !== undefined && normalized.correct !== null) ? parseBooleanAnswer(normalized.correct) : false;
            normalized.correct = normalized.options.map((_, i) => i === 0 ? scalarVal : false);
        } else if (normalized.correct.length !== normalized.options.length) {
            const correctLength = normalized.correct.length;
            const optionsLength = normalized.options.length;
            if (optionsLength > 0) {
                if (correctLength < optionsLength) {
                    normalized.correct = [...normalized.correct, ...Array(optionsLength - correctLength).fill(false)];
                } else {
                    normalized.correct = normalized.correct.slice(0, optionsLength);
                }
            }
        }
        normalized.correct = normalized.correct.map(val => parseBooleanAnswer(val, q.options));
        console.log(`[NORMALIZE] TF Output: type=${normalized.type}, options=${JSON.stringify(normalized.options)}, correct=${JSON.stringify(normalized.correct)}`);
    }

    // Normalize Single and Multiple Choice to exactly 4 options
    if (normalized.type === 'multiple' || normalized.type === 'single') {
        if (!Array.isArray(normalized.options)) normalized.options = [];
        if (normalized.options.length !== 4) {
            if (normalized.options.length > 4) {
                normalized.options = normalized.options.slice(0, 4);
            } else {
                while (normalized.options.length < 4) normalized.options.push(`Pilihan ${String.fromCharCode(65 + normalized.options.length)}`);
            }
        }
        // Clean each option from markers like [ ] or [x]
        normalized.options = normalized.options.map(cleanOptionText);

        if (normalized.type === 'multiple') {
            if (!Array.isArray(normalized.correct)) normalized.correct = [normalized.correct];
            // Ensure indices are within 0-3 range
            normalized.correct = normalized.correct
                .map(c => typeof c === 'string' ? parseInt(c) : c)
                .filter(c => typeof c === 'number' && c >= 0 && c <= 3);

            if (normalized.correct.length < 2) {
                const available = [0, 1, 2, 3].filter(i => !normalized.correct.includes(i));
                while (normalized.correct.length < 2 && available.length > 0) {
                    normalized.correct.push(available.splice(Math.floor(Math.random() * available.length), 1)[0]);
                }
            } else if (normalized.correct.length > 3) {
                normalized.correct = normalized.correct.slice(0, 3);
            }
        } else if (normalized.type === 'single') {
            let correctIndex = parseInt(normalized.correct);
            if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = 0;
            normalized.correct = correctIndex;
        }
    }

    // Normalize Matching
    if (normalized.type === 'matching') {
        const normalizeMatchingItem = raw => {
            if (raw === undefined || raw === null) return '';
            let text = String(raw).trim();
            const labelMatch = text.match(/^(?:[A-Ea-e]|\d+)\s*[\.\)\-:]\s*(.+)$/);
            if (labelMatch) {
                text = labelMatch[1].trim();
            }
            return text;
        };

        const extractMatchingIndex = raw => {
            if (raw === undefined || raw === null) return null;
            const value = String(raw).trim();
            const letterOnly = value.match(/^[A-Ea-e]$/);
            if (letterOnly) return letterOnly[0].toUpperCase().charCodeAt(0) - 65;
            const numericOnly = value.match(/^\d+$/);
            if (numericOnly) return parseInt(numericOnly[0], 10) - 1;
            const pairMatch = value.match(/^(?:\d+)\s*[-:]\s*([A-Ea-e])$/) || value.match(/^[A-Ea-e]\s*[-:]\s*(\d+)$/);
            if (pairMatch) {
                const token = pairMatch[1];
                if (/^[A-Ea-e]$/.test(token)) return token.toUpperCase().charCodeAt(0) - 65;
                const num = parseInt(token, 10);
                return Number.isNaN(num) ? null : num - 1;
            }
            return null;
        };

        const normalizeMatchingArray = arr => Array.isArray(arr) ? arr.map(normalizeMatchingItem).filter(v => v !== '') : [];
        normalized.questions = normalizeMatchingArray(normalized.questions);
        normalized.answers = normalizeMatchingArray(normalized.answers);

        if (Array.isArray(normalized.correct)) {
            normalized.correct = normalized.correct.map(normalizeMatchingItem).filter(v => v !== '');
        } else if (typeof normalized.correct === 'string' && normalized.correct.trim()) {
            normalized.correct = [normalizeMatchingItem(normalized.correct)];
        } else {
            normalized.correct = Array.isArray(normalized.correct) ? normalized.correct : [];
        }

        if (normalized.answers.length > 0 && normalized.correct.length > 0) {
            const mappedCorrect = normalized.correct.map(item => {
                const index = extractMatchingIndex(item);
                if (index !== null && normalized.answers[index] !== undefined) {
                    return normalizeMatchingItem(normalized.answers[index]);
                }
                return normalizeMatchingItem(item);
            });
            const mappedHasUsefulChange = mappedCorrect.some((item, idx) => item && item !== normalizeMatchingItem(normalized.correct[idx]));
            if (mappedHasUsefulChange) normalized.correct = mappedCorrect;
        }

        if (normalized.answers.length === 0 && normalized.correct.length > 0) {
            normalized.answers = [...new Set(normalized.correct)];
        }

        if ((normalized.answers.length === 0 || normalized.answers.every(a => !a || a.trim() === '')) && Array.isArray(normalized.options) && normalized.options.length > 0) {
            normalized.options = normalized.options.filter(opt => !/^[A-Ea-e]?\s*[\.\s]*\d+[-\s]*[A-Ea-e](?:[,\s]+\d+[-\s]*[A-Ea-e])*$/i.test(String(opt).trim()));
        }

        const isSelectedPattern = str => /^[A-E]?[-\.\s]*\d+[-\s]*[A-E](?:[,\s]+\d+[-\s]*[A-E])*$/i.test(String(str).trim());

        // Filter out MCQ selection patterns from options if the type is matching
        if (Array.isArray(normalized.options)) {
            normalized.options = normalized.options.filter(opt => !isSelectedPattern(opt));
        }

        // If questions/answers are missing but options exist, try to parse from remaining options
        if ((!normalized.questions || normalized.questions.length === 0) && Array.isArray(normalized.options) && normalized.options.length > 0) {
            normalized.questions = [];
            normalized.answers = [];
            normalized.options.forEach(opt => {
                const parts = String(opt).split(/[|:=]/); // split by |, :, or =
                if (parts.length >= 2) {
                    normalized.questions.push(parts[0].trim());
                    normalized.answers.push(parts[1].trim());
                } else if (opt && opt.trim() !== '' && !isSelectedPattern(opt)) {
                    normalized.questions.push(opt.trim());
                    normalized.answers.push('');
                }
            });
        }

        // HEURISTIC: If questions/answers still empty (or answers all empty), try to extract from text
        const answersAllEmpty = normalized.answers.length > 0 && normalized.answers.every(a => !a || a.trim() === '');
        if ((!normalized.questions || normalized.questions.length === 0 || answersAllEmpty) && typeof normalized.text === 'string') {
            const cleanText = normalized.text.replace(/<br\s*\/?>/gi, '\n');
            const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const leftItems = [];
            const rightItems = [];
            let inLeft = false;
            let inRight = false;

            lines.forEach(line => {
                const lower = line.toLowerCase();
                // Broader detection for columns
                if (lower.includes('(kiri)') || lower.includes('kolom a') || lower.includes('bagian 1') || lower.includes('pernyataan') || lower.includes('soal')) {
                    inLeft = true; inRight = false; return;
                }
                if (lower.includes('(kanan)') || lower.includes('kolom b') || lower.includes('bagian 2') || lower.includes('jawaban') || lower.includes('kunci') || lower.includes('pilihan rima')) {
                    inLeft = false; inRight = true; return;
                }

                // Try to detect list items like "1. Pantun" or "- Syair"
                const itemMatch = line.match(/^(?:\d+[\.\)]|[A-Z][\.\)]|[\-\*])\s*(.+)$/);
                const content = itemMatch ? itemMatch[1].trim() : line;

                if (content && content.length > 1 && !isSelectedPattern(content) && !content.toLowerCase().startsWith('jodohkan')) {
                    if (inLeft) leftItems.push(content);
                    else if (inRight) rightItems.push(content);
                }
            });

            if (leftItems.length > 0) {
                normalized.questions = leftItems;
                normalized.answers = rightItems;
                // If answers still empty but we have many items in left, maybe they are all there?
                if (rightItems.length === 0 && leftItems.length >= 4) {
                    const mid = Math.ceil(leftItems.length / 2);
                    normalized.questions = leftItems.slice(0, mid);
                    normalized.answers = leftItems.slice(mid);
                }
            }
        }

        // Final fallback: if questions is long and answers is empty or all-empty, split it
        const hasNoRealAnswers = normalized.answers.length === 0 || normalized.answers.every(a => !a || a.trim() === '');
        if (normalized.questions.length >= 4 && hasNoRealAnswers) {
            const mid = Math.ceil(normalized.questions.length / 2);
            const pool = [...normalized.questions];
            normalized.questions = pool.slice(0, mid);
            normalized.answers = pool.slice(mid);
        }

        if (!Array.isArray(normalized.questions)) normalized.questions = [];
        if (!Array.isArray(normalized.answers)) normalized.answers = [];

        // Correct recovery
        if (!Array.isArray(normalized.correct) || normalized.correct.length === 0 || normalized.correct.every(c => !c)) {
            normalized.correct = (normalized.answers.length >= normalized.questions.length) ?
                normalized.answers.slice(0, normalized.questions.length) :
                [...(normalized.answers), ...Array(Math.max(0, normalized.questions.length - normalized.answers.length)).fill('')];
        }

        // If correct contains numbers (indices), map them to strings from answers
        normalized.correct = normalized.correct.map((c, idx) => {
            if (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))) {
                const cIdx = parseInt(c);
                if (!isNaN(cIdx) && normalized.answers[cIdx] !== undefined) {
                    return normalized.answers[cIdx];
                }
            }
            return String(c);
        });

        // Ensure correct length matches questions length
        if (normalized.correct.length !== normalized.questions.length) {
            const qLen = normalized.questions.length;
            if (normalized.correct.length < qLen) {
                const padding = Array(qLen - normalized.correct.length).fill(normalized.answers[0] || '');
                normalized.correct = [...normalized.correct, ...padding];
            } else {
                normalized.correct = normalized.correct.slice(0, qLen);
            }
        }
    }

    // Normalize Essay / Uraian
    if (normalized.type === 'text') {
        // AI might put the answer in various fields
        if (normalized.correct === undefined || normalized.correct === null || (typeof normalized.correct === 'string' && normalized.correct.trim() === '')) {
            const possibleAnswerFields = ['answer', 'jawaban', 'response', 'ref_answer', 'reference_answer', 'key'];
            for (const field of possibleAnswerFields) {
                if (normalized[field] !== undefined && normalized[field] !== null && String(normalized[field]).trim() !== '') {
                    normalized.correct = String(normalized[field]).trim();
                    break;
                }
            }
        }

        // Ensure options is an empty array for text type
        normalized.options = [];

        // Ensure correct is a string
        if (normalized.correct === undefined || normalized.correct === null) {
            normalized.correct = '';
        } else if (typeof normalized.correct !== 'string') {
            normalized.correct = String(normalized.correct);
        }
    }

    if (!normalized.images || !Array.isArray(normalized.images)) {
        if (normalized.images && typeof normalized.images === 'string') {
            normalized.images = [normalized.images];
        } else {
            normalized.images = [];
        }
    }

    // Ensure all elements in images are strings
    normalized.images = normalized.images.filter(img => img && typeof img === 'string');

    if (!normalized.text) normalized.text = '';
    if (typeof normalized.text !== 'string') normalized.text = String(normalized.text);

    return normalized;
}

// ─── Data Layer (Supabase Native + Fallback) ──────────────────────────────────

// Maximum number of results fetched per query (prevents statement timeout on large tables)
const RESULT_FETCH_LIMIT = parseInt(process.env.RESULT_FETCH_LIMIT || '10000', 10);

/**
 * Retry a Supabase async call up to `maxAttempts` times.
 * Backs off on statement-timeout errors (code 57014).
 */
async function withRetry(fn, label = 'supabase', maxAttempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            const isTimeout = e && (e.code === '57014' || (e.message && e.message.includes('statement timeout')));
            if (isTimeout && attempt < maxAttempts) {
                const delay = attempt * 1500; // 1.5s, 3s
                console.warn(`[${label}] Statement timeout (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                break;
            }
        }
    }
    throw lastError;
}

async function readDB(loadAll = true) {
    if (!USE_SUPABASE) {
        throw new Error('Supabase is not configured');
    }

    try {
        const { data, error } = await supabase
            .from('cbt_database')
            .select('data')
            .eq('id', 1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Supabase readDB error:', error);
            return {
                ...DEFAULT_DB,
                globalSettings: { apiKeys: [] },
                error: error.message
            };
        }

        let dbObj = data ? data.data : null;
        if (!dbObj) {
            dbObj = { ...DEFAULT_DB, globalSettings: { apiKeys: [] } };
            const { error: upsertError } = await supabase
                .from('cbt_database')
                .upsert({ id: 1, data: dbObj, updated_at: new Date() });
            if (upsertError) {
                console.warn('[readDB] Failed to create default Supabase row:', upsertError.message);
            }
        }

        try {
            const results = await withRetry(() => readResults(), 'readResults');
            dbObj.results = results || [];
        } catch (e) {
            const isTimeout = e && (e.code === '57014' || (e.message && e.message.includes('statement timeout')));
            console.error(`Error fetching results in readDB (${isTimeout ? 'TIMEOUT' : e.code || 'ERR'}):`, e.message);
            if (isTimeout) {
                console.warn('[readDB] Results query timed out — returning empty results array.');
            }
            if (!dbObj.results) dbObj.results = [];
        }

        return dbObj;
    } catch (e) {
        console.error('Supabase readDB exception:', e.message);
        return {
            ...DEFAULT_DB,
            globalSettings: { apiKeys: [] },
            error: e.message
        };
    }
}

async function writeDB(obj) {
    if (!USE_SUPABASE) {
        throw new Error('Supabase is not configured');
    }

    const { error } = await supabase
        .from('cbt_database')
        .upsert({ id: 1, data: obj, updated_at: new Date() });
    if (error) throw new Error('Supabase writeDB error: ' + error.message);
}

async function getConfigValue(key) {
    if (!USE_SUPABASE) {
        throw new Error('Supabase is not configured');
    }

    try {
        const db = (await readDB(true)) || {};
        if (db && typeof db === 'object') {
            if (key === 'school_settings' || key === 'schoolSettings') {
                return db.schoolSettings || {};
            }
            if (db.globalSettings && Object.prototype.hasOwnProperty.call(db.globalSettings, key)) {
                return db.globalSettings[key];
            }
            if (Object.prototype.hasOwnProperty.call(db, key)) {
                return db[key];
            }
        }
    } catch (e) {
        console.error('[config] failed to read from Supabase:', e.message);
    }

    return undefined;
}

async function setConfigValue(key, value) {
    if (!USE_SUPABASE) {
        throw new Error('Supabase is not configured');
    }

    const db = (await readDB(true)) || { ...DEFAULT_DB, globalSettings: { apiKeys: [] } };
    if (!db.globalSettings || typeof db.globalSettings !== 'object') db.globalSettings = {};
    if (key === 'school_settings' || key === 'schoolSettings') {
        db.schoolSettings = { ...(db.schoolSettings || {}), ...(value || {}) };
    } else {
        db.globalSettings[key] = value;
    }
    await writeDB(db);
    return true;
}

async function readResults(options = {}) {
    if (USE_SUPABASE) {
        try {
            let query = supabase
                .from('cbt_results')
                .select('data');

            if (options.studentId) query = query.eq('student_id', options.studentId);
            if (options.mapel) query = query.eq('mapel', options.mapel);
            if (options.rombel) query = query.eq('rombel', options.rombel);

            const limit = Number.isFinite(options.limit) ? options.limit : RESULT_FETCH_LIMIT;
            const offset = Number.isFinite(options.offset) ? options.offset : 0;
            const maxLimit = limit === -1 ? RESULT_FETCH_LIMIT : Math.max(1, limit);
            const rangeEnd = offset + maxLimit - 1;

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(maxLimit)
                .range(offset, rangeEnd);

            if (error) {
                const message = String(error.message || '').toLowerCase();
                const isMissingTable = error.code === 'PGRST116' || message.includes('not found') || message.includes('does not exist') || message.includes('could not find');
                if (isMissingTable) {
                    console.warn('[readResults] Supabase results table missing, returning empty array');
                    return [];
                }
                throw error;
            }

            return Array.isArray(data) ? data.map(row => row.data) : [];
        } catch (e) {
            console.error('[readResults] Supabase error:', e.message);
            return [];
        }
    }
    return [];
}

async function writeResults(results) {
    if (USE_SUPABASE) {
        const toDelete = results.filter(r => r.deleted === true);
        const active = results.filter(r => r.deleted !== true);

        if (toDelete.length > 0) {
            console.log(`🗑️ Deleting ${toDelete.length} results from Supabase...`);
            for (const r of toDelete) {
                const { error } = await supabase
                    .from('cbt_results')
                    .delete()
                    .match({
                        student_id: r.studentId || '',
                        mapel: r.mapel || '',
                        rombel: r.rombel || '',
                        date: r.date || ''
                    });
                if (error) console.error('Supabase deletion error:', error.message);
            }
        }

        if (active.length > 0) {
            for (const r of active) {
                const record = {
                    student_id: r.studentId || '',
                    mapel: r.mapel || '',
                    rombel: r.rombel || '',
                    date: r.date || new Date().toISOString(),
                    score: typeof r.score === 'string' ? parseFloat(r.score) : (r.score || 0),
                    data: r
                };

                const { data: existing, error: fetchError } = await supabase
                    .from('cbt_results')
                    .select('id')
                    .match({
                        student_id: record.student_id,
                        mapel: record.mapel,
                        rombel: record.rombel,
                        date: record.date
                    })
                    .maybeSingle();

                if (fetchError) {
                    throw new Error(`Supabase lookup error: ${fetchError.message}`);
                }

                if (existing) {
                    const { error } = await supabase.from('cbt_results').update(record).eq('id', existing.id);
                    if (error) throw new Error(`Supabase update error for student ${record.student_id}: ${error.message}`);
                } else {
                    const { error } = await supabase.from('cbt_results').insert(record);
                    if (error) throw new Error(`Supabase insert error for student ${record.student_id}: ${error.message}`);
                }
            }
        }
        return;
    }
    throw new Error('Supabase is not configured');
}

async function readLiveExams() {
    if (USE_SUPABASE) {
        try {
            const { data, error } = await supabase
                .from('cbt_live_exams')
                .select('data');
            if (error) {
                const message = String(error.message || '').toLowerCase();
                const isMissingTable = error.code === 'PGRST116' || message.includes('not found') || message.includes('does not exist') || message.includes('could not find') || message.includes('schema cache');
                if (isMissingTable) {
                    console.warn('[readLiveExams][Supabase] Table not found, returning empty array');
                    return [];
                }
                console.error('[readLiveExams][Supabase] Error:', error.message);
                return [];
            }
            return Array.isArray(data) ? data.map(row => row.data) : [];
        } catch (e) {
            console.error('[readLiveExams] Exception:', e.message);
            return [];
        }
    }
    return [];
}

async function writeLiveExams(liveExams) {
    if (USE_SUPABASE) {
        for (const exam of liveExams) {
            const record = {
                student_id: exam.studentId || '',
                mapel: exam.mapel || '',
                rombel: exam.rombel || '',
                updated_at: exam.updatedAt || new Date().toISOString(),
                data: exam
            };

            const { data: existing, error: selectError } = await supabase
                .from('cbt_live_exams')
                .select('id')
                .match({
                    student_id: record.student_id,
                    mapel: record.mapel,
                    rombel: record.rombel
                })
                .maybeSingle();
            if (selectError) throw new Error('Supabase select live exam error: ' + selectError.message);

            if (existing) {
                const { error: updateError } = await supabase.from('cbt_live_exams').update(record).eq('id', existing.id);
                if (updateError) throw new Error('Supabase update live exam error: ' + updateError.message);
            } else {
                const { error: insertError } = await supabase.from('cbt_live_exams').insert(record);
                if (insertError) throw new Error('Supabase insert live exam error: ' + insertError.message);
            }
        }
        return;
    }
    throw new Error('Supabase is not configured');
}

function mergeLiveExamData(existing, incoming) {
    if (!existing || typeof existing !== 'object') return { ...incoming };
    if (!incoming || typeof incoming !== 'object') return { ...existing };

    const merged = { ...existing, ...incoming };

    // SERVER-SIDE TIMESTAMP ENFORCEMENT
    // We always use the server's clock to define "Freshness" 
    // to avoid issues with incorrect client clocks.
    merged.updatedAt = Date.now();

    // Preserve answers/currentIdx unless incoming explicitly includes them.
    if (existing.answers && incoming.answers === undefined) merged.answers = existing.answers;
    if (existing.currentIdx !== undefined && incoming.currentIdx === undefined) merged.currentIdx = existing.currentIdx;
    if (existing.ragu && incoming.ragu === undefined) merged.ragu = existing.ragu;

    // If admin explicitly requests to DELETE the checkpoint
    if (incoming.adminDeleteCheckpoint) {
        merged.adminSavedProgress = null;
        merged.adminSaveConfirmed = false;
        merged.savedByAdminCommand = false;
        merged.adminReloadRequest = false; // Also clear any pending reload
        merged.adminClearRequest = true; // Alert student side as well
        merged.adminClearConfirmed = false; // Reset confirmation status for new request
    } else {
        // ... (rest as before)
        const hasIncomingCheckpoint = incoming.adminSavedProgress &&
            Array.isArray(incoming.adminSavedProgress.answers) &&
            incoming.adminSavedProgress.answers.length > 0;

        if (existing.adminSavedProgress && !hasIncomingCheckpoint) {
            merged.adminSavedProgress = existing.adminSavedProgress;
        }

        // Preserve flags only if NOT deleting
        merged.adminSaveConfirmed = existing.adminSaveConfirmed || incoming.adminSaveConfirmed || false;
        merged.savedByAdminCommand = existing.savedByAdminCommand || incoming.savedByAdminCommand || false;

        // 1. Handle Reload Request (Strict Persistence)
        if (incoming.adminReloadConfirmed) {
            // Student has acknowledged the reload -> Clear the request
            merged.adminReloadRequest = false;
        } else if (existing.adminReloadRequest) {
            // Server has a pending reload from Admin -> KEEP IT
            // Only overwrite if incoming has a new, different request ID (e.g. from Admin clicking again)
            if (incoming.adminReloadRequest && incoming.adminReloadRequest !== existing.adminReloadRequest) {
                merged.adminReloadRequest = incoming.adminReloadRequest;
            } else {
                merged.adminReloadRequest = existing.adminReloadRequest;
            }
        } else {
            merged.adminReloadRequest = incoming.adminReloadRequest || false;
        }

        // 2. Handle Clear Request (Strict Persistence)
        if (incoming.adminClearConfirmed) {
            merged.adminClearRequest = false;
        } else if (existing.adminClearRequest) {
            if (incoming.adminClearRequest && incoming.adminClearRequest !== existing.adminClearRequest) {
                merged.adminClearRequest = incoming.adminClearRequest;
            } else {
                merged.adminClearRequest = existing.adminClearRequest;
            }
        } else {
            merged.adminClearRequest = incoming.adminClearRequest || false;
        }
    }

    // CRITICAL: Ensure adminDeleteCheckpoint is NEVER persisted in the final merged state
    // It is a one-time instruction for insertLiveExamSingle, not a state pulse.
    delete merged.adminDeleteCheckpoint;

    // If the incoming payload is a SPECIFIC save request, update flags.
    if (incoming.adminSaveRequest) {
        merged.adminSaveConfirmed = true;
        merged.savedByAdminCommand = true;
    }

    return merged;
}

async function insertLiveExamSingle(exam) {
    if (!USE_SUPABASE) {
        throw new Error('Supabase is not configured');
    }

    const record = {
        student_id: exam.studentId || '',
        mapel: exam.mapel || '',
        rombel: exam.rombel || '',
        updated_at: exam.updatedAt || new Date().toISOString(),
        data: exam
    };

    const { data: existing, error: selectError } = await supabase
        .from('cbt_live_exams')
        .select('id, data')
        .match({
            student_id: record.student_id,
            mapel: record.mapel,
            rombel: record.rombel
        })
        .maybeSingle();
    if (selectError) {
        throw new Error('Supabase select live exam error: ' + selectError.message);
    }

    if (existing) {
        const mergedData = mergeLiveExamData(existing.data || {}, exam);
        const updateRecord = {
            student_id: record.student_id,
            mapel: record.mapel,
            rombel: record.rombel,
            updated_at: exam.updatedAt || new Date().toISOString(),
            data: mergedData
        };
        const { error: updateError } = await supabase.from('cbt_live_exams').update(updateRecord).eq('id', existing.id);
        if (updateError) throw new Error('Supabase update live exam error: ' + updateError.message);
    } else {
        const { error: insertError } = await supabase.from('cbt_live_exams').insert(record);
        if (insertError) throw new Error('Supabase insert live exam error: ' + insertError.message);
    }
}

async function insertResultSingle(resultObj) {
    if (!USE_SUPABASE) {
        throw new Error('Supabase is not configured');
    }

    if (resultObj.deleted) {
        const { error } = await supabase
            .from('cbt_results')
            .delete()
            .match({
                student_id: resultObj.studentId || '',
                mapel: resultObj.mapel || '',
                rombel: resultObj.rombel || '',
                date: resultObj.date || ''
            });
        if (error) throw new Error('Supabase insertResultSingle(delete) error: ' + error.message);
    } else {
        const record = {
            student_id: resultObj.studentId || '',
            mapel: resultObj.mapel || '',
            rombel: resultObj.rombel || '',
            date: resultObj.date || new Date().toISOString(),
            score: typeof resultObj.score === 'string' ? parseFloat(resultObj.score) : (resultObj.score || 0),
            data: resultObj
        };

        // Manual Upsert Logic (Check existence first to bypass conflict spec issues)
        const { data: existing, error: fetchError } = await supabase
            .from('cbt_results')
            .select('id')
            .match({
                student_id: record.student_id,
                mapel: record.mapel,
                rombel: record.rombel,
                date: record.date
            })
            .maybeSingle();

        if (fetchError) throw new Error(`Supabase lookup error: ${fetchError.message}`);

        if (existing) {
            // Update existing record
            const { error: updateError } = await supabase
                .from('cbt_results')
                .update(record)
                .eq('id', existing.id);
            if (updateError) throw new Error(`Supabase update error: ${updateError.message}`);
        } else {
            // Insert new record
            const { error: insertError } = await supabase
                .from('cbt_results')
                .insert(record);
            if (insertError) throw new Error(`Supabase insert error: ${insertError.message}`);
        }
    }
}

// ─── Health Check Endpoint ────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
    status: 'ok',
    environment: VERCEL ? 'Vercel (Serverless)' : 'Local',
    database: USE_SUPABASE ? 'Supabase' : 'unconfigured',
    timestamp: new Date().toISOString()
}));

// ─── Static Files (Manual Fallbacks) ──────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(rootPath, 'index.html')));
app.get('/administrasi_guru.html', (req, res) => res.sendFile(path.join(rootPath, 'administrasi_guru.html')));

// Specific route for favicon to avoid SPA catch-all
app.get('/favicon.ico', (req, res) => {
    const icoPath = path.join(rootPath, 'favicon.ico');
    if (fs.existsSync(icoPath)) {
        res.sendFile(icoPath);
    } else {
        res.sendFile(path.join(rootPath, 'logo.png'));
    }
});

// Catch-all for SPA navigation
app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    if (req.url.includes('.')) return next();
    res.sendFile(path.join(rootPath, 'index.html'));
});

// ─── Health Endpoint ──────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    const status = {
        ok: false,
        mode: USE_SUPABASE ? 'supabase' : 'local',
        error: null
    };
    if (USE_SUPABASE) {
        try {
            const { error: dbError } = await supabase.from('cbt_database').select('id').limit(1);
            if (dbError) throw dbError;

            status.db_connection = 'OK';
            status.ok = true;
        } catch (e) {
            status.error = e.message;
        }
    } else {
        status.error = 'Set SUPABASE_URL and SUPABASE_KEY in environment variables.';
    }
    res.json(status);
});

// ─── API: Generate Admin Document ───────────────────────────────────────────
// Use a wrapper to survive multer errors on Vercel (pre-parsed body stream).
function generateAdminDocMiddleware(req, res, next) {
    upload.single('blueprint')(req, res, (err) => {
        if (err) {
            console.warn('[POST /api/generate-admin-doc] multer error (ignored on Vercel):', err.message);
        }
        next();
    });
}

app.post('/api/generate-admin-doc', generateAdminDocMiddleware, async (req, res) => {
    try {
        console.log('[POST /api/generate-admin-doc] START');
        const body = req.body || {};
        console.log('[POST /api/generate-admin-doc] req.body type:', typeof body);
        console.log('[POST /api/generate-admin-doc] req.body keys:', Object.keys(body).slice(0,20));
        const blueprintFile = req.file;
        let blueprintText = '';

        if (blueprintFile && blueprintFile.buffer && blueprintFile.originalname) {
            console.log('[POST /api/generate-admin-doc] parsing blueprint file', blueprintFile.originalname);
            blueprintText = await parseBlueprint(blueprintFile.buffer, blueprintFile.originalname);
            if (blueprintText.length > 150000) {
                blueprintText = blueprintText.slice(0, 150000);
            }
        }

        const target = String(body.target || body.type || 'admin-doc').trim().toLowerCase();
        const formatLkpd = String(body.formatLkpd || body.formatLKPD || '').trim().toLowerCase();
        const title = target === 'lkpd' ? 'LKPD' : 'Dokumen Administrasi';
        console.log('[POST /api/generate-admin-doc] target', target, 'formatLkpd', formatLkpd, 'title', title);

        const escapeHtml = text => String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        const summaryRows = Object.keys(body).map(key => {
            const value = body[key];
            return `<tr><td style="padding:6px 8px;border:1px solid #d1d5db;font-weight:600;">${escapeHtml(key)}</td><td style="padding:6px 8px;border:1px solid #d1d5db;">${escapeHtml(value)}</td></tr>`;
        }).join('');

        let blueprintSection = '';
        if (blueprintText) {
            blueprintSection = `
                <h3 style="margin-bottom:8px;color:#1f2937;">Isi File Referensi</h3>
                <pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:10px;max-height:320px;overflow:auto;">${escapeHtml(blueprintText)}</pre>
            `;
        }

        let instructionNote = `<p style="margin:0 0 16px 0;color:#475569;">Dokumen ini saat ini dibuat oleh server sebagai placeholder sementara endpoint AI belum diintegrasikan sepenuhnya. Silakan gunakan ini sebagai dasar dan lihat log server untuk detail input.</p>`;
        if (target === 'lkpd' && formatLkpd === 'otomatis') {
            instructionNote = `<p style="margin:0 0 16px 0;color:#475569;">Mode LKPD Otomatis terdeteksi. Server akan membaca RPP dan mengarahkan pembuatan LKPD berdasarkan file RPP yang diunggah.</p>`;
        }

        const html = `
            <div style="padding:24px;font-family:Verdana,Arial,sans-serif;color:#111827;">
                <h1 style="margin-top:0;color:#0f172a;">${escapeHtml(title)} Hasil Sementara</h1>
                ${instructionNote}
                <div style="margin-bottom:24px;">
                    <h3 style="margin-bottom:8px;color:#0f172a;">Ringkasan Input</h3>
                    <table style="border-collapse:collapse;width:100%;max-width:100%;background:#ffffff;border:1px solid #e2e8f0;">
                        <tbody>${summaryRows}</tbody>
                    </table>
                </div>
                ${blueprintSection}
                <div style="margin-top:24px;padding:18px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;">
                    <h3 style="margin-top:0;color:#3730a3;">Catatan</h3>
                    <p style="margin:0;color:#334155;">Endpoint `/api/generate-admin-doc` sudah aktif di server. Jika Anda ingin hasil dokumen AI asli, langkah selanjutnya adalah menghubungkan layanan AI dan membuat prompt generator di server.</p>
                </div>
            </div>
        `;

        res.json({ ok: true, html, savedToBankSoal: false });
    } catch (err) {
        console.error('[POST /api/generate-admin-doc] ErrorOBJ:', err);
        console.error('[POST /api/generate-admin-doc] Error:', err.stack || err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Network IPs ────────────────────────────────────────────────────────
app.get('/api/ips', (req, res) => {
    try {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        const ips = [];
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if ('IPv4' === iface.family && !iface.internal) {
                    ips.push(iface.address);
                }
            }
        }
        res.json(ips);
    } catch (e) {
        console.error('GET /api/ips error:', e.message);
        res.status(500).json([]);
    }
});

// ─── API: School Settings ────────────────────────────────────────────────────
app.get('/api/school-settings', async (req, res) => {
    try {
        const db = await readDB(true);
        res.json(db?.schoolSettings || {});
    } catch (e) {
        console.error('GET /api/school-settings error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/school-settings', async (req, res) => {
    try {
        const settings = req.body || {};
        const db = (await readDB(true)) || { ...DEFAULT_DB, globalSettings: { apiKeys: [] } };
        db.schoolSettings = { ...(db.schoolSettings || {}), ...settings };
        await writeDB(db);
        res.json({ ok: true, settings: db.schoolSettings });
    } catch (e) {
        console.error('POST /api/school-settings error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── API: Database metadata ──────────────────────────────────────────────────
app.get('/api/db', async (req, res) => {
    try {
        const loadAll = req.query.full === 'true';
        const data = await readDB(loadAll);
        if (data) {
            if (data.questions === undefined) data.questions = [];
            if (data.results === undefined) data.results = [];
            return res.json(data);
        }
        res.status(404).json({ error: 'Database not found' });
    } catch (e) {
        console.error('GET /api/db error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/db', async (req, res) => {
    try {
        const payload = req.body;
        if (Array.isArray(payload.results) && payload.results.length > 0) {
            await writeResults(payload.results);
        }
        const { results, ...dbOnly } = payload;
        await writeDB(dbOnly);
        res.json({ ok: true });
    } catch (e) {
        console.error('POST /api/db error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Granular Questions API
app.get('/api/questions', async (req, res) => {
    try {
        const options = {
            mapel: req.query.mapel,
            rombel: req.query.rombel,
            search: req.query.search,
            limit: parseInt(req.query.limit, 10),
            offset: parseInt(req.query.offset, 10) || 0
        };
        const db = await readDB(true);
        let items = Array.isArray(db?.questions) ? db.questions : [];
        const searchTerm = (options.search || '').toString().trim().toLowerCase();

        if (options.mapel) {
            items = items.filter(q => String(q?.mapel || '').toLowerCase() === String(options.mapel).toLowerCase());
        }
        if (options.rombel) {
            items = items.filter(q => String(q?.rombel || '').toLowerCase() === String(options.rombel).toLowerCase());
        }
        if (searchTerm) {
            items = items.filter(q => {
                const haystack = [q?.question, q?.text, q?.soal, q?.pertanyaan, q?.mapel, q?.rombel, JSON.stringify(q)]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        const total = items.length;
        const offset = Number.isFinite(options.offset) && options.offset > 0 ? options.offset : 0;
        const limit = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : (options.limit === -1 ? total : 50);
        const paged = limit > 0 ? items.slice(offset, offset + limit) : items.slice(offset);

        res.json({ items: paged, total, limit: limit > 0 ? limit : total, offset });
    } catch (e) {
        console.error('GET /api/questions error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Granular Students API
app.get('/api/students', async (req, res) => {
    try {
        const db = await readDB(true);
        res.json(Array.isArray(db?.students) ? db.students : []);
    } catch (e) {
        console.error('GET /api/students error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/results', async (req, res) => {
    try {
        const options = {
            studentId: req.query.studentId,
            mapel: req.query.mapel,
            rombel: req.query.rombel,
            limit: parseInt(req.query.limit, 10) || 100,
            offset: parseInt(req.query.offset, 10) || 0
        };
        const results = await readResults(options);

        if (req.query.limit || req.query.offset || req.query.studentId) {
            return res.json({ items: results, total: results.length, limit: options.limit, offset: options.offset });
        }
        res.json(results);
    } catch (e) {
        console.error('GET /api/results error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/results', async (req, res) => {
    try {
        const incoming = req.body;
        const list = Array.isArray(incoming) ? incoming : [incoming];
        await writeResults(list);
        res.json({ ok: true, count: list.length });
    } catch (e) {
        console.error('POST /api/results error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── API: Grades ─────────────────────────────────────────────────────────────
app.get('/api/grades', async (req, res) => {
    try {
        const { mapel, rombel } = req.query;
        const db = await readDB(true);
        let grades = Array.isArray(db?.grades) ? db.grades : [];
        if (mapel) grades = grades.filter(g => String(g?.mapel || '').toLowerCase() === String(mapel).toLowerCase());
        if (rombel) grades = grades.filter(g => String(g?.rombel || '').toLowerCase() === String(rombel).toLowerCase());
        res.json(grades);
    } catch (e) {
        console.error('GET /api/grades error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/grades', async (req, res) => {
    try {
        const incoming = req.body;
        const gradesArr = Array.isArray(incoming) ? incoming : [incoming];
        const db = (await readDB(true)) || { ...DEFAULT_DB, globalSettings: { apiKeys: [] } };
        if (!Array.isArray(db.grades)) db.grades = [];
        for (const g of gradesArr) {
            const existing = db.grades.find(item => item?.studentId === g?.studentId && item?.mapel === g?.mapel && item?.rombel === g?.rombel);
            if (existing) Object.assign(existing, g);
            else db.grades.push(g);
        }
        await writeDB(db);
        res.json({ success: true, count: gradesArr.length });
    } catch (e) {
        console.error('POST /api/grades error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── API: System Config ─────────────────────────────────────────────────────
app.get('/api/admin/config/:key', async (req, res) => {
    try {
        const value = await getConfigValue(req.params.key);
        res.json({ ok: true, key: req.params.key, value });
    } catch (e) {
        console.error('GET /api/admin/config/:key error:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/admin/config', async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ ok: false, error: 'key required' });
        const ok = await setConfigValue(key, value);
        res.json({ ok });
    } catch (e) {
        console.error('POST /api/admin/config error:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─── API: User Logs ──────────────────────────────────────────────────────────
app.get('/api/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const db = await readDB(true);
        const logs = Array.isArray(db?.logs) ? db.logs.slice(0, limit) : [];
        res.json({ ok: true, items: logs });
    } catch (e) {
        console.error('GET /api/logs error:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/logs', async (req, res) => {
    try {
        const { userId, userName, role, activity } = req.body;
        const db = (await readDB(true)) || { ...DEFAULT_DB, globalSettings: { apiKeys: [] } };
        if (!Array.isArray(db.logs)) db.logs = [];
        db.logs.unshift({ userId, userName, role, activity, timestamp: new Date().toISOString() });
        db.logs = db.logs.slice(0, 200);
        await writeDB(db);
        res.json({ ok: true });
    } catch (e) {
        console.error('POST /api/logs error:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.delete('/api/logs', async (req, res) => {
    try {
        const db = (await readDB(true)) || { ...DEFAULT_DB, globalSettings: { apiKeys: [] } };
        db.logs = [];
        await writeDB(db);
        res.json({ ok: true });
    } catch (e) {
        console.error('DELETE /api/logs error:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─── API: Live Exams ────────────────────────────────────────────────────────
app.get('/api/live-exams', async (req, res) => {
    try {
        let liveExams = await readLiveExams();
        if (!Array.isArray(liveExams)) liveExams = [];
        const now = Date.now();
        const result = liveExams.filter(exam => {
            const updatedAt = exam.updatedAt ? new Date(exam.updatedAt).getTime() : 0;
            const isFresh = !Number.isNaN(updatedAt) && (now - updatedAt) < 5 * 60 * 1000;
            const hasAdminCheckpoint = exam.adminSavedProgress && Array.isArray(exam.adminSavedProgress.answers) && exam.adminSavedProgress.answers.length > 0;
            return isFresh || hasAdminCheckpoint;
        });
        res.json(result);
    } catch (e) {
        console.error('[GET /api/live-exams] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/saved-exam/:studentId/:mapel', async (req, res) => {
    try {
        const { studentId, mapel } = req.params;
        const rombel = req.query.rombel;
        let liveExams = await readLiveExams();
        if (!Array.isArray(liveExams)) liveExams = [];
        const norm = v => String(v || '').trim().toLowerCase();
        const exam = liveExams.find(e =>
            norm(e.studentId) === norm(studentId) &&
            norm(e.mapel) === norm(mapel) &&
            (!rombel || norm(e.rombel) === norm(rombel)) &&
            e.adminSavedProgress && Array.isArray(e.adminSavedProgress.answers) && e.adminSavedProgress.answers.length > 0
        );
        res.json({ ok: Boolean(exam), exam: exam || null });
    } catch (e) {
        console.error('[GET /api/saved-exam] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/live-exam', async (req, res) => {
    try {
        const exam = req.body;
        if (!exam || typeof exam !== 'object') return res.status(400).json({ error: 'Object required' });
        const existing = await readLiveExams();
        const list = Array.isArray(existing) ? existing : [];
        const idx = list.findIndex(item => String(item.studentId || '') === String(exam.studentId || '') && String(item.mapel || '') === String(exam.mapel || '') && String(item.rombel || '') === String(exam.rombel || ''));
        if (idx >= 0) list[idx] = { ...list[idx], ...exam, updatedAt: exam.updatedAt || new Date().toISOString() };
        else list.push({ ...exam, updatedAt: exam.updatedAt || new Date().toISOString() });
        await writeLiveExams(list);
        res.json({ ok: true });
    } catch (e) {
        console.error('[POST /api/live-exam] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/result', async (req, res) => {
    try {
        const result = req.body;
        if (!result || typeof result !== 'object') return res.status(400).json({ error: 'Invalid payload' });
        await writeResults([result]);
        res.json({ ok: true, count: 1 });
    } catch (e) {
        console.error('POST /api/result error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── API: Dashboard Stats (Alias if needed) ───────────────────────────────────
app.get('/api/admin/global-api-keys', async (req, res) => {
    try {
        let keys = [];
        let activeCount = 0;
        let exhaustedCount = 0;

        // 1. PRIMARY: Try to get from Supabase (for Vercel)
        if (USE_SUPABASE) {
            try {
                const { data, error } = await supabase
                    .from('global_api_keys')
                    .select('*')
                    .order('added_at', { ascending: false });

                if (error) throw error;

                keys = data.map(key => ({
                    id: key.id,
                    provider: key.provider,
                    key: key.key,
                    status: key.status,
                    addedAt: key.added_at,
                    updatedAt: key.updated_at,
                    note: key.note
                }));

                activeCount = keys.filter(k => k.status !== 'exhausted').length;
                exhaustedCount = keys.filter(k => k.status === 'exhausted').length;

                console.log(`[ADMIN] Retrieved ${keys.length} global API keys from Supabase`);
            } catch (err) {
                console.error('[ADMIN] Warning: Failed to get from Supabase, falling back to MySQL:', err.message);
                // Fall through to MySQL fallback
            }
        }

        // 2. FALLBACK: Get from MySQL if Supabase failed or not configured
        if (keys.length === 0) {
            const db = await readDB();
            if (!db.globalSettings) db.globalSettings = { apiKeys: [] };
            if (!Array.isArray(db.globalSettings.apiKeys)) db.globalSettings.apiKeys = [];

            keys = db.globalSettings.apiKeys;
            activeCount = keys.filter(k => k.status !== 'exhausted').length;
            exhaustedCount = keys.filter(k => k.status === 'exhausted').length;

            console.log(`[ADMIN] Retrieved ${keys.length} global API keys from MySQL`);
        }

        // 3. AGGREGATE: Personal Teacher/Guru Keys
        const db = await readDB();
        const teacherKeysRaw = [];
        if (db && Array.isArray(db.students)) {
            db.students.forEach(s => {
                if (s.role === 'teacher' && Array.isArray(s.apiKeys)) {
                    const normalized = normalizeTeacherApiKeysArray(s.apiKeys);
                    normalized.forEach(k => {
                        teacherKeysRaw.push({
                            id: `guru-${s.id}-${k.provider}`,
                            provider: k.provider,
                            key: k.key,
                            status: k.status,
                            addedAt: 'Guru: ' + s.name,
                            updatedAt: k.exhaustedAt || new Date().toISOString(),
                            note: 'Personal key'
                        });
                    });
                }
            });
        }

        // 4. AGGREGATE: Environment Variables (as fallback global keys)
        const envKeysRaw = [];
        // Gemini
        const geminiRaw = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        geminiRaw.split(',').forEach((k, i) => {
            if (k.trim()) {
                const hash = k.trim().substring(k.trim().length - 10);
                const status = (db && db.globalAPIKeysStatus?.[hash]) ? db.globalAPIKeysStatus[hash].status : 'active';
                envKeysRaw.push({
                    id: `env-gemini-${i}`,
                    provider: 'Google Gemini',
                    key: k.trim(),
                    status: status,
                    addedAt: 'Vercel Env',
                    updatedAt: new Date().toISOString(),
                    note: 'Static Env Var'
                });
            }
        });
        // OpenAI
        const oaiRaw = process.env.OPENAI_API_KEY || '';
        oaiRaw.split(',').forEach((k, i) => {
            if (k.trim()) {
                const hash = k.trim().substring(k.trim().length - 10);
                const status = (db && db.globalAPIKeysStatus?.[hash]) ? db.globalAPIKeysStatus[hash].status : 'active';
                envKeysRaw.push({
                    id: `env-openai-${i}`,
                    provider: 'OpenAI',
                    key: k.trim(),
                    status: status,
                    addedAt: 'Vercel Env',
                    updatedAt: new Date().toISOString(),
                    note: 'Static Env Var'
                });
            }
        });

        // Combine all
        const allCombinedRaw = [...keys, ...teacherKeysRaw, ...envKeysRaw];

        // Final normalization for the UI (apply auto-revive)
        const allCombined = allCombinedRaw.map(k => {
            if (k.status === 'exhausted' && k.updatedAt) {
                const updatedAtTime = new Date(k.updatedAt).getTime();
                if (Date.now() - updatedAtTime > 60000) {
                    return { ...k, status: 'active' };
                }
            }
            return k;
        });

        activeCount = allCombined.filter(k => k.status !== 'exhausted').length;
        exhaustedCount = allCombined.filter(k => k.status === 'exhausted').length;

        res.json({
            ok: true,
            globalKeys: allCombined,
            activeCount,
            exhaustedCount
        });
    } catch (err) {
        console.error('[ADMIN GET KEYS ERROR]:', err.message);
        res.status(500).json({ error: 'Gagal mengambil API Keys: ' + err.message });
    }
});

app.post('/api/admin/add-global-key', async (req, res) => {
    const { provider, apiKey, note } = req.body;

    if (!provider || !apiKey) {
        return res.status(400).json({ error: 'provider dan apiKey diperlukan' });
    }

    try {
        const trimmedKey = apiKey.trim();
        let storageMedium = 'MySQL';

        // 1. PRIMARY: Try to save to Supabase (for Vercel)
        if (USE_SUPABASE) {
            try {
                await addGlobalAPIKeyToSupabase(provider, trimmedKey, note);
                storageMedium = 'Supabase';
                console.log(`[ADMIN] Global API key added to Supabase for provider: ${provider}`);
            } catch (err) {
                console.error('[ADMIN] Warning: Failed to add to Supabase, falling back to MySQL:', err.message);
                // Fall through to MySQL fallback
            }
        }

        // 2. FALLBACK: Save to MySQL if Supabase failed or not configured
        if (storageMedium !== 'Supabase') {
            const db = await readDB();
            if (!db.globalSettings) db.globalSettings = { apiKeys: [] };
            if (!Array.isArray(db.globalSettings.apiKeys)) db.globalSettings.apiKeys = [];

            // Check for duplicates in MySQL
            if (db.globalSettings.apiKeys.some(entry => entry.key === trimmedKey)) {
                return res.status(409).json({ error: 'API Key ini sudah ada di daftar Global' });
            }

            db.globalSettings.apiKeys.push({
                provider,
                key: trimmedKey,
                status: 'active',
                addedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                note: note || ''
            });

            await writeDB(db);
            console.log(`[ADMIN] Global API key added to MySQL for provider: ${provider}`);
        }

        // 3. Optional: Push to Vercel (async, don't wait)
        const vercelEnvVar = await pushGlobalAPIKeyToVercel(provider, trimmedKey).catch(err => {
            console.error('[ADMIN] Vercel push error (non-blocking):', err.message);
            return null;
        });

        return res.json({
            ok: true,
            message: 'Global API Key berhasil ditambahkan',
            storage: storageMedium,
            vercelStatus: vercelEnvVar ? `Auto-pushed sebagai ${vercelEnvVar}` : 'Vercel tidak dikonfigurasi'
        });
    } catch (err) {
        console.error('[ADMIN ADD GLOBAL KEY ERROR]:', err.message);
        res.status(500).json({ error: 'Gagal menambahkan Global API Key: ' + err.message });
    }
});

app.post('/api/admin/remove-global-key', async (req, res) => {
    const { keyIndex, keyId, keyValue } = req.body;

    // Accept either keyIndex (MySQL) or keyId (Supabase) or keyValue (direct key match)
    if (keyIndex === undefined && keyId === undefined && !keyValue) {
        return res.status(400).json({ error: 'keyIndex, keyId, atau keyValue diperlukan' });
    }

    try {
        // 1. Try to remove from Supabase first
        if ((keyId !== undefined || keyValue) && USE_SUPABASE) {
            try {
                if (keyId !== undefined) {
                    await removeGlobalAPIKeyFromSupabase(keyId);
                } else if (keyValue) {
                    // Find key by value
                    const { data } = await supabase
                        .from('global_api_keys')
                        .select('id')
                        .eq('key', keyValue)
                        .single();

                    if (data) {
                        await removeGlobalAPIKeyFromSupabase(data.id);
                    }
                }
                console.log(`[ADMIN] Global API key removed from Supabase`);
                return res.json({
                    ok: true,
                    message: 'Global API Key berhasil dihapus dari Supabase'
                });
            } catch (err) {
                console.error('[ADMIN] Warning: Failed to remove from Supabase, trying MySQL:', err.message);
                // Fall through to MySQL fallback
            }
        }

        // 2. FALLBACK: Remove from MySQL
        const db = await readDB();

        if (!db.globalSettings || !Array.isArray(db.globalSettings.apiKeys)) {
            return res.status(404).json({ error: 'Tidak ada API Keys global' });
        }

        if (keyIndex < 0 || keyIndex >= db.globalSettings.apiKeys.length) {
            return res.status(400).json({ error: 'Index API Key tidak valid' });
        }

        const removedKey = db.globalSettings.apiKeys.splice(keyIndex, 1)[0];
        await writeDB(db);

        console.log(`[ADMIN] Global API key removed from MySQL for provider: ${removedKey.provider}`);
        res.json({
            ok: true,
            message: 'Global API Key berhasil dihapus'
        });
    } catch (err) {
        console.error('[ADMIN REMOVE GLOBAL KEY ERROR]:', err.message);
        res.status(500).json({ error: 'Gagal menghapus Global API Key: ' + err.message });
    }
});

// ─── Helper: Push Global API Key to Vercel ───────────────────────────────────
async function pushGlobalAPIKeyToVercel(provider, apiKey) {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

    console.log('[VERCEL GLOBAL] VERCEL_TOKEN present:', !!VERCEL_TOKEN);
    console.log('[VERCEL GLOBAL] VERCEL_PROJECT_ID present:', !!VERCEL_PROJECT_ID);

    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
        console.warn('[VERCEL GLOBAL] VERCEL_TOKEN atau VERCEL_PROJECT_ID tidak dikonfigurasi, skipping auto-push');
        return null;
    }

    try {
        console.log(`[VERCEL GLOBAL] Pushing API key untuk provider: ${provider}...`);

        // Generate env var name untuk global key (e.g., GLOBAL_GOOGLE_GEMINI_APIKEY_1)
        const providerSafe = provider.replace(/[^A-Z0-9_]/g, '_').toUpperCase().substring(0, 30);
        const envKeyName = `GLOBAL_${providerSafe}_APIKEY_${Date.now()}`.substring(0, 64);

        console.log(`[VERCEL GLOBAL] Generated env var name: ${envKeyName}`);

        const vercelApi = 'https://api.vercel.com';
        const headers = {
            'Authorization': `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json'
        };

        const targets = ['production', 'preview', 'development'];
        console.log(`[VERCEL GLOBAL] Setting env var for targets: ${targets.join(', ')}`);

        const response = await fetch(`${vercelApi}/v9/projects/${VERCEL_PROJECT_ID}/env`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                key: envKeyName,
                value: apiKey,
                target: targets,
                type: 'encrypted'
            })
        });

        console.log('[VERCEL GLOBAL] Env create response status:', response.status);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.log('[VERCEL GLOBAL] Env create error:', JSON.stringify(error, null, 2));

            if (error.code === 'ENV_KEY_ALREADY_EXISTS') {
                console.log(`[VERCEL GLOBAL] ${envKeyName} sudah ada, mencoba update existing entries...`);

                const getRes = await fetch(`${vercelApi}/v9/projects/${VERCEL_PROJECT_ID}/env`, { headers });
                console.log('[VERCEL GLOBAL] Get env vars status:', getRes.status);

                if (!getRes.ok) throw new Error(`Failed to get env vars: ${getRes.statusText}`);

                const data = await getRes.json();
                const existingEnvs = (data.envs || []).filter(e => e.key === envKeyName);

                if (existingEnvs.length === 0) {
                    throw new Error('Env var exists but could not find existing entries');
                }

                for (const existingEnv of existingEnvs) {
                    console.log(`[VERCEL GLOBAL] Updating existing env var ID: ${existingEnv.id}`);
                    const updateRes = await fetch(`${vercelApi}/v9/projects/${VERCEL_PROJECT_ID}/env/${existingEnv.id}`, {
                        method: 'PATCH',
                        headers: headers,
                        body: JSON.stringify({ value: apiKey })
                    });
                    console.log(`[VERCEL GLOBAL] Update response status for ${existingEnv.id}:`, updateRes.status);
                    if (!updateRes.ok) throw new Error(`Failed to update ${existingEnv.id}: ${updateRes.statusText}`);
                }
                console.log(`[VERCEL GLOBAL] ✅ ${envKeyName} updated for existing targets`);
            } else {
                throw new Error(error.message || `HTTP ${response.status}`);
            }
        } else {
            console.log(`[VERCEL GLOBAL] ✅ ${envKeyName} set for all targets`);
        }

        console.log(`[VERCEL GLOBAL] ✅ API key berhasil di-push ke Vercel untuk provider: ${provider}`);
        return envKeyName;

    } catch (err) {
        console.error(`[VERCEL GLOBAL] ❌ Gagal push API key ke Vercel: ${err.message}`);
        // Don't throw - ini adalah bonus feature, jangan error jika gagal
        return null;
    }
}

// ─── Supabase Helpers for Global API Keys ───────────────────────────────────
async function addGlobalAPIKeyToSupabase(provider, key, note = '') {
    if (!USE_SUPABASE || !supabase) {
        throw new Error('Supabase not configured');
    }

    try {
        // Check for duplicates
        const { data: existing, error: checkError } = await supabase
            .from('global_api_keys')
            .select('id')
            .eq('key', key)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            throw new Error('Duplicate check failed: ' + checkError.message);
        }

        if (existing) {
            throw new Error('API Key sudah ada di Supabase');
        }

        // Insert new key
        const { data, error } = await supabase
            .from('global_api_keys')
            .insert({
                provider,
                key,
                status: 'active',
                note,
                added_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            throw new Error('Insert failed: ' + error.message);
        }

        console.log('[Supabase] Global API key added:', provider);
        return data;
    } catch (err) {
        console.error('[Supabase] Error adding global API key:', err.message);
        throw err;
    }
}

async function removeGlobalAPIKeyFromSupabase(keyId) {
    if (!USE_SUPABASE || !supabase) {
        throw new Error('Supabase not configured');
    }

    try {
        const { error } = await supabase
            .from('global_api_keys')
            .delete()
            .eq('id', keyId);

        if (error) {
            throw new Error('Delete failed: ' + error.message);
        }

        console.log('[Supabase] Global API key removed, ID:', keyId);
    } catch (err) {
        console.error('[Supabase] Error removing global API key:', err.message);
        throw err;
    }
}

// ─── API: Sinkronisasi Supabase (Opsional) ───────────────────────────────────

// Helper membuat Supabase client sementara dari .env
function getSupabaseClient() {
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_KEY;
    if (!sbUrl || !sbKey) {
        throw new Error('SUPABASE_URL dan SUPABASE_KEY belum dikonfigurasi di file .env');
    }
    return createClient(sbUrl, sbKey);
}

// Upload database lokal → Supabase
app.post('/api/sync/upload-to-supabase', async (req, res) => {
    try {
        const sb = getSupabaseClient();

        // Baca database lokal dari MySQL (atau backend aktif)
        let localDb = DEFAULT_DB;
        let localResults = [];
        try {
            const dbProxy = await readDB();
            localDb = {
                globalSettings: dbProxy.globalSettings || {},
                subjects: dbProxy.subjects || [],
                rombels: dbProxy.rombels || [],
                questions: dbProxy.questions || [],
                students: dbProxy.students || [],
                schedules: dbProxy.schedules || [],
                timeLimits: dbProxy.timeLimits || {},
                quizzes: dbProxy.quizzes || []
            };
            localResults = await readResults() || [];
        } catch (e) {
            console.error('Gagal membaca database lokal untuk upload:', e);
        }

        // Upload database utama
        const { error: dbError } = await sb
            .from('cbt_database')
            .upsert({ id: 1, data: localDb, updated_at: new Date() });
        if (dbError) throw new Error('Upload DB error: ' + dbError.message);

        // Upload results
        let uploaded = 0;
        for (const r of localResults) {
            const record = {
                student_id: r.studentId || '',
                mapel: r.mapel || '',
                rombel: r.rombel || '',
                date: r.date || new Date().toISOString(),
                score: typeof r.score === 'string' ? parseFloat(r.score) : (r.score || 0),
                data: r
            };
            const { data: existing } = await sb.from('cbt_results').select('id')
                .match({
                    student_id: record.student_id,
                    mapel: record.mapel,
                    rombel: record.rombel,
                    date: record.date
                })
                .maybeSingle();
            if (existing) {
                await sb.from('cbt_results').update(record).eq('id', existing.id);
            } else {
                await sb.from('cbt_results').insert(record);
            }
            uploaded++;
        }

        console.log(`[SYNC] ✅ Upload ke Supabase: database + ${uploaded} hasil ujian`);
        return res.json({
            ok: true,
            message: `✅ Berhasil upload database dan ${uploaded} hasil ujian ke Supabase.`
        });
    } catch (e) {
        console.error('[SYNC] Upload to Supabase error:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

// Download database Supabase → lokal
app.post('/api/sync/download-from-supabase', async (req, res) => {
    try {
        const sb = getSupabaseClient();

        const { data: dbData, error: dbError } = await sb
            .from('cbt_database')
            .select('data')
            .eq('id', 1)
            .single();
        if (dbError && dbError.code !== 'PGRST116') throw new Error('Download DB error: ' + dbError.message);

        // Download results
        const { data: resultsData, error: resultsError } = await sb
            .from('cbt_results')
            .select('data')
            .order('created_at', { ascending: false })
            .limit(5000);
        if (resultsError) throw new Error('Download results error: ' + resultsError.message);

        // Simpan ke lokal menggunakan helper DB (MySQL)
        if (dbData && dbData.data) {
            await writeDB(dbData.data);
        }

        const results = resultsData ? resultsData.map(r => r.data).filter(Boolean) : [];
        if (results.length > 0) {
            await writeResults(results);
        }

        console.log(`[SYNC] ✅ Download dari Supabase: database + ${results.length} hasil ujian`);
        return res.json({
            ok: true,
            message: `✅ Berhasil download database dan ${results.length} hasil ujian dari Supabase.`
        });
    } catch (e) {
        console.error('[SYNC] Download from Supabase error:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

// ─── LIVE QUIZZ ENDPOINTS ─────────────────────────────────────────────────────

app.post('/api/quizz/join', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.get('/api/quizz/participants', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.post('/api/quizz/status', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.get('/api/quizz/check-status', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.post('/api/quizz/room', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.post('/api/quizz/score', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.post('/api/quizz/mark-answered', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.get('/api/quizz/check-all-answered', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.post('/api/quizz/reset-answered', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

app.post('/api/quizz/reset', (req, res) => {
    res.status(501).json({ error: 'Live quiz endpoints are disabled in Supabase-only mode' });
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));
app.use('/api', (err, req, res, next) => {
    console.error('[GLOBAL API ERROR] message:', err.message);
    console.error('[GLOBAL API ERROR] stack:', err.stack || err);
    return res.status(err.status || 500).json({ error: err.message });
});

// ─── Local Init (selalu buat file database jika belum ada) ───────────────────
const VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === true;
if (!VERCEL) {
    if (!fs.existsSync(rootPath)) fs.mkdirSync(rootPath, { recursive: true });
    if (!fs.existsSync(LOCAL_DATA)) fs.writeFileSync(LOCAL_DATA, JSON.stringify(DEFAULT_DB, null, 2));
    if (!fs.existsSync(LOCAL_RESULTS)) fs.writeFileSync(LOCAL_RESULTS, '[]');
    // Buat folder images jika belum ada
    const imagesDir = path.join(rootPath, 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
}

// ─── Cleanup stale live exams (every 5 minutes) ──────────────────────────────
async function cleanupStaleLiveExams() {
    try {
        let liveExams = await readLiveExams();
        if (!Array.isArray(liveExams)) liveExams = [];
        const now = Date.now();
        const fiveMinMs = 5 * 60 * 1000;
        const fresh = liveExams.filter(exam => {
            const updatedAt = exam.updatedAt ? Date.parse(exam.updatedAt) : 0;
            if (Number.isNaN(updatedAt)) return false;
            return (now - updatedAt) < fiveMinMs;
        });
        if (fresh.length !== liveExams.length) {
            console.log(`[Cleanup] Removed ${liveExams.length - fresh.length} stale live exam entries`);
            await writeLiveExams(fresh);
        }
    } catch (err) {
        console.error('[Cleanup] Error cleaning live exams:', err.message);
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleLiveExams, 5 * 60 * 1000);

// ─── Listen (skip on Vercel) ──────────────────────────────────────────────────
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;

    // Fungsi start aplikasi async agar bisa menunggu MySQL
    const startApp = async () => {
        try {
            // Jalankan MySQL Portable jika ada
            await mysqlMgr.start();

            // Jalankan migrasi jika diperlukan (setelah DB siap)
            await autoMigrateIfNeeded();
        } catch (err) {
            console.error('❌ Gagal menjalankan MySQL Portable:', err.message);
            // Tetap lanjut, mungkin MySQL sudah jalan manual
        }

        console.log(`[INIT] Starting server on port ${PORT}...`);
        app.listen(PORT, '0.0.0.0', () => {
            const { networkInterfaces } = require('os');
            const nets = networkInterfaces();

            // Kumpulkan semua IP jaringan
            const networkIPs = [];
            for (const [name, net] of Object.entries(nets)) {
                for (const iface of net) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        networkIPs.push({ name, address: iface.address });
                    }
                }
            }

            console.log('\n' + '═'.repeat(55));
            console.log('  🎓 DR.CBT - Server Berjalan!');
            console.log('═'.repeat(55));
            console.log(`\n  📡 Akses Lokal    : http://localhost:${PORT}`);

            if (networkIPs.length > 0) {
                console.log('\n  🌐 Akses Jaringan (bagikan ke siswa):');
                for (const { name, address } of networkIPs) {
                    console.log(`     http://${address}:${PORT}  (${name})`);
                }
            } else {
                console.log('\n  ⚠️  Tidak terdeteksi jaringan LAN.');
            }

            console.log('\n  💾 Mode Database  : MySQL (Offline)');
            console.log(`  📁 Folder APP     : ${rootPath}`);
            console.log(`  🔑 Login Admin    : ADM / admin321`);
            console.log(`  🎓 Developer      : Daniel Widiatmoko`);
            console.log('\n  ℹ️ Gunakan tombol Sinkronisasi Supabase di Beranda Admin');
            console.log('     untuk backup/restore data ke cloud.');
            console.log('\n  ⛔ Tekan Ctrl+C untuk menghentikan server');
            console.log('═'.repeat(55) + '\n');
        });
    };

    startApp();
}

// ─── Process Exit Handlers ────────────────────────────────────────────────────
// Pastikan MySQL dimatikan secara bersih saat aplikasi ditutup (Ctrl+C)
const handleExit = () => {
    console.log('\n[EXIT] Menutup aplikasi dan database...');
    // Gunakan mysqlMgr.stop() yang sudah dioptimasi untuk graceful shutdown
    if (typeof mysqlMgr !== 'undefined') {
        mysqlMgr.stop();
    }
    process.exit();
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

// ─── VERCEL EXPORT ────────────────────────────────────────────────────────────
// Vercel serverless needs the app exported
module.exports = app;
