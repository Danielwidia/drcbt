/**
 * db.js — Modul database MySQL terpisah untuk CBT Offline
 * Menggunakan sync-mysql agar API server tetap sinkron dan kompatibel dengan kode lama.
 */

const path = require('path');
const fs = require('fs');
const MySQL = require('./sync-mysql-compat');

const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;
const rootPath = isPkg ? path.join(baseDir, 'APP') : __dirname;

let _db = null;

function getMySQLConfig() {
    return {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'cbt_offline',
        charset: process.env.MYSQL_CHARSET || 'utf8mb4'
    };
}

function ensureDatabaseExists() {
    const config = getMySQLConfig();
    const tempConn = new MySQL({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        charset: config.charset
    });

    try {
        tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET ${config.charset} COLLATE ${config.charset}_general_ci`);
    } catch (err) {
        console.error('Failed to ensure MySQL database exists:', err.message);
        throw err;
    } finally {
        if (typeof tempConn.end === 'function') tempConn.end();
    }
}

function initDb() {
    if (_db) return _db;
    ensureDatabaseExists();
    const config = getMySQLConfig();
    const tempDb = new MySQL(config);
    try {
        _db = tempDb;
        ensureSchema();
        return _db;
    } catch (err) {
        _db = null; // Reset if schema fails
        if (typeof tempDb.end === 'function') tempDb.end();
        console.error('Failed to initialize MySQL schema:', err.message);
        throw err;
    }
}

function execute(sql, params = []) {
    try {
        const conn = initDb();
        return conn.query(sql, params);
    } catch (err) {
        console.error(`[DB_EXEC_ERROR] SQL: ${sql.substring(0, 100)}...`, err.message);
        throw err;
    }
}

function queryOne(sql, params = []) {
    const rows = execute(sql, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function queryAll(sql, params = []) {
    const rows = execute(sql, params);
    return Array.isArray(rows) ? rows : [];
}

function transaction(fn) {
    const conn = initDb();
    conn.query('START TRANSACTION');
    try {
        fn();
        conn.query('COMMIT');
    } catch (err) {
        conn.query('ROLLBACK');
        throw err;
    }
}

function ensureSchema() {
    const config = getMySQLConfig();
    const charset = config.charset;

    execute(`
        CREATE TABLE IF NOT EXISTS config (
            \`key\` VARCHAR(255) PRIMARY KEY,
            \`value\` LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS students (
            id VARCHAR(255) PRIMARY KEY,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(64) NOT NULL DEFAULT 'siswa',
            data LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS schedules (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            mapel VARCHAR(255) NOT NULL,
            rombel VARCHAR(255) NOT NULL,
            date_start VARCHAR(255),
            date_end VARCHAR(255),
            data LONGTEXT NOT NULL,
            INDEX idx_schedules_mapel_rombel (mapel, rombel)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS questions (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            mapel VARCHAR(191) NOT NULL,
            rombel VARCHAR(191) NOT NULL,
            type VARCHAR(64) NOT NULL DEFAULT 'single',
            text LONGTEXT NOT NULL,
            options LONGTEXT NOT NULL,
            correct LONGTEXT NOT NULL,
            images LONGTEXT NOT NULL,
            data LONGTEXT NOT NULL,
            INDEX idx_questions_mapel_rombel (mapel, rombel)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS quizzes (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            data LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS results (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            student_id VARCHAR(128) NOT NULL,
            mapel VARCHAR(128) NOT NULL,
            rombel VARCHAR(128) NOT NULL,
            date VARCHAR(128) NOT NULL,
            score DECIMAL(10,4) NOT NULL DEFAULT 0,
            data TEXT NOT NULL,
            created_at VARCHAR(128) NOT NULL,
            UNIQUE KEY idx_results_unique (student_id, mapel, rombel, date),
            INDEX idx_results_student (student_id),
            INDEX idx_results_mapel_rombel (mapel, rombel)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS live_exams (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            student_id VARCHAR(255) NOT NULL,
            mapel VARCHAR(255) NOT NULL,
            rombel VARCHAR(255) NOT NULL,
            updated_at VARCHAR(255) NOT NULL,
            data TEXT NOT NULL,
            UNIQUE KEY idx_live_exams_unique (student_id, mapel, rombel)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS live_quizz_participants (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            student_id VARCHAR(255) NOT NULL,
            student_name VARCHAR(255) NOT NULL,
            mapel VARCHAR(255) NOT NULL,
            rombel VARCHAR(255) NOT NULL,
            status VARCHAR(64) NOT NULL DEFAULT 'waiting',
            last_ping BIGINT NOT NULL,
            score INT DEFAULT 0,
            question_answered INT DEFAULT 0,
            UNIQUE KEY idx_lq_unique (student_id, mapel, rombel)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS live_quizz_rooms (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            mapel VARCHAR(255) NOT NULL,
            rombel VARCHAR(255) NOT NULL,
            current_index INT DEFAULT 0,
            status VARCHAR(64) DEFAULT 'waiting',
            start_time BIGINT DEFAULT 0,
            UNIQUE KEY idx_lqr_unique (mapel, rombel)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);
    
    execute(`
        CREATE TABLE IF NOT EXISTS user_logs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(255),
            user_name VARCHAR(255),
            role VARCHAR(64),
            activity TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    execute(`
        CREATE TABLE IF NOT EXISTS grades (
            student_id VARCHAR(191) NOT NULL,
            mapel VARCHAR(191) NOT NULL,
            rombel VARCHAR(191) NOT NULL,
            u1 DECIMAL(10,2) DEFAULT 0,
            u2 DECIMAL(10,2) DEFAULT 0,
            u3 DECIMAL(10,2) DEFAULT 0,
            t1 DECIMAL(10,2) DEFAULT 0,
            t2 DECIMAL(10,2) DEFAULT 0,
            t3 DECIMAL(10,2) DEFAULT 0,
            kelas DECIMAL(10,2) DEFAULT 0,
            uas DECIMAL(10,2) DEFAULT 0,
            nilai_akhir DECIMAL(10,2) DEFAULT 0,
            data TEXT, -- Flexible storage for multiple columns
            PRIMARY KEY (student_id, mapel, rombel),
            INDEX idx_grades_filter (mapel, rombel)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset};
    `);

    // Ensure 'data' column exists in 'grades' (for existing tables)
    try {
        const columns = queryAll('SHOW COLUMNS FROM grades LIKE "data"');
        if (columns.length === 0) {
            execute('ALTER TABLE grades ADD COLUMN data TEXT AFTER nilai_akhir');
            console.log('[DB] Added missing column "data" to table "grades"');
        }
    } catch (e) {
        console.error('[DB] Failed to ensure column "data" in "grades":', e.message);
    }

    // Upgrade columns to LONGTEXT for existing databases (Migration)
    try {
        execute('ALTER TABLE config MODIFY COLUMN \`value\` LONGTEXT NOT NULL');
        execute('ALTER TABLE questions MODIFY COLUMN text LONGTEXT NOT NULL');
        execute('ALTER TABLE questions MODIFY COLUMN options LONGTEXT NOT NULL');
        execute('ALTER TABLE questions MODIFY COLUMN correct LONGTEXT NOT NULL');
        execute('ALTER TABLE questions MODIFY COLUMN images LONGTEXT NOT NULL');
        execute('ALTER TABLE questions MODIFY COLUMN data LONGTEXT NOT NULL');
        execute('ALTER TABLE students MODIFY COLUMN data LONGTEXT NOT NULL');
        execute('ALTER TABLE results MODIFY COLUMN data LONGTEXT NOT NULL');
        execute('ALTER TABLE live_exams MODIFY COLUMN data LONGTEXT NOT NULL');
    } catch (e) {
        // Silently skip if column already changed or table locked
        console.warn('[DB] Migration to LONGTEXT skipped or failed:', e.message);
    }
}

function closeDb() {
    if (_db && typeof _db.end === 'function') {
        _db.end();
    }
    _db = null;
}

function getUsersDb() { return initDb(); }
function getQuestionsDb() { return initDb(); }
function getResultsDb() { return initDb(); }
function getDb() { return initDb(); }

const enc = v => JSON.stringify(v);
const dec = v => { try { return JSON.parse(v); } catch { return v; } };

function checkAndMigrate() {
    // SQLite auto-migration logic is now in server.js autoMigrateIfNeeded
}

function getConfig(key) {
    const row = queryOne('SELECT value FROM config WHERE `key` = ?', [key]);
    return row ? dec(row.value) : null;
}

function setConfig(key, value) {
    execute('INSERT INTO config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)', [key, enc(value)]);
}

function getSubjects() { return getConfig('subjects') || []; }
function setSubjects(subjects) { setConfig('subjects', subjects); }
function getRombels() { return getConfig('rombels') || []; }
function setRombels(rombels) { setConfig('rombels', rombels); }
function getTimeLimits() { return getConfig('timeLimits') || {}; }
function setTimeLimits(t) { setConfig('timeLimits', t); }
function getJenisUjian() { return getConfig('jenisUjian') || {}; }
function setJenisUjian(j) { setConfig('jenisUjian', j); }

function getSchoolSettings() { return getConfig('school_settings') || {}; }
function setSchoolSettings(s) { setConfig('school_settings', s); }

function getAllQuestions() {
    const rows = queryAll('SELECT data FROM questions ORDER BY id');
    return rows.map(r => dec(r.data));
}

function getQuestions(options = {}) {
    let query = 'SELECT data FROM questions';
    const params = [];
    const where = [];
    if (options.mapel) { where.push('mapel = ?'); params.push(options.mapel); }
    if (options.rombel) { where.push('rombel = ?'); params.push(options.rombel); }
    if (where.length > 0) query += ' WHERE ' + where.join(' AND ');
    if (options.limit !== undefined && Number(options.limit) !== -1) {
        query += ' LIMIT ?';
        params.push(Number(options.limit));
        if (options.offset !== undefined && options.offset !== null) {
            query += ' OFFSET ?';
            params.push(Number(options.offset));
        }
    } else if (options.offset !== undefined && options.offset !== null) {
        // MySQL requires LIMIT if OFFSET is used. Use a very large number for "no limit".
        query += ' LIMIT 18446744073709551615 OFFSET ?';
        params.push(Number(options.offset));
    }
    try {
        const rows = queryAll(query, params);
        return rows.map(r => dec(r.data));
    } catch (e) {
        console.error('getQuestions error:', e.message);
        return [];
    }
}

function getQuestionsCount(options = {}) {
    let query = 'SELECT COUNT(*) as count FROM questions';
    const params = [];
    const where = [];
    if (options.mapel) { where.push('mapel = ?'); params.push(options.mapel); }
    if (options.rombel) { where.push('rombel = ?'); params.push(options.rombel); }
    if (where.length > 0) query += ' WHERE ' + where.join(' AND ');
    const row = queryOne(query, params);
    return row ? Number(row.count || 0) : 0;
}

function setAllQuestions(questions) {
    transaction(() => {
        execute('DELETE FROM questions');
        const batchSize = 100;
        for (let i = 0; i < questions.length; i += batchSize) {
            const batch = questions.slice(i, i + batchSize);
            for (const q of batch) {
                execute(
                    'INSERT INTO questions (mapel, rombel, type, text, options, correct, images, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [q.mapel || '', q.rombel || '', q.type || 'single', q.text || '', enc(q.options || []), enc(q.correct), enc(q.images || []), enc(q)]
                );
            }
        }
    });
}

function addQuestion(q) {
    const result = execute(
        'INSERT INTO questions (mapel, rombel, type, text, options, correct, images, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [q.mapel || '', q.rombel || '', q.type || 'single', q.text || '', enc(q.options || []), enc(q.correct), enc(q.images || []), enc(q)]
    );
    return result.insertId;
}

function updateQuestion(index0Based, q) {
    const rows = queryAll('SELECT id FROM questions ORDER BY id');
    if (index0Based < 0 || index0Based >= rows.length) return false;
    const id = rows[index0Based].id;
    execute(
        'UPDATE questions SET mapel=?, rombel=?, type=?, text=?, options=?, correct=?, images=?, data=? WHERE id=?',
        [q.mapel || '', q.rombel || '', q.type || 'single', q.text || '', enc(q.options || []), enc(q.correct), enc(q.images || []), enc(q), id]
    );
    return true;
}

function deleteQuestion(index0Based) {
    const rows = queryAll('SELECT id FROM questions ORDER BY id');
    if (index0Based < 0 || index0Based >= rows.length) return false;
    execute('DELETE FROM questions WHERE id = ?', [rows[index0Based].id]);
    return true;
}

function getAllStudents() {
    const rows = queryAll('SELECT data FROM students ORDER BY id');
    return rows.map(r => dec(r.data));
}

function setAllStudents(students) {
    transaction(() => {
        execute('DELETE FROM students');
        for (const s of students) {
            execute(
                'INSERT INTO students (id, password, name, role, data) VALUES (?, ?, ?, ?, ?)',
                [s.id || '', s.password || '', s.name || '', s.role || 'siswa', enc(s)]
            );
        }
    });
}

function getStudentById(id) {
    const row = queryOne('SELECT data FROM students WHERE id = ?', [id]);
    return row ? dec(row.data) : null;
}

function upsertStudent(s) {
    execute(
        'INSERT INTO students (id, password, name, role, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE password=VALUES(password), name=VALUES(name), role=VALUES(role), data=VALUES(data)',
        [s.id || '', s.password || '', s.name || '', s.role || 'siswa', enc(s)]
    );
}

function deleteStudent(id) {
    execute('DELETE FROM students WHERE id = ?', [id]);
}

function getAllSchedules() {
    const rows = queryAll('SELECT data FROM schedules ORDER BY id');
    return rows.map(r => dec(r.data));
}

function setAllSchedules(schedules) {
    transaction(() => {
        execute('DELETE FROM schedules');
        for (const s of schedules) {
            execute(
                'INSERT INTO schedules (mapel, rombel, date_start, date_end, data) VALUES (?, ?, ?, ?, ?)',
                [s.mapel || '', s.rombel || '', s.dateStart || s.date_start || null, s.dateEnd || s.date_end || null, enc(s)]
            );
        }
    });
}

function getAllQuizzes() {
    const rows = queryAll('SELECT data FROM quizzes ORDER BY id');
    return rows.map(r => dec(r.data));
}

function setAllQuizzes(quizzes) {
    transaction(() => {
        execute('DELETE FROM quizzes');
        for (const q of quizzes) execute('INSERT INTO quizzes (data) VALUES (?)', [enc(q)]);
    });
}

function getAllResults() {
    const rows = queryAll('SELECT data FROM results ORDER BY created_at DESC');
    return rows.map(r => dec(r.data));
}

function getResults(options = {}) {
    const all = getAllResults();
    let filtered = all;
    if (options.studentId) {
        const sid = String(options.studentId).trim().toLowerCase();
        filtered = filtered.filter(r => String(r.studentId || "").trim().toLowerCase() === sid);
    }
    if (options.mapel) {
        const search = String(options.mapel).trim().toLowerCase();
        filtered = filtered.filter(r => {
            const m = String(r.mapel || "").trim().toLowerCase();
            return m === search || m.includes(search) || search.includes(m);
        });
    }
    if (options.rombel) {
        const rid = String(options.rombel).trim().toLowerCase();
        filtered = filtered.filter(r => String(r.rombel || "").trim().toLowerCase() === rid);
    }
    filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const offset = options.offset || 0;
    const limit = (options.limit === -1 || options.limit === undefined) ? filtered.length : options.limit;
    return filtered.slice(offset, offset + limit);
}

function getResultsCount(options = {}) {
    return getResults(options).length;
}

function upsertResult(r) {
    const scoreVal = typeof r.score === 'string' ? parseFloat(r.score) : (r.score || 0);
    const dateVal = r.date || new Date().toISOString();
    execute(
        'INSERT INTO results (student_id, mapel, rombel, date, score, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE score=VALUES(score), data=VALUES(data)',
        [r.studentId || '', r.mapel || '', r.rombel || '', dateVal, scoreVal, enc(r), dateVal]
    );
}

function deleteResult(studentId, mapel, rombel, date) {
    execute('DELETE FROM results WHERE student_id=? AND mapel=? AND rombel=? AND date=?', [studentId, mapel, rombel, date]);
}

function setAllResults(resultsArr) {
    transaction(() => {
        const toDelete = resultsArr.filter(r => r.deleted === true);
        const active = resultsArr.filter(r => r.deleted !== true);
        for (const r of toDelete) deleteResult(r.studentId || '', r.mapel || '', r.rombel || '', r.date || '');
        
        const batchSize = 100;
        for (let i = 0; i < active.length; i += batchSize) {
            const batch = active.slice(i, i + batchSize);
            for (const r of batch) {
                const scoreVal = typeof r.score === 'string' ? parseFloat(r.score) : (r.score || 0);
                const dateVal = r.date || new Date().toISOString();
                execute(
                    'INSERT INTO results (student_id, mapel, rombel, date, score, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE score=VALUES(score), data=VALUES(data)',
                    [r.studentId || '', r.mapel || '', r.rombel || '', dateVal, scoreVal, enc(r), dateVal]
                );
            }
        }
    });
}

function mergeResults(inc = []) {
    for (const r of inc) {
        if (r.deleted) deleteResult(r.studentId || '', r.mapel || '', r.rombel || '', r.date || '');
        else upsertResult(r);
    }
}

function getAllLiveExams() {
    const rows = queryAll('SELECT data FROM live_exams');
    return rows.map(r => dec(r.data));
}

function upsertLiveExam(exam) {
    const sid = String(exam.studentId || '').trim().toLowerCase();
    const map = String(exam.mapel || '').trim().toLowerCase();
    const rom = String(exam.rombel || '').trim().toLowerCase();
    execute('DELETE FROM live_exams WHERE LOWER(TRIM(student_id)) = ? AND LOWER(TRIM(mapel)) = ? AND LOWER(TRIM(rombel)) = ?', [sid, map, rom]);
    execute(
        'INSERT INTO live_exams (student_id, mapel, rombel, updated_at, data) VALUES (?, ?, ?, ?, ?)',
        [exam.studentId || '', exam.mapel || '', exam.rombel || '', exam.updatedAt || new Date().toISOString(), enc(exam)]
    );
}

function clearCheckpointDirectly(sid, map, rom) {
    const nid = String(sid || '').trim().toLowerCase();
    const nmp = String(map || '').trim().toLowerCase();
    const nrb = String(rom || '').trim().toLowerCase();
    const rows = queryAll('SELECT id, data FROM live_exams WHERE LOWER(TRIM(student_id)) = ? AND LOWER(TRIM(mapel)) = ? AND LOWER(TRIM(rombel)) = ?', [nid, nmp, nrb]);
    for (const row of rows) {
        const data = dec(row.data);
        if (data.adminSavedProgress) {
            console.log(`[db.js] Hard-clearing checkpoint for record ID: ${row.id}`);
            data.adminSavedProgress = null;
            data.adminSaveConfirmed = false;
            data.savedByAdminCommand = false;
            execute('UPDATE live_exams SET data=? WHERE id=?', [enc(data), row.id]);
        }
    }
}

function setAllLiveExams(exams) {
    transaction(() => {
        execute('DELETE FROM live_exams');
        for (const e of exams) {
            execute(
                'INSERT INTO live_exams (student_id, mapel, rombel, updated_at, data) VALUES (?, ?, ?, ?, ?)',
                [e.studentId || '', e.mapel || '', e.rombel || '', e.updatedAt || new Date().toISOString(), enc(e)]
            );
        }
    });
}

function upsertQuizzParticipant(p) {
    const now = Date.now();
    execute(
        'INSERT INTO live_quizz_participants (student_id, student_name, mapel, rombel, last_ping, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), last_ping=VALUES(last_ping), status=VALUES(status)',
        [p.studentId, p.studentName, p.mapel, p.rombel, now, p.status || 'waiting']
    );
}

function getQuizzParticipants(mapel, rombel) {
    const staleTime = Date.now() - 30000;
    execute('DELETE FROM live_quizz_participants WHERE last_ping < ?', [staleTime]);
    return queryAll('SELECT student_id, student_name, status, score FROM live_quizz_participants WHERE mapel = ? AND rombel = ?', [mapel, rombel]);
}

function setQuizzStatus(mapel, rombel, status) {
    if (status === 'start') {
        execute('UPDATE live_quizz_participants SET status = ?, score = 0 WHERE mapel = ? AND rombel = ?', [status, mapel, rombel]);
    } else {
        execute('UPDATE live_quizz_participants SET status = ? WHERE mapel = ? AND rombel = ?', [status, mapel, rombel]);
    }
}

function updateQuizzScore(studentId, mapel, rombel, score) {
    const now = Date.now();
    execute('UPDATE live_quizz_participants SET score = ?, last_ping = ?, question_answered = 1 WHERE student_id = ? AND mapel = ? AND rombel = ?', [score, now, studentId, mapel, rombel]);
}

function markQuizzAnswered(studentId, mapel, rombel) {
    const now = Date.now();
    execute('UPDATE live_quizz_participants SET question_answered = 1, last_ping = ? WHERE student_id = ? AND mapel = ? AND rombel = ?', [now, studentId, mapel, rombel]);
}

function resetQuizzAnswered(mapel, rombel) {
    execute('UPDATE live_quizz_participants SET question_answered = 0 WHERE mapel = ? AND rombel = ?', [mapel, rombel]);
}

function checkAllAnswered(mapel, rombel) {
    const result = queryOne('SELECT COUNT(*) as total, SUM(question_answered) as answered FROM live_quizz_participants WHERE mapel = ? AND rombel = ?', [mapel, rombel]);
    if (!result || result.total === 0 || result.total === null) {
        return false;
    }
    const answeredCount = result.answered || 0;
    const allAnswered = result.total > 0 && result.total === answeredCount;
    console.log(`[DB_CHECK_ALL] mapel=${mapel} rombel=${rombel}: total=${result.total}, answered=${answeredCount}, result=${allAnswered}`);
    return allAnswered;
}

function resetQuizzParticipants(mapel, rombel) {
    execute('DELETE FROM live_quizz_participants WHERE mapel = ? AND rombel = ?', [mapel, rombel]);
    execute('DELETE FROM live_quizz_rooms WHERE mapel = ? AND rombel = ?', [mapel, rombel]);
}

function upsertQuizzRoom(mapel, rombel, status, currentIndex, startTime) {
    execute(
        'INSERT INTO live_quizz_rooms (mapel, rombel, status, current_index, start_time) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), current_index=VALUES(current_index), start_time=VALUES(start_time)',
        [mapel, rombel, status, currentIndex, startTime]
    );
}

function addLog(userId, userName, role, activity) {
    execute(
        'INSERT INTO user_logs (user_id, user_name, role, activity) VALUES (?, ?, ?, ?)',
        [userId, userName, role, activity]
    );
}

function getLogs(limit = 20) {
    return queryAll('SELECT * FROM user_logs ORDER BY created_at DESC LIMIT ?', [limit]);
}

function clearLogs() {
    execute('DELETE FROM user_logs');
}

function getGrades(mapel, rombel) {
    let sql = 'SELECT * FROM grades';
    const params = [];
    if (mapel || rombel) {
        sql += ' WHERE';
        const parts = [];
        if (mapel) { parts.push(' mapel = ?'); params.push(mapel); }
        if (rombel) { parts.push(' rombel = ?'); params.push(rombel); }
        sql += parts.join(' AND');
    }
    return queryAll(sql, params);
}

function upsertGrade(g) {
    if (!g) return;
    execute(`
        INSERT INTO grades (student_id, mapel, rombel, u1, u2, u3, t1, t2, t3, kelas, uas, nilai_akhir, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            u1=VALUES(u1), u2=VALUES(u2), u3=VALUES(u3), 
            t1=VALUES(t1), t2=VALUES(t2), t3=VALUES(t3), 
            kelas=VALUES(kelas), uas=VALUES(uas), nilai_akhir=VALUES(nilai_akhir),
            data=VALUES(data)
    `, [
        g.student_id || g.studentId, g.mapel, g.rombel, 
        g.u1 || 0, g.u2 || 0, g.u3 || 0, 
        g.t1 || 0, g.t2 || 0, g.t3 || 0, 
        g.kelas || 0, g.uas || 0, g.nilai_akhir || g.nilaiAkhir || 0,
        enc(g.data || {})
    ]);
}

function getQuizzRoom(mapel, rombel) {
    return queryOne('SELECT * FROM live_quizz_rooms WHERE mapel = ? AND rombel = ?', [mapel, rombel]);
}

function readDB(loadAll = true) {
    const data = {
        subjects: getSubjects(),
        rombels: getRombels(),
        students: getAllStudents(),
        schedules: getAllSchedules(),
        timeLimits: getTimeLimits(),
        jenisUjian: getJenisUjian(),
        quizzes: getAllQuizzes(),
        schoolSettings: getSchoolSettings()
    };
    if (loadAll) {
        data.questions = getAllQuestions();
        data.results = getAllResults();
    }
    return data;
}

function writeDB(obj) {
    if (obj.subjects !== undefined) setSubjects(obj.subjects);
    if (obj.rombels !== undefined) setRombels(obj.rombels);
    if (obj.questions !== undefined) setAllQuestions(obj.questions);
    if (obj.students !== undefined) setAllStudents(obj.students);
    if (obj.schedules !== undefined) setAllSchedules(obj.schedules);
    if (obj.timeLimits !== undefined) setTimeLimits(obj.timeLimits);
    if (obj.jenisUjian !== undefined) setJenisUjian(obj.jenisUjian);
    if (obj.quizzes !== undefined) setAllQuizzes(obj.quizzes);
    if (obj.results !== undefined) setAllResults(obj.results);
    if (obj.schoolSettings !== undefined) setSchoolSettings(obj.schoolSettings);
}

function getDbPath() {
    const config = getMySQLConfig();
    return `mysql://${config.user}@${config.host}:${config.port}/${config.database}`;
}

module.exports = {
    getDb, getDbPath, closeDb,
    getUsersDb, getQuestionsDb, getResultsDb,
    getConfig, setConfig,
    getSubjects, setSubjects, getRombels, setRombels, getTimeLimits, setTimeLimits, getJenisUjian, setJenisUjian,
    getSchoolSettings, setSchoolSettings,
    getAllQuestions, setAllQuestions, addQuestion, updateQuestion, deleteQuestion, getQuestions, getQuestionsCount,
    getAllStudents, setAllStudents, getStudentById, upsertStudent, deleteStudent,
    getAllSchedules, setAllSchedules,
    getAllQuizzes, setAllQuizzes,
    getAllResults, upsertResult, deleteResult, setAllResults, mergeResults, getResults, getResultsCount,
    getAllLiveExams, upsertLiveExam, setAllLiveExams, clearCheckpointDirectly,
    addLog, getLogs, clearLogs,
    upsertQuizzParticipant, getQuizzParticipants, setQuizzStatus, resetQuizzParticipants, updateQuizzScore, markQuizzAnswered, resetQuizzAnswered, checkAllAnswered,
    upsertQuizzRoom, getQuizzRoom,
    getGrades, upsertGrade,
    readDB, writeDB
};
