/**
 * js/modules/guru.js
 * Part of CBT application refactored module
 */

/**
 * Show/hide the correct form containers based on selected question type.
 * Called by openQuestionModal and the q-type <select> onChange handler.
 */
function onQuestionTypeChange() {
    const sel = document.getElementById('q-type');
    if (!sel) return;
    const type = sel.value;
    const optsContainer = document.getElementById('q-opts-container');
    const answerTextContainer = document.getElementById('q-answer-text-container');
    const tfContainer = document.getElementById('q-tf-container');
    const matchingContainer = document.getElementById('q-matching-container');
    const correctButtonsGroup = document.getElementById('q-correct-buttons-group');
    const qOpsiGroup = document.getElementById('q-opsi-group');

    // Hide all containers first
    if (optsContainer) optsContainer.classList.add('hidden');
    if (answerTextContainer) answerTextContainer.classList.add('hidden');
    if (tfContainer) tfContainer.classList.add('hidden');
    if (matchingContainer) matchingContainer.classList.add('hidden');
    if (correctButtonsGroup) correctButtonsGroup.classList.add('hidden');
    if (qOpsiGroup) qOpsiGroup.classList.add('hidden');

    if (type === 'text') {
        if (answerTextContainer) answerTextContainer.classList.remove('hidden');
    } else if (type === 'tf') {
        if (tfContainer) tfContainer.classList.remove('hidden');
        // Ensure at least 2 TF rows exist
        if (tfContainer) {
            const existingRows = tfContainer.querySelectorAll('.tf-row').length;
            for (let i = existingRows; i < 2; i++) {
                if (typeof addTfRow === 'function') addTfRow();
            }
        }
    } else if (type === 'matching') {
        if (matchingContainer) matchingContainer.classList.remove('hidden');
    } else {
        // single or multiple choice
        if (optsContainer) optsContainer.classList.remove('hidden');
        if (correctButtonsGroup) correctButtonsGroup.classList.remove('hidden');
        if (qOpsiGroup) qOpsiGroup.classList.remove('hidden');
        if (optsContainer) {
            optsContainer.querySelectorAll('.q-opt').forEach(inp => {
                inp.disabled = false;
                if (inp.parentElement) inp.parentElement.style.display = '';
            });
        }
    }

    // Show/hide correct-button group for tf/text/matching
    if (correctButtonsGroup) {
        if (type === 'tf' || type === 'text' || type === 'matching') {
            correctButtonsGroup.style.display = 'none';
        } else {
            correctButtonsGroup.style.display = '';
        }
    }

    // Update correct button labels
    const buttons = document.querySelectorAll('.c-btn');
    if (buttons && buttons.length >= 4) {
        ['A', 'B', 'C', 'D'].forEach((l, i) => {
            buttons[i].innerText = l;
            buttons[i].style.display = '';
        });
    }

    // Reset correct state
    if (typeof activeCorrect !== 'undefined') activeCorrect = 0;
    if (typeof activeCorrectMultiple !== 'undefined') activeCorrectMultiple = [];
    if (typeof renderCorrectButtons === 'function') renderCorrectButtons();
}

function initQuillEditors() {
    const questionEditorEl = document.getElementById('q-text-editor');
    const answerEditorEl = document.getElementById('q-answer-text-editor');
    const quizzEditorEl = document.getElementById('quizz-question-editor');

    const fullToolbarOptions = [
        [{ 'header': [1, 2, 3, false] }, { 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'align': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean']
    ];

    const simpleToolbarOptions = [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
    ];

    if (questionEditorEl && !window._quillQuestion) {
        window._quillQuestion = new Quill('#q-text-editor', {
            theme: 'snow',
            placeholder: 'Tulis atau format pertanyaan soal di sini (dukung gambar, tabel, rumus, tebal, miring, dll)...',
            modules: { toolbar: fullToolbarOptions }
        });
        window._quillQuestion.on('text-change', () => {
            const html = window._quillQuestion.root.innerHTML;
            const ta = document.getElementById('q-text');
            if (ta) ta.value = (html === '<p><br></p>' ? '' : html);
        });
    }

    if (answerEditorEl && !window._quillAnswer) {
        window._quillAnswer = new Quill('#q-answer-text-editor', {
            theme: 'snow',
            placeholder: 'Tuliskan pembahasan atau kunci jawaban esai di sini...',
            modules: { toolbar: simpleToolbarOptions }
        });
        window._quillAnswer.on('text-change', () => {
            const html = window._quillAnswer.root.innerHTML;
            const ta = document.getElementById('q-answer-text');
            if (ta) ta.value = (html === '<p><br></p>' ? '' : html);
        });
    }

    if (quizzEditorEl && !window._quillQuizz) {
        window._quillQuizz = new Quill('#quizz-question-editor', {
            theme: 'snow',
            placeholder: 'Tulis pertanyaan quizz interaktif di sini...',
            modules: { toolbar: fullToolbarOptions }
        });
        window._quillQuizz.on('text-change', () => {
            const html = window._quillQuizz.root.innerHTML;
            const ta = document.getElementById('quizz-question');
            if (ta) ta.value = (html === '<p><br></p>' ? '' : html);
        });
    }
}

function setQuillContent(editorKey, html) {
    let q;
    if (editorKey === 'question') q = window._quillQuestion;
    else if (editorKey === 'answer') q = window._quillAnswer;
    else if (editorKey === 'quizz') q = window._quillQuizz;

    if (!q) return;
    if (!html || html.trim() === '') {
        q.setContents([]);
    } else {
        q.clipboard.dangerouslyPasteHTML(html);
    }
}

function getQuillContent(editorKey) {
    let q, id;
    if (editorKey === 'question') { q = window._quillQuestion; id = 'q-text'; }
    else if (editorKey === 'answer') { q = window._quillAnswer; id = 'q-answer-text'; }
    else if (editorKey === 'quizz') { q = window._quillQuizz; id = 'quizz-question'; }

    if (!q) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }
    const html = q.root.innerHTML;
    return (html === '<p><br></p>') ? '' : html;
}

function closeModals() {
    window.isTeacherMode = false;
    if (window.leaderboardInterval) clearInterval(window.leaderboardInterval);
    document.querySelectorAll('[id$="-modal"]').forEach(m => {
        m.classList.remove('flex');
        m.classList.add('hidden');
    });
    const qText = document.getElementById('q-text');
    if (qText) qText.value = '';
    // Clear Quill editors
    if (window._quillQuestion) window._quillQuestion.setContents([]);
    if (window._quillAnswer) window._quillAnswer.setContents([]);
    if (window._quillQuizz) window._quillQuizz.setContents([]);
    document.querySelectorAll('.q-opt').forEach(i => i.value = '');
    const qMapel = document.getElementById('q-mapel');
    const qRombel = document.getElementById('q-rombel');
    if (qMapel) qMapel.value = '';
    if (qRombel) qRombel.value = '';
    const imageUrlInput = document.getElementById('q-image-url');
    if (imageUrlInput) imageUrlInput.value = '';
    const imageFile = document.getElementById('q-image-file');
    if (imageFile) imageFile.value = '';
    const imagesPreview = document.getElementById('q-images-preview');
    if (imagesPreview) imagesPreview.innerHTML = '';
    const imagesList = document.getElementById('q-images-list');
    if (imagesList) imagesList.innerHTML = '';
    window.storedImages = [];
    activeCorrect = 0;

    // Reset Quizz Form States
    if (document.getElementById('quizz-edit-idx')) document.getElementById('quizz-edit-idx').value = '';
    if (document.getElementById('quizz-image-url')) document.getElementById('quizz-image-url').value = '';
    if (document.getElementById('quizz-image-file')) document.getElementById('quizz-image-file').value = '';
    if (document.getElementById('quizz-images-preview')) document.getElementById('quizz-images-preview').innerHTML = '';
    window.storedQuizzImages = [];
}


let selectedTeacherQuestions = new Set();

function openImportSiswaModal() {
    document.getElementById('import-siswa-area').value = "";
    document.getElementById('import-excel-file').value = null;
    document.getElementById('import-siswa-modal').classList.replace('hidden', 'flex');
}

function processImportSiswa() {
    const raw = document.getElementById('import-siswa-area').value.trim();
    if (!raw) return alert("Tempelkan data terlebih dahulu!");

    const rows = raw.split("\n");
    let count = 0;
    let errors = 0;

    rows.forEach(row => {
        // Mendeteksi pemisah tab (Excel default) atau spasi ganda
        let parts = row.split("\t");
        if (parts.length < 2) parts = row.split(/ {2,}/); // Fallback jika dipisah spasi banyak

        if (parts.length >= 2) {
            const nama = parts[0].trim();
            const rombel = parts[1].trim();

            if (nama && rombel) {
                // Generate ID sederhana dari nama + random suffix jika perlu
                const baseId = "DRKS-" + Math.floor(1000 + Math.random() * 9000);

                db.students.push({
                    id: baseId,
                    password: "escrido",
                    name: nama,
                    rombel: rombel,
                    role: "student"
                });
                count++;
            }
        } else {
            errors++;
        }
    });

    save();
    updateCompletionCharts();
    renderAdminStudents();
    closeModals();
    alert(`Berhasil mengimport ${count} siswa. ${errors > 0 ? errors + ' baris gagal diproses.' : ''}`);
}

function handleExcelFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            // convert to tab-delimited text, which matches processImportSiswa expectations
            const csv = XLSX.utils.sheet_to_csv(firstSheet, { FS: '\t' });
            document.getElementById('import-siswa-area').value = csv;
        } catch (err) {
            alert('Gagal membaca file Excel: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function openTeacherImportModal() {
    window.isTeacherMode = true;
    openImportModal();
}

function openTeacherQuestionModal() {
    window.isTeacherMode = true;
    editQuestionIndex = null;
    window.matchingEditOriginalCorrect = null;

    // Initialize Quill editors
    setTimeout(() => initQuillEditors(), 50);

    document.getElementById('q-type').value = 'single';
    // Clear Quill editors
    setTimeout(() => {
        if (window._quillQuestion) window._quillQuestion.setContents([]);
        if (window._quillAnswer) window._quillAnswer.setContents([]);
    }, 80);
    const textEl = document.getElementById('q-text');
    if (textEl) textEl.value = '';
    document.getElementById('q-mapel').value = teacherSubjectNames(currentSiswa)[0] || '';
    document.getElementById('q-image-file').value = '';
    // Clear multiple images preview
    document.getElementById('q-images-preview').innerHTML = '';
    document.getElementById('q-images-list').innerHTML = '';
    window.storedImages = [];
    document.getElementById('q-opts-container').innerHTML = '<input type="text" class="q-opt w-full p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Opsi A"><input type="text" class="q-opt w-full p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Opsi B"><input type="text" class="q-opt w-full p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Opsi C"><input type="text" class="q-opt w-full p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Opsi D">';
    document.getElementById('q-tf-container').innerHTML = '<div class="tf-row flex items-center gap-2"><input type="text" class="tf-statement flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Pernyataan"><select class="tf-correct p-3 bg-slate-50 rounded-xl text-sm border-none"><option value="">--Benar/Salah--</option><option value="true">Benar</option><option value="false">Salah</option></select><button type="button" onclick="removeTfRow(this)" class="text-red-500">&times;</button></div><button type="button" onclick="addTfRow()" class="mt-2 text-sm text-sky-600">+ Tambah Pernyataan</button>';
    document.getElementById('q-matching-container').innerHTML = '<div class="grid grid-cols-2 gap-4"><div><label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Pertanyaan (Kiri)</label><div id="q-matching-questions" class="space-y-2"><div class="matching-q-row flex items-center gap-2"><input type="text" class="matching-question flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Pertanyaan 1"><button type="button" onclick="removeMatchingQRow(this)" class="text-red-500">&times;</button></div></div><button type="button" onclick="addMatchingQRow()" class="mt-2 text-sm text-sky-600">+ Tambah Pertanyaan</button></div><div><label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Jawaban (Kanan)</label><div id="q-matching-answers" class="space-y-2"><div class="matching-a-row flex items-center gap-2"><input type="text" class="matching-answer flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Jawaban 1"><button type="button" onclick="removeMatchingARow(this)" class="text-red-500">&times;</button></div></div><button type="button" onclick="addMatchingARow()" class="mt-2 text-sm text-sky-600">+ Tambah Jawaban</button></div></div>';
    document.getElementById('save-question-btn').textContent = 'SIMPAN SOAL';
    window.isTeacherMode = true;
    editQuestionIndex = null;

    // Populate selects with filters
    populateSelects(['q-mapel', 'q-rombel']);

    // Filter for teacher mode
    const teacher = currentSiswa;
    if (teacher) {
        // Filter mapel
        const mapelSelect = document.getElementById('q-mapel');
        if (mapelSelect && teacher.subjects) {
            const names = teacherSubjectNames(teacher);
            mapelSelect.innerHTML = '<option value="">--Pilih Mapel--</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
        }
        // Filter rombel
        const rombelSelect = document.getElementById('q-rombel');
        if (rombelSelect) {
            const updateRombels = (chosenMapel) => {
                let rombelsToUse;
                if (chosenMapel) {
                    rombelsToUse = teacherAllowedRombels(teacher, chosenMapel);
                } else {
                    rombelsToUse = teacher.rombels && teacher.rombels.length > 0 ? teacher.rombels : db.rombels;
                }
                rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
            };
            updateRombels(mapelSelect.value);
            mapelSelect.addEventListener('change', () => updateRombels(mapelSelect.value));
        }
    }

    document.getElementById('question-modal').classList.replace('hidden', 'flex');
    updateQuestionTypeDisplay('single');
}

function saveTeacherQuestion() {
    const text = getQuillContent('question');
    const options = Array.from(document.querySelectorAll('.q-opt')).map(i => i.value);
    const mapel = document.getElementById('q-mapel').value;
    const rombel = document.getElementById('q-rombel').value;
    let imagesData = window.storedImages || [];
    window.storedImages = [];

    const type = document.getElementById('q-type').value;
    if (!text) return alert("Lengkapi pertanyaan!");
    if (!mapel || !teacherSubjectNames(currentSiswa).includes(mapel)) {
        alert('Pilih mata pelajaran yang Anda ajar!');
        return;
    }
    if (!rombel) {
        alert('Pilih rombel yang Anda ajar!');
        return;
    }
    const allowedRombels = teacherAllowedRombels(currentSiswa, mapel);
    if (!allowedRombels.includes(rombel)) {
        alert('Rombel tidak valid untuk mata pelajaran tersebut!');
        return;
    }

    let record = { text, mapel, rombel, type, images: imagesData };

    if (type === 'multiple') {
        if (options.some(o => !o)) return alert("Lengkapi semua pilihan!");
        const corr = activeCorrectMultiple.slice();
        if (corr.length < 2 || corr.length > 3) return alert('Pilih 2-3 jawaban benar untuk soal pilihan ganda kompleks!');
        record.options = options;
        record.correct = corr;
    } else if (type === 'text') {
        const ans = getQuillContent('answer').trim();
        if (!ans) return alert('Tuliskan jawaban esai yang benar!');
        record.correct = ans;
    } else if (type === 'tf') {
        const rows = Array.from(document.querySelectorAll('#q-tf-container .tf-row'));
        if (rows.length === 0) return alert('Tambahkan minimal satu pernyataan!');
        const stmts = [];
        const corrs = [];
        for (const r of rows) {
            const stmt = r.querySelector('.tf-statement').value.trim();
            const sel = r.querySelector('.tf-correct').value;
            if (!stmt || sel === '') return alert('Lengkapi pernyataan dan pilih Benar/Salah!');
            stmts.push(stmt);
            corrs.push(sel === 'true');
        }
        record.options = stmts;
        record.correct = corrs;
    } else if (type === 'matching') {
        const qRows = Array.from(document.querySelectorAll('#q-matching-questions .matching-question'));
        const aRows = Array.from(document.querySelectorAll('#q-matching-answers .matching-answer'));
        const questions = qRows.map(inp => inp.value.trim()).filter(v => v);
        const answers = aRows.map(inp => inp.value.trim()).filter(v => v);
        if (questions.length === 0 || answers.length === 0) return alert('Tambahkan minimal satu pertanyaan dan satu jawaban!');
        if (answers.length < questions.length) return alert('Jumlah jawaban minimal harus sama dengan jumlah pertanyaan!');
        record.questions = questions;
        record.answers = answers;
        const preserveCorrect = Array.isArray(window.matchingEditOriginalCorrect) && window.matchingEditOriginalCorrect.length === questions.length
            && window.matchingEditOriginalCorrect.every(orig => answers.some(ans => String(ans).trim().toLowerCase() === String(orig).trim().toLowerCase()));
        record.correct = preserveCorrect ? window.matchingEditOriginalCorrect.slice() : answers.slice(0, questions.length);
    } else {
        // single choice
        if (options.some(o => !o)) return alert("Lengkapi semua pilihan!");
        record.options = options;
        record.correct = activeCorrect;
    }

    if (editQuestionIndex !== null) {
        db.questions[editQuestionIndex] = record;
    } else {
        db.questions.push(record);
    }

    save();
    renderTeacherQuestions();
    closeModals();
    alert('Soal berhasil disimpan!');
}

function editTeacherQuestion(index) {
    try {
        if (index < 0 || index >= db.questions.length) {
            alert('Soal tidak ditemukan!');
            return;
        }
        window.isTeacherMode = true;
        openEditQuestionModal(index);

        // Override modal title and button text for teacher view
        const titleEl = document.getElementById('question-modal-title');
        const btnEl = document.getElementById('save-question-btn');
        const rombelEl = document.getElementById('q-rombel');
        if (titleEl) titleEl.textContent = 'Edit Soal';
        if (btnEl) btnEl.textContent = 'PERBARUI SOAL';

        // Disable rombel edit for teachers as it should remain consistent
        if (rombelEl) rombelEl.disabled = true;
    } catch (error) {
        console.error('Error in editTeacherQuestion:', error);
        alert('Terjadi kesalahan saat membuka edit soal: ' + error.message);
    }
}

function loadMnWeights() {
    const weights = JSON.parse(localStorage.getItem('mn_weights') || '{"harian":50,"kelas":25,"uas":25}');
    document.getElementById('mn-weight-harian').value = weights.harian;
    document.getElementById('mn-weight-kelas').value = weights.kelas;
    document.getElementById('mn-weight-uas').value = weights.uas;
    updateMnWeightsDisplay();
}

function updateMnWeights() {
    const h = parseFloat(document.getElementById('mn-weight-harian').value) || 0;
    const k = parseFloat(document.getElementById('mn-weight-kelas').value) || 0;
    const u = parseFloat(document.getElementById('mn-weight-uas').value) || 0;

    updateMnWeightsDisplay();
    localStorage.setItem('mn_weights', JSON.stringify({ harian: h, kelas: k, uas: u }));

    // Recalculate all rows
    document.querySelectorAll('#mn-table-body tr').forEach(tr => {
        const first = tr.querySelector('input');
        if (first) calculateMnRow(first);
    });
}

function updateMnWeightsDisplay() {
    const h = parseFloat(document.getElementById('mn-weight-harian').value) || 0;
    const k = parseFloat(document.getElementById('mn-weight-kelas').value) || 0;
    const u = parseFloat(document.getElementById('mn-weight-uas').value) || 0;
    const total = h + k + u;
    const el = document.getElementById('mn-weight-total');
    if (el) {
        el.textContent = `TOTAL: ${total}%`;
        if (total === 100) {
            el.className = 'px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full font-black text-[10px] tracking-widest border border-emerald-100 shadow-sm shadow-emerald-50 self-end';
        } else {
            el.className = 'px-4 py-2 bg-red-50 text-red-600 rounded-full font-black text-[10px] tracking-widest border border-red-100 shadow-sm self-end';
        }
    }
}

function renderManajemenNilaiFilters() {
    const mapelSelect = document.getElementById('mn-filter-mapel');
    const rombelSelect = document.getElementById('mn-filter-rombel');
    if (!currentSiswa || !currentSiswa.subjects) return;

    if (mapelSelect) {
        const currentValue = mapelSelect.value;
        const teacherSubjects = teacherSubjectNames(currentSiswa);
        mapelSelect.innerHTML = '<option value="">--Pilih Mapel--</option>' +
            teacherSubjects.map(name => `<option value="${name}"${name === currentValue ? ' selected' : ''}>${name}</option>`).join('');
    }

    if (rombelSelect) {
        const currentValue = rombelSelect.value;
        const selectedMapel = mapelSelect?.value;
        let rombels = [];
        if (selectedMapel) {
            rombels = teacherAllowedRombels(currentSiswa, selectedMapel);
        } else {
            rombels = teacherCombinedRombels(currentSiswa);
        }
        rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' +
            rombels.map(r => `<option value="${r}"${r === currentValue ? ' selected' : ''}>${r}</option>`).join('');
    }
}

async function renderManajemenNilai() {
    const mapel = document.getElementById('mn-filter-mapel').value;
    const rombel = document.getElementById('mn-filter-rombel').value;
    const thead = document.getElementById('mn-table-head');
    const tbody = document.getElementById('mn-table-body');
    const countU = parseInt(document.getElementById('mn-count-u').value) || 3;
    const countT = parseInt(document.getElementById('mn-count-t').value) || 3;

    if (!mapel || !rombel) {
        if (thead) thead.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400 italic text-xs">Silakan pilih Rombel dan Mapel untuk menampilkan data.</td></tr>';
        return;
    }

    // Render THEAD dynamically
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th rowspan="2" style="text-align:left; min-width:140px;">Nama Siswa</th>
                <th colspan="${countU}" style="text-align:center; color:#818cf8; border-left:2px solid #e0e7ff;">Ulangan Harian</th>
                <th colspan="${countT}" style="text-align:center; color:#f59e0b; border-left:2px solid #fef3c7;">Tugas / Mandiri</th>
                <th rowspan="2" style="text-align:center; min-width:56px; border-left:2px solid #e2e8f0;">Kelas</th>
                <th rowspan="2" style="text-align:center; min-width:56px; border-left:2px solid #dbeafe; color:#1d4ed8;">UAS</th>
                <th rowspan="2" style="text-align:center; min-width:64px; border-left:2px solid #e2e8f0; background:#f1f5f9; color:#0f172a;">Nilai Akhir</th>
            </tr>
            <tr>
                ${Array.from({ length: countU }).map((_, i) => `<th style="text-align:center; color:#818cf8; border-left:${i === 0 ? '2px solid #e0e7ff' : 'none'};">U${i + 1}</th>`).join('')}
                ${Array.from({ length: countT }).map((_, i) => `<th style="text-align:center; color:#d97706; border-left:${i === 0 ? '2px solid #fef3c7' : 'none'};">T${i + 1}</th>`).join('')}
            </tr>
        `;
    }

    try {
        const [gradesRes, resultsRes] = await Promise.all([
            fetch(getApiBaseUrl() + `/api/grades?mapel=${encodeURIComponent(mapel)}&rombel=${encodeURIComponent(rombel)}`),
            fetch(getApiBaseUrl() + `/api/results?mapel=${encodeURIComponent(mapel)}&rombel=${encodeURIComponent(rombel)}&limit=-1`)
        ]);

        const grades = await gradesRes.json();
        const resultsRaw = await resultsRes.json();
        const results = Array.isArray(resultsRaw) ? resultsRaw : (resultsRaw.items || []);

        const students = db.students.filter(s => s.rombel === rombel && s.role === 'student');

        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${4 + countU + countT}" class="px-6 py-12 text-center text-slate-400 font-bold text-xs">Tidak ada siswa yang terdaftar di rombel ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = students.map(s => {
            const g = (Array.isArray(grades) ? grades : []).find(x => String(x.student_id).toLowerCase() === String(s.id).toLowerCase()) || {};
            const r = results.find(x => String(x.studentId || x.student_id || x.id || "").trim().toLowerCase() === String(s.id).toLowerCase().trim() && !x.deleted);

            // Extract values from flexible JSON if available
            let extra = {};
            try { extra = typeof g.data === 'string' ? JSON.parse(g.data) : (g.data || {}); } catch (e) { }

            const uVals = Array.isArray(extra.u) ? extra.u : [g.u1, g.u2, g.u3];
            const tVals = Array.isArray(extra.t) ? extra.t : [g.t1, g.t2, g.t3];

            const uasVal = (g.uas !== undefined && g.uas !== 0) ? g.uas : (r ? r.score : 0);
            const kelasVal = (g.kelas !== undefined) ? g.kelas : 100;

            return `
                <tr data-student-id="${s.id}">
                    <td style="padding:0.6rem 1rem; font-weight:700; color:#374151; font-size:0.78rem; white-space:nowrap;">${s.name}</td>
                    ${Array.from({ length: countU }).map((_, i) => `
                        <td style="padding:0.25rem 0.2rem; border-left:${i === 0 ? '2px solid #e0e7ff' : 'none'};"><input type="number" class="mn-input" value="${uVals[i] || 0}" oninput="calculateMnRow(this)" data-field="u" data-idx="${i}"></td>
                    `).join('')}
                    ${Array.from({ length: countT }).map((_, i) => `
                        <td style="padding:0.25rem 0.2rem; border-left:${i === 0 ? '2px solid #fef3c7' : 'none'}; background:rgba(254,243,199,0.2);"><input type="number" class="mn-input" value="${tVals[i] || 0}" oninput="calculateMnRow(this)" data-field="t" data-idx="${i}"></td>
                    `).join('')}
                    <td style="padding:0.25rem 0.2rem; border-left:2px solid #e2e8f0;"><input type="number" class="mn-input" value="${kelasVal}" oninput="calculateMnRow(this)" data-field="kelas"></td>
                    <td style="padding:0.25rem 0.2rem; border-left:2px solid #dbeafe;"><input type="number" class="mn-input uas-input" value="${uasVal}" oninput="calculateMnRow(this)" data-field="uas"></td>
                    <td class="mn-final-grade">0</td>
                </tr>
            `;
        }).join('');


        // Initial trigger
        document.querySelectorAll('#mn-table-body tr').forEach(tr => {
            const first = tr.querySelector('input');
            if (first) calculateMnRow(first);
        });
    } catch (e) {
        console.error('renderManajemenNilai Error:', e);
    }
}

async function saveManajemenNilai() {
    const mapel = document.getElementById('mn-filter-mapel').value;
    const rombel = document.getElementById('mn-filter-rombel').value;
    if (!mapel || !rombel) return alert('Pilih Mapel dan Rombel lebih dulu.');

    const rows = document.querySelectorAll('#mn-table-body tr');
    const dataArr = Array.from(rows).map(tr => {
        const uVals = Array.from(tr.querySelectorAll('[data-field="u"]')).map(i => parseFloat(i.value) || 0);
        const tVals = Array.from(tr.querySelectorAll('[data-field="t"]')).map(i => parseFloat(i.value) || 0);

        return {
            student_id: tr.dataset.studentId,
            mapel,
            rombel,
            // Keep first 3 for legacy columns in DB table
            u1: uVals[0] || 0, u2: uVals[1] || 0, u3: uVals[2] || 0,
            t1: tVals[0] || 0, t2: tVals[1] || 0, t3: tVals[2] || 0,
            kelas: parseFloat(tr.querySelector('[data-field="kelas"]').value) || 0,
            uas: parseFloat(tr.querySelector('[data-field="uas"]').value) || 0,
            nilai_akhir: parseFloat(tr.querySelector('.mn-final-grade').textContent) || 0,
            data: { u: uVals, t: tVals } // Flexible storage for JSON column
        };
    });

    try {
        const res = await fetch(getApiBaseUrl() + '/api/grades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataArr)
        });
        if (res.ok) {
            alert('Nilai berhasil disimpan!');
        } else {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Simpan gagal (Server error)');
        }
    } catch (e) {
        alert('Gagal menyimpan nilai: ' + e.message);
    }
}

function exportGradesToExcel() {
    const mapel = document.getElementById('mn-filter-mapel').value;
    const rombel = document.getElementById('mn-filter-rombel').value;
    if (!mapel || !rombel) return alert('Pilih data per Mapel dan Rombel.');

    const table = document.querySelector('#teacher-tab-manajemen-nilai table');
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `REKAP_NILAI_${mapel}_${rombel}.xlsx`);
}

async function renderTeacherResults() {
    await ensureDataLoaded('results');
    const mapelSelect = document.getElementById('teacher-results-filter-mapel');
    const rombelSelect = document.getElementById('teacher-results-filter-rombel');
    const tbody = document.getElementById('teacher-results-table-body');

    if (!currentSiswa || !currentSiswa.subjects) {
        console.warn('[TEACHER] No active session or subjects found.');
        return;
    }

    // Populate mapel filter using normalized subject names
    if (mapelSelect) {
        const currentValue = mapelSelect.value;
        const teacherSubjects = teacherSubjectNames(currentSiswa);
        mapelSelect.innerHTML = '<option value="">Semua Mata Pelajaran</option>' +
            teacherSubjects.map(name => {
                return `<option value="${name}"${name === currentValue ? ' selected' : ''}>${name}</option>`;
            }).join('');
    }

    // Populate rombel filter with all available rombels
    if (rombelSelect) {
        const currentValue = rombelSelect.value;
        const allRombels = db.rombels || [];
        const additionalOptions = allRombels.map(r =>
            `<option value="${r}"${r === currentValue ? ' selected' : ''}>${r}</option>`
        ).join('');
        rombelSelect.innerHTML = '<option value="">Semua Rombel</option>' + additionalOptions;
    }

    // Filter results
    const selectedMapel = mapelSelect ? mapelSelect.value : '';
    const selectedRombel = rombelSelect ? rombelSelect.value : '';

    let results = db.results.filter(r => {
        // Filter out deleted results
        if (r.deleted) return false;

        // Filter by teacher's subjects
        if (!teacherSubjectNames(currentSiswa).includes(r.mapel)) return false;
        // also restrict by rombels assigned for that subject
        const allowed = teacherAllowedRombels(currentSiswa, r.mapel);
        if (!allowed.includes(r.rombel)) return false;

        // Filter by selected mapel
        if (selectedMapel && r.mapel !== selectedMapel) return false;

        // Filter by selected rombel
        if (selectedRombel && r.rombel !== selectedRombel) return false;

        return true;
    });

    // Sort results by date (newest first)
    // FIXED: use Date constructor for ISO strings
    results.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    console.log(`[TEACHER] Rendering ${results.length} results.`);

    // Display results in table
    tbody.innerHTML = results.map((r) => {
        // Finding index in global db.results for detail view
        const resultIndex = db.results.indexOf(r);
        if (resultIndex === -1) return '';

        const hasEssay = Array.isArray(r.questions) && r.questions.some(q => q.type === 'text');
        const allEssayDone = hasEssay && Array.isArray(r.questions) &&
            r.questions.every((q, qi) => q.type !== 'text' || (r.manualScores && r.manualScores[qi] !== undefined && r.manualScores[qi] !== null));
        const scoreDisplay = r.score != null && !isNaN(Number(r.score)) ? Number(r.score).toFixed(1) : '-';

        let aiBtn = '';
        if (hasEssay) {
            if (allEssayDone) {
                aiBtn = `<button onclick="batchAiCorrectEssay(${resultIndex})" id="ai-batch-btn-${resultIndex}" title="Koreksi ulang semua esai dengan AI" class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 hover:bg-violet-200 text-violet-700 text-[10px] font-black rounded-lg border border-violet-300 transition-all"><i class="fas fa-robot"></i> ✓ Koreksi Ulang</button>`;
            } else {
                aiBtn = `<button onclick="batchAiCorrectEssay(${resultIndex})" id="ai-batch-btn-${resultIndex}" title="Koreksi semua soal esai dengan AI" class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black rounded-lg transition-all shadow-sm"><i class="fas fa-magic"></i> Koreksi AI</button>`;
            }
        }

        return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-700">${r.studentName}</td>
                    <td class="px-6 py-4 text-xs font-semibold text-slate-500">${r.rombel}</td>
                    <td class="px-6 py-4 text-xs font-bold text-sky-600 uppercase tracking-tighter">${r.mapel}</td>
                    <td class="px-6 py-4 text-[10px] font-medium text-slate-400">${r.date ? new Date(r.date).toLocaleString('id-ID') : '-'}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="font-black text-sky-600 text-lg">${scoreDisplay}</span>
                        ${aiBtn}
                    </td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="viewDetailedResult(${resultIndex})" class="w-8 h-8 rounded-lg bg-sky-50 text-sky-500 hover:bg-sky-100 transition-all shadow-sm mr-2" title="Lihat Jawaban"><i class="fas fa-eye"></i></button>
                        <button onclick="deleteResult(${resultIndex})" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all shadow-sm" title="Hapus"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
    }).join('');

    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400 italic">Belum ada hasil ujian yang sesuai filter</td></tr>';
    }
}

async function renderTeacherQuestions() {
    await ensureDataLoaded('questions');
    const filterSelect = document.getElementById('teacher-filter-mapel');
    const rombelSelect = document.getElementById('teacher-filter-rombel');
    const searchTerm = document.getElementById('teacher-search-questions')?.value?.toLowerCase() || '';
    const selectedSubject = filterSelect ? filterSelect.value : '';
    const selectedRombel = rombelSelect ? rombelSelect.value : '';
    const tbody = document.getElementById('teacher-questions-table-body');
    const selectAllCheckbox = document.getElementById('teacher-select-all-checkbox');

    // Populate mapel filter with normalized subject list
    if (filterSelect && currentSiswa && currentSiswa.role === 'teacher') {
        const current = filterSelect.value;
        const teacherSubjects = teacherSubjectNames(currentSiswa);
        filterSelect.innerHTML = '<option value="">Semua</option>' +
            teacherSubjects.map(name => `<option value="${name}"${name === current ? ' selected' : ''}>${name}</option>`).join('');
    }
    // Populate rombel filter depending on selected subject or combined rombels
    if (rombelSelect && currentSiswa && currentSiswa.role === 'teacher') {
        const current = rombelSelect.value;
        let rombels = [];
        if (selectedSubject) {
            rombels = teacherAllowedRombels(currentSiswa, selectedSubject);
        } else {
            rombels = teacherCombinedRombels(currentSiswa);
        }
        rombelSelect.innerHTML = '<option value="">Semua Rombel</option>' +
            rombels.map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
    }

    if (!currentSiswa || !currentSiswa.subjects) return;

    let list = db.questions.filter(q => {
        const qSubject = q.mapel;
        if (!qSubject) return false;
        const qSubjectName = typeof qSubject === 'string' ? qSubject : qSubject.name || qSubject;

        const tSubjects = teacherSubjectNames(currentSiswa);
        if (!tSubjects.includes(qSubjectName)) return false;

        const allowed = teacherAllowedRombels(currentSiswa, qSubjectName);

        // Use robust comparison (trim and string conversion) to avoid mismatch
        const qRombel = String(q.rombel || '').trim();
        const isAllowed = allowed.some(a => String(a).trim() === qRombel);

        if (!isAllowed) return false;
        return true;
    });


    if (selectedSubject) {
        list = list.filter(q => {
            const qSubject = typeof q.mapel === 'string' ? q.mapel : q.mapel.name || q.mapel;
            return qSubject === selectedSubject;
        });
    }
    if (selectedRombel) {
        list = list.filter(q => q.rombel === selectedRombel);
    }
    if (searchTerm) {
        list = list.filter(q => q.text.toLowerCase().includes(searchTerm));
    }

    const allSelected = list.length > 0 && list.every(q => selectedTeacherQuestions.has(q));
    if (selectAllCheckbox) selectAllCheckbox.checked = allSelected;

    tbody.innerHTML = list.map((q, i) => {
        const subject = typeof q.mapel === 'string' ? q.mapel : q.mapel.name || q.mapel;
        const actualIndex = db.questions.indexOf(q);
        let typeName = { 'single': 'Pilihan Ganda', 'multiple': 'PG Kompleks', 'text': 'Uraian', 'tf': 'Benar/Salah', 'matching': 'Menjodohkan' }[q.type || 'single'] || 'Pilihan Ganda';

        let corrText = '';
        if (q.type === 'multiple') {
            corrText = (Array.isArray(q.correct) ? q.correct.map(x => ['A', 'B', 'C', 'D'][x]).join(',') : q.correct);
        } else if (q.type === 'text') {
            corrText = 'Teks';
        } else if (q.type === 'tf') {
            if (Array.isArray(q.options)) {
                corrText = q.options.map((stmt, j) => {
                    const val = Array.isArray(q.correct) ? q.correct[j] : false;
                    return `${stmt} (${val ? 'Benar' : 'Salah'})`;
                }).join(' / ');
            } else {
                corrText = 'Benar/Salah';
            }
        } else if (q.type === 'matching') {
            corrText = 'Match';
        } else {
            corrText = ['A', 'B', 'C', 'D'][q.correct];
        }

        return `<tr>
                    <td class="px-6 py-4 text-center">
                        <input type="checkbox" id="teacher-select-${actualIndex}" data-index="${actualIndex}" class="rounded border-slate-300 text-sky-600 focus:ring-sky-500" ${selectedTeacherQuestions.has(q) ? 'checked' : ''} onclick="toggleTeacherQuestionSelection(event)">
                    </td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <span class="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">${actualIndex + 1}</span>
                            <div class="flex flex-col gap-1">
                                <button type="button" onclick="moveQuestionUp(${actualIndex})" class="text-slate-400 hover:text-slate-600 text-xs p-1 rounded hover:bg-slate-100 transition-colors ${actualIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${actualIndex === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up"></i></button>
                                <button type="button" onclick="moveQuestionDown(${actualIndex})" class="text-slate-400 hover:text-slate-600 text-xs p-1 rounded hover:bg-slate-100 transition-colors ${actualIndex === db.questions.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${actualIndex === db.questions.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down"></i></button>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div style="word-wrap: break-word; white-space: pre-wrap; max-width: none;" class="font-bold mb-1">${normalizeHtmlImages(q.text)}</div>
                        ${q.type === 'tf' && Array.isArray(q.options) && q.options.length > 0 ? `
                            <div class="mt-2 pl-3 border-l-2 border-sky-200 space-y-1">
                                ${q.options.map((opt, idx) => `<div class="text-xs text-slate-600"><span class="font-bold text-sky-600 mr-1">${idx + 1}.</span> ${opt}</div>`).join('')}
                            </div>
                        ` : ''}
                        ${(q.images && Array.isArray(q.images) && q.images.length > 0) ? `
                            <div class="flex items-center gap-2 mt-1">
                                <img src="${normalizeImgSrc(q.images[0])}" class="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in" onclick="Swal.fire({imageUrl: '${normalizeImgSrc(q.images[0])}', showConfirmButton: false, customClass: {popup: 'rounded-3xl border-none shadow-2xl'}})">
                                <span class="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">${q.images.length} Gambar</span>
                            </div>
                        ` : (q.image ? `
                            <div class="flex items-center gap-2 mt-1">
                                <img src="${normalizeImgSrc(q.image)}" class="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in" onclick="Swal.fire({imageUrl: '${normalizeImgSrc(q.image)}', showConfirmButton: false, customClass: {popup: 'rounded-3xl border-none shadow-2xl'}})">
                                <span class="text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">1 Gambar</span>
                            </div>
                        ` : '')}
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col gap-1 items-start">
                            <span class="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-bold text-center inline-block">${subject}</span>
                            <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold text-center inline-block">${q.rombel}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span style="word-wrap: break-word; white-space: pre-wrap; max-width: none; font-weight: bold; color: #0369a1; font-size: 0.875rem;">${corrText}</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center justify-center px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold whitespace-nowrap">${typeName}</span>
                    </td>
                    <td class="px-6 py-4 text-center flex gap-1 justify-center">
                        <button type="button" class="p-2 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" onclick="viewQuestion(${actualIndex})" title="Lihat">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="p-2 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" onclick="editTeacherQuestion(${actualIndex})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onclick="deleteQuestion(${actualIndex})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
    }).join('');

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-500 text-sm">Tidak ada soal ditemukan.</td></tr>`;
    }
}

function toggleTeacherQuestionSelection(event) {
    const idx = Number(event.target.dataset.index);
    if (Number.isNaN(idx)) return;
    const question = db.questions[idx];
    if (!question) return;
    if (event.target.checked) {
        selectedTeacherQuestions.add(question);
    } else {
        selectedTeacherQuestions.delete(question);
    }
    renderTeacherQuestions();
}

function deleteSelectedTeacherQuestions() {
    if (selectedTeacherQuestions.size === 0) {
        return alert('Pilih soal yang ingin dihapus terlebih dahulu.');
    }
    if (!confirm(`Hapus ${selectedTeacherQuestions.size} soal terpilih?`)) return;
    loadedCollections.questions = true;
    db.questions = db.questions.filter(q => !selectedTeacherQuestions.has(q));
    selectedTeacherQuestions.clear();
    save();
    renderTeacherQuestions();
}

let teacherResultsPollInterval = null;

function openPaketSoalDetail(mapel, rombel) {
    currentDetailPackage = { mapel, rombel };
    switchAdminBankSoalTab('detail');
}

function deletePaketSoal(mapel, rombel) {
    if (confirm(`Apakah Anda yakin ingin menghapus semua soal untuk Mapel ${mapel} dan Rombel ${rombel}?`)) {
        loadedCollections.questions = true;
        db.questions = db.questions.filter(q => !(q.mapel === mapel && q.rombel === rombel));
        save();
        renderAdminPaketSoal();
        if (currentDetailPackage && currentDetailPackage.mapel === mapel && currentDetailPackage.rombel === rombel) {
            closePaketDetail();
        }
    }
}

function sortPaketSoal(by) {
    if (currentSortBy === by) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortBy = by;
        currentSortOrder = 'asc';
    }
    renderAdminPaketSoal();
}

function closePaketDetail() {
    currentDetailPackage = null;
    switchAdminBankSoalTab('paket');
}

function populateRaportFilters() {
    const rombelSelect = document.getElementById('raport-filter-rombel');
    const siswaSelect = document.getElementById('raport-filter-siswa');
    if (rombelSelect) {
        const rombels = Array.isArray(db.rombels) ? db.rombels : [];
        rombelSelect.innerHTML = '<option value="ALL">Semua Rombel</option>' + rombels.map(r => `<option value="${r}">${r}</option>`).join('');
    }
    updateRaportSiswaFilter('ALL');

    // Sync school settings to raport filters
    const stats = db.schoolSettings || {};
    const kName = document.getElementById('raport-kepala-name');
    if (kName && stats.principal) kName.value = stats.principal;

    const kTahun = document.getElementById('raport-tahun');
    if (kTahun) {
        kTahun.value = stats.tahun || '2026/2027';
    }

    const kSem = document.getElementById('raport-semester');
    if (kSem) kSem.value = stats.semester || 'GANJIL';
}

function updateRaportSiswaFilter(selectedRombel) {
    const siswaSelect = document.getElementById('raport-filter-siswa');
    if (!siswaSelect) return;

    let students = Array.isArray(db.students) ? db.students.filter(s => s.role === 'student') : [];

    if (selectedRombel && selectedRombel !== 'ALL') {
        students = students.filter(s => s.rombel === selectedRombel);
    }

    students = students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const showRombel = selectedRombel === 'ALL';
    siswaSelect.innerHTML = '<option value="ALL">Semua Siswa</option>' + students.map(s => `<option value="${s.id}">${s.name}${showRombel ? ` (${s.rombel || '-'})` : ''}</option>`).join('');

    // Reset siswa selection to ALL if current selection is not in the filtered list
    const currentSiswa = siswaSelect.value;
    if (currentSiswa !== 'ALL' && !students.some(s => s.id === currentSiswa)) {
        siswaSelect.value = 'ALL';
    }
}

function addTfRow() {
    const container = document.getElementById('q-tf-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'tf-row flex items-center gap-2';
    row.innerHTML = `
                <input type="text" class="tf-statement flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Pernyataan">
                <select class="tf-correct p-3 bg-slate-50 rounded-xl text-sm border-none">
                    <option value="">--Benar/Salah--</option>
                    <option value="true">Benar</option>
                    <option value="false">Salah</option>
                </select>
                <button type="button" onclick="removeTfRow(this)" class="text-red-500">&times;</button>
            `;

    // Find the add button (has addTfRow in onclick)
    const addButton = container.querySelector('button[onclick*="addTfRow"]');
    if (addButton) {
        container.insertBefore(row, addButton);
    } else {
        // Fallback: just append to container
        container.appendChild(row);
    }
}

function removeTfRow(btn) {
    const row = btn.closest('.tf-row');
    if (row) row.remove();
}

function addMatchingQRow() {
    const container = document.getElementById('q-matching-questions');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'matching-q-row flex items-center gap-2';
    row.innerHTML = `
                <input type="text" class="matching-question flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Pertanyaan ${container.children.length + 1}">
                <button type="button" onclick="removeMatchingQRow(this)" class="text-red-500">&times;</button>
            `;

    container.appendChild(row);
}

function removeMatchingQRow(btn) {
    const row = btn.closest('.matching-q-row');
    if (row) row.remove();
}

function openQuestionModal() {
    console.log('openQuestionModal called');
    try {
        editQuestionIndex = null;
        window.matchingEditOriginalCorrect = null;

        // Show the modal first
        const modal = document.getElementById('question-modal');
        if (!modal) {
            console.error('question-modal not found');
            return;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Initialize Quill editors
        setTimeout(() => initQuillEditors(), 50);

        // Reset form fields
        const typeEl = document.getElementById('q-type');
        if (typeEl) typeEl.value = 'single';

        // Clear Quill question editor
        setTimeout(() => {
            if (window._quillQuestion) window._quillQuestion.setContents([]);
            if (window._quillAnswer) window._quillAnswer.setContents([]);
        }, 80);

        const textEl = document.getElementById('q-text');
        if (textEl) textEl.value = '';

        const ansEl = document.getElementById('q-answer-text');
        if (ansEl) ansEl.value = '';

        // Clear options
        document.querySelectorAll('.q-opt').forEach(opt => {
            opt.value = '';
        });

        // Clear image
        const imgFile = document.getElementById('q-image-file');
        if (imgFile) imgFile.value = null;

        // Clear multiple images preview
        const imgPreviewContainer = document.getElementById('q-images-preview');
        if (imgPreviewContainer) imgPreviewContainer.innerHTML = '';
        const imgListContainer = document.getElementById('q-images-list');
        if (imgListContainer) imgListContainer.innerHTML = '';
        window.storedImages = [];

        // Reset TF rows
        const tfCont = document.getElementById('q-tf-container');
        if (tfCont) {
            tfCont.querySelectorAll('.tf-row').forEach(r => r.remove());
            if (typeof addTfRow === 'function') {
                addTfRow();
                addTfRow();
            }
        }

        // Populate dropdowns and update UI
        populateSelects(['q-mapel', 'q-rombel']);

        // Filter for teacher mode
        if (window.isTeacherMode) {
            const teacher = db.students.find(s => s.id === currentSiswa.id);
            if (teacher) {
                // Filter mapel
                const mapelSelect = document.getElementById('q-mapel');
                if (mapelSelect && teacher.subjects) {
                    const names = teacherSubjectNames(teacher);
                    mapelSelect.innerHTML = '<option value="">--Pilih Mapel--</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
                }
                // Filter rombel (update when mapel changes)
                const rombelSelect = document.getElementById('q-rombel');
                if (rombelSelect) {
                    const updateRombs = (chosen) => {
                        let rombelsToUse;
                        if (chosen) {
                            rombelsToUse = teacherAllowedRombels(teacher, chosen);
                        } else {
                            rombelsToUse = teacherCombinedRombels(teacher).length > 0 ? teacherCombinedRombels(teacher) : db.rombels;
                        }
                        rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
                    };
                    updateRombs(mapelSelect ? mapelSelect.value : '');
                    if (mapelSelect) mapelSelect.addEventListener('change', () => updateRombs(mapelSelect.value));
                }
            }
        }

        onQuestionTypeChange();

        console.log('openQuestionModal completed successfully');
    } catch (err) {
        console.error('Error opening question modal:', err, err.stack);
        alert('Terjadi kesalahan: ' + err.message);
    }
}

function openEditQuestionModal(idx) {
    editQuestionIndex = idx;
    window.matchingEditOriginalCorrect = null;
    const q = db.questions[idx];
    populateSelects(['q-mapel', 'q-rombel']);

    // Filter for teacher mode
    if (window.isTeacherMode) {
        const teacher = db.students.find(s => s.id === currentSiswa.id);
        if (teacher) {
            // Filter mapel
            const mapelSelect = document.getElementById('q-mapel');
            if (mapelSelect && teacher.subjects) {
                const names = teacherSubjectNames(teacher);
                mapelSelect.innerHTML = '<option value="">--Pilih Mapel--</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
            }
            // Filter rombel (update when mapel changes)
            const rombelSelect = document.getElementById('q-rombel');
            if (rombelSelect) {
                const updateRombs = (chosen) => {
                    let rombelsToUse;
                    if (chosen) {
                        rombelsToUse = teacherAllowedRombels(teacher, chosen);
                    } else {
                        rombelsToUse = teacherCombinedRombels(teacher).length > 0 ? teacherCombinedRombels(teacher) : db.rombels;
                    }
                    rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
                };
                updateRombs(mapelSelect ? mapelSelect.value : '');
                if (mapelSelect) mapelSelect.addEventListener('change', () => updateRombs(mapelSelect.value));
            }
        }
    }

    document.getElementById('q-mapel').value = q.mapel;
    document.getElementById('q-rombel').value = q.rombel;
    // Set Quill content
    setTimeout(() => {
        initQuillEditors();
        setQuillContent('question', q.text || '');
        if (q.type === 'text') {
            setQuillContent('answer', q.correct || '');
        } else {
            if (window._quillAnswer) window._quillAnswer.setContents([]);
        }
    }, 80);
    const textEl = document.getElementById('q-text');
    if (textEl) textEl.value = q.text || '';
    window.matchingEditOriginalCorrect = Array.isArray(q.correct) ? q.correct.slice() : null;
    // Keep hidden textarea in sync for fallback
    const ansEl = document.getElementById('q-answer-text');
    if (q.type === 'text') {
        if (ansEl) ansEl.value = q.correct || '';
    } else {
        if (ansEl) ansEl.value = '';
    }
    document.getElementById('q-type').value = q.type || 'single';
    onQuestionTypeChange();
    if (q.type === 'tf') {
        // SELF-HEALING: If text box contains a long sentence and options are empty/generic
        const textLower = (q.text || '').toLowerCase();
        const looksLikeInstruction = textLower.includes('pilihlah') || textLower.includes('tentukan') || textLower.includes('berikut ini') || textLower.includes('instruksi');
        const isGeneric = (opt) => {
            if (!opt || String(opt).trim() === '') return true;
            const clean = String(opt).replace(/[\[\]\-\(\)\.\–\—\_]/g, '').trim().toLowerCase();
            return /^(benar|salah|true|false|ya|tidak|ok|yes|no|pilihan|option)$/.test(clean);
        };
        const optionsAreGeneric = !q.options || q.options.length === 0 || q.options.every(isGeneric);

        if (q.text && q.text.length > 25 && !looksLikeInstruction && optionsAreGeneric) {
            q.options = [q.text.replace(/^pernyataan\s*[:\-–]\s*/i, '').trim()];
            q.text = "Tentukan apakah pernyataan berikut Benar atau Salah:";
            if (!Array.isArray(q.correct) || q.correct.length === 0) q.correct = [false];
            // Update UI field for main text
            document.getElementById('q-text').value = q.text;
        }

        const tfCont = document.getElementById('q-tf-container');
        if (tfCont) {
            tfCont.querySelectorAll('.tf-row').forEach(r => r.remove());
            // Ensure at least 3 rows if empty, otherwise use existing options
            const optionCount = (Array.isArray(q.options) && q.options.length > 0) ? q.options.length : 3;
            for (let i = 0; i < optionCount; i++) {
                addTfRow();
            }
            document.querySelectorAll('#q-tf-container .tf-row').forEach((row, i) => {
                const inp = row.querySelector('.tf-statement');
                const sel = row.querySelector('.tf-correct');
                if (inp) inp.value = (q.options && q.options[i]) || '';
                if (sel) sel.value = (q.correct && Array.isArray(q.correct) ? String(q.correct[i]) : '');
            });
        }
    } else if (q.type === 'matching') {
        const qCont = document.getElementById('q-matching-questions');
        const aCont = document.getElementById('q-matching-answers');
        if (document.getElementById('q-text')) {
            document.getElementById('q-text').value = q.text || '';
            setTimeout(() => setQuillContent('question', q.text || ''), 80);
        }

        if (qCont && aCont) {
            qCont.innerHTML = '';
            aCont.innerHTML = '';

            const subQs = Array.isArray(q.questions) && q.questions.length ? q.questions : [''];
            let subAs = [];

            // ALIGNMENT LOGIC: Ensure first N slots match correct answers
            if (Array.isArray(q.correct) && q.correct.length > 0) {
                subAs = [...q.correct]; // Use correct answers as the base order
                // Add distractors from q.answers that are NOT in q.correct
                if (Array.isArray(q.answers)) {
                    const correctSet = q.correct.map(c => String(c).trim().toLowerCase());
                    const distractors = q.answers.filter(ans => !correctSet.includes(String(ans).trim().toLowerCase()));
                    subAs = subAs.concat(distractors);
                }
            } else {
                // Fallback to recovery logic if correct array is missing or invalid
                subAs = Array.isArray(q.answers) && q.answers.length ? q.answers : [];
                if (!subAs.length && Array.isArray(q.options) && q.options.length > 0) {
                    subAs = q.options.map(o => String(o)).filter(o => o.trim() !== '');
                }
            }
            if (!subAs.length) subAs = [''];

            // Populate DOM
            subQs.forEach(() => addMatchingQRow());
            subAs.forEach(() => addMatchingARow());

            document.querySelectorAll('#q-matching-questions .matching-question').forEach((inp, i) => {
                if (inp) inp.value = subQs[i] || '';
            });
            document.querySelectorAll('#q-matching-answers .matching-answer').forEach((inp, i) => {
                if (inp) inp.value = subAs[i] || '';
            });
        }
    } else {
        const opts = document.querySelectorAll('.q-opt');
        (q.options || []).forEach((opt, i) => { if (opts[i]) opts[i].value = opt; });
    }
    if (q.type === 'multiple') {
        activeCorrectMultiple = Array.isArray(q.correct) ? q.correct.slice() : [];
    } else {
        activeCorrect = q.correct || 0;
    }
    renderCorrectButtons();

    // Load images for editing
    if (q.images && Array.isArray(q.images) && q.images.length > 0) {
        window.storedImages = q.images.slice();
        renderImagePreviews();
    } else if (q.image) {
        // Backward compatibility for single image
        window.storedImages = [q.image];
        renderImagePreviews();
    } else {
        window.storedImages = [];
        renderImagePreviews();
    }
    document.getElementById('question-modal-title').innerText = 'Edit Soal';
    document.getElementById('save-question-btn').innerText = 'UPDATE SOAL';
    document.getElementById('question-modal').classList.replace('hidden', 'flex');
}

function saveQuestion() {
    const text = getQuillContent('question');
    const options = Array.from(document.querySelectorAll('.q-opt')).map(i => i.value);
    const mapel = document.getElementById('q-mapel').value;
    const rombel = document.getElementById('q-rombel').value;
    let imagesData = window.storedImages || [];
    window.storedImages = [];

    const type = document.getElementById('q-type').value;
    if (type !== 'matching' && !text) return alert("Lengkapi pertanyaan!");
    let record = { text, mapel, rombel, type, images: imagesData };
    if (type === 'multiple') {
        if (options.some(o => !o)) return alert("Lengkapi semua pilihan!");
        const corr = activeCorrectMultiple.slice();
        if (corr.length < 2 || corr.length > 3) return alert('Pilih 2-3 jawaban benar untuk soal pilihan ganda kompleks!');
        record.options = options;
        record.correct = corr;
    } else if (type === 'text') {
        const ans = getQuillContent('answer').trim();
        if (!ans) return alert('Tuliskan jawaban esai yang benar!');
        record.correct = ans;
    } else if (type === 'tf') {
        const rows = Array.from(document.querySelectorAll('#q-tf-container .tf-row'));
        if (rows.length < 1) return alert('Soal Benar/Salah harus memiliki minimal 1 pernyataan!');
        const stmts = [];
        const corrs = [];
        for (const r of rows) {
            const stmt = r.querySelector('.tf-statement').value.trim();
            const sel = r.querySelector('.tf-correct').value;
            if (!stmt || sel === '') return alert('Lengkapi pernyataan dan pilih Benar/Salah!');
            stmts.push(stmt);
            corrs.push(sel === 'true');
        }
        record.options = stmts;
        record.correct = corrs;
    } else if (type === 'matching') {
        const qRows = Array.from(document.querySelectorAll('#q-matching-questions .matching-question'));
        const aRows = Array.from(document.querySelectorAll('#q-matching-answers .matching-answer'));
        const questions = qRows.map(inp => inp.value.trim()).filter(v => v);
        const answers = aRows.map(inp => inp.value.trim()).filter(v => v);
        if (questions.length === 0 || answers.length === 0) return alert('Tambahkan minimal satu pertanyaan dan satu jawaban!');
        if (answers.length < questions.length) return alert('Jumlah jawaban minimal harus sama dengan jumlah pertanyaan!');
        record.questions = questions;
        record.answers = answers;
        // The first N answers in the list are treated as keys for the N questions
        record.correct = answers.slice(0, questions.length);
    } else {
        if (options.some(o => !o)) return alert("Lengkapi semua pilihan!");
        record.options = options;
        record.correct = activeCorrect;
    }
    if (editQuestionIndex !== null) {
        db.questions[editQuestionIndex] = record;
    } else {
        db.questions.push(record);
    }
    save();
    if (window.isTeacherMode) {
        renderTeacherQuestions();
    } else {
        renderAdminQuestions();
    }
    closeModals();
}

function importQuestionsJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) {
                    alert('Format file JSON tidak valid. Harus berupa array soal (JSON).');
                    return;
                }

                let added = 0;
                imported.forEach(q => {
                    // Validasi dasar minimal ada text dan type soal
                    if (q.text && q.type) {
                        db.questions.push(q);
                        added++;
                    }
                });

                if (added > 0) {
                    save();
                    if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
                        renderTeacherQuestions();
                    } else {
                        renderAdminQuestions();
                    }
                    updateStats();
                    alert(`${added} soal berhasil diimport.`);
                } else {
                    alert('Tidak ada soal valid yang ditemukan dalam file ini.');
                }
            } catch (err) {
                alert('Gagal memproses file JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function exportQuestionsExcel() {
    let questionsToExport = [];
    if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
        const fM = document.getElementById('teacher-filter-mapel')?.value || '';
        const fR = document.getElementById('teacher-filter-rombel')?.value || '';
        questionsToExport = db.questions.filter(q => {
            const qSubject = typeof q.mapel === 'string' ? q.mapel : q.mapel?.name || q.mapel;
            if (!teacherSubjectNames(currentSiswa).includes(qSubject)) return false;
            const allowed = teacherAllowedRombels(currentSiswa, qSubject);
            if (!allowed.includes(q.rombel)) return false;
            if (fM && qSubject !== fM) return false;
            if (fR && q.rombel !== fR) return false;
            return true;
        });
    } else {
        const fR = document.getElementById('filter-rombel').value;
        const fM = document.getElementById('filter-mapel').value;
        questionsToExport = db.questions.filter(q =>
            (fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM)
        );
    }

    if (questionsToExport.length === 0) {
        alert('Tidak ada soal yang bisa diexport berdasarkan filter saat ini.');
        return;
    }

    const flatData = questionsToExport.map(q => {
        let opsiText = '';
        if (q.options && Array.isArray(q.options)) {
            opsiText = q.options.join(' || ');
        }
        let kunciText = '';
        if (q.correct !== undefined) {
            if (Array.isArray(q.correct)) {
                kunciText = q.correct.join(' || ');
            } else {
                kunciText = q.correct;
            }
        }

        let matchQ = '';
        let matchA = '';
        if (q.questions && Array.isArray(q.questions)) matchQ = q.questions.join(' || ');
        if (q.answers && Array.isArray(q.answers)) matchA = q.answers.join(' || ');

        return {
            'Tipe': q.type || 'single',
            'Mapel': typeof q.mapel === 'string' ? q.mapel : q.mapel?.name || q.mapel,
            'Rombel': q.rombel || '',
            'Pertanyaan': q.text || '',
            'Opsi': opsiText,
            'Jawaban Benar atau Kunci': kunciText,
            'Pertanyaan Matching (Kiri)': matchQ,
            'Jawaban Matching (Kanan)': matchA,
            'Catatan': 'Gambar tidak dieskpor via format Excel'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BankSoal");

    XLSX.writeFile(workbook, `soal_cbt_export_${new Date().getTime()}.xlsx`);
}

function importQuestionsExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                let added = 0;
                jsonData.forEach(row => {
                    if (row['Pertanyaan']) {
                        let type = row['Tipe'] || 'single';

                        let options = [];
                        if (row['Opsi']) {
                            options = row['Opsi'].toString().split('||').map(s => s.trim()).filter(s => s);
                        }

                        let correctStr = row['Jawaban Benar atau Kunci']?.toString() || '';
                        let correct;
                        if (type === 'multiple' || type === 'tf' || type === 'matching') {
                            correct = correctStr.split('||').map(s => {
                                let trimmed = s.trim();
                                if (trimmed.toLowerCase() === 'true') return true;
                                if (trimmed.toLowerCase() === 'false') return false;
                                if (!isNaN(trimmed) && trimmed !== '') return Number(trimmed);
                                return trimmed;
                            }).filter(s => s !== '');
                        } else {
                            if (!isNaN(correctStr) && correctStr !== '') {
                                correct = Number(correctStr);
                            } else {
                                correct = correctStr;
                            }
                        }

                        let matchQ = [];
                        let matchA = [];
                        if (row['Pertanyaan Matching (Kiri)']) {
                            matchQ = row['Pertanyaan Matching (Kiri)'].toString().split('||').map(s => s.trim());
                        }
                        if (row['Jawaban Matching (Kanan)']) {
                            matchA = row['Jawaban Matching (Kanan)'].toString().split('||').map(s => s.trim());
                        }

                        const newQ = {
                            type: type,
                            mapel: row['Mapel'] || 'General',
                            rombel: row['Rombel'] || '',
                            text: row['Pertanyaan'],
                        };

                        if (options.length > 0) newQ.options = options;
                        if (correct !== undefined && correct !== '') newQ.correct = correct;
                        if (matchQ.length > 0) newQ.questions = matchQ;
                        if (matchA.length > 0) newQ.answers = matchA;

                        db.questions.push(newQ);
                        added++;
                    }
                });

                if (added > 0) {
                    save();
                    if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
                        renderTeacherQuestions();
                    } else {
                        renderAdminQuestions();
                    }
                    updateStats();
                    alert(`${added} soal dari Excel berhasil diimport.`);
                } else {
                    alert('Tidak ada soal valid yang ditemukan dalam file Excel ini atau format kolom tidak sesuai.');
                }
            } catch (err) {
                alert('Gagal memproses file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    input.click();
}

async function openImportModal() {
    populateSelects(['import-mapel', 'import-rombel']);
    if (window.isTeacherMode) {
        const mapelSelect = document.getElementById('import-mapel');
        const teacherSubjects = teacherSubjectNames(currentSiswa);
        mapelSelect.innerHTML = teacherSubjects.map(subj => `<option value="${subj}">${subj}</option>`).join('');
    }
    document.getElementById('import-text-area').value = '';
    document.getElementById('import-word-file').value = null;

    // check backend availability so user isn’t surprised by 404 later
    const warningEl = document.getElementById('import-backend-warning');
    const btn = document.querySelector('[onclick="processImport()"]');
    const fileInput = document.getElementById('import-word-file');
    const backendOk = await pingBackend();
    if (!backendOk) {
        warningEl.textContent = '⚠️ Server tidak tersedia. Jalankan backend untuk menggunakan fitur ini.';
        fileInput.disabled = true;
        btn.disabled = true;
    } else {
        warningEl.textContent = '';
        fileInput.disabled = false;
        btn.disabled = false;
    }

    document.getElementById('import-word-file').value = null;
    document.getElementById('import-modal').classList.replace('hidden', 'flex');
}

function processImport() {
    const mapel = document.getElementById('import-mapel').value;
    const rombel = document.getElementById('import-rombel').value;

    if (window.isTeacherMode && !teacherSubjectNames(currentSiswa).includes(mapel)) {
        alert('Anda hanya dapat mengimport soal untuk mata pelajaran yang Anda ajar!');
        return;
    }

    let added = 0, failed = 0;
    const importLog = [];

    // If Word parsing already produced questions (new backend feature), use them
    if (window.importedQuestions && window.importedQuestions.length > 0) {
        const questions = window.importedQuestions;
        console.log('🔄 Processing', questions.length, 'imported questions');

        questions.forEach((q, idx) => {
            try {
                if (!q.text) {
                    failed++;
                    importLog.push(`❌ Soal ${idx + 1}: Text kosong`);
                    return;
                }
                const qCopy = {
                    ...q,
                    mapel: q.mapel || mapel || 'General',
                    rombel: q.rombel || rombel || ''
                };
                db.questions.push(qCopy);
                added++;
            } catch (err) {
                console.error('Error adding question:', err);
                failed++;
            }
        });

        window.importedQuestions = null;
        window.importCount = 0;
    } else {
        // legacy text import
        let raw = document.getElementById('import-text-area').value.trim();
        if (!raw) return alert('Tempel teks soal terlebih dahulu atau pilih file Word!');

        const blocks = raw.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);

        blocks.forEach(block => {
            // capture everything after "Kunci:" as keyText
            const keyFullMatch = block.match(/kunci\s*[:\-]?\s*(.+)/i);
            let keyText = keyFullMatch ? keyFullMatch[1].trim() : null;
            let keyLetters = [];
            let isEssay = false;
            if (keyText) {
                const letterPattern = /^([A-D](?:\s*,\s*[A-D])*)$/i;
                const letterMatch = keyText.match(letterPattern);
                if (letterMatch) {
                    keyLetters = letterMatch[1].toUpperCase().split(/\s*,\s*/);
                } else {
                    isEssay = true;
                }
            }

            // remove the key line entirely from content
            let content = block.replace(/kunci\s*[:\-]?\s*.+/i, '').trim();

            // split question text and options by detecting markers like A., [ ], or o [ ]
            const parts = content.split(/[\s\n]+(?=(?:[A-D][\.\)\:\-\s]|[o\-\*]?\s*\[[\s_xX]?\])\s*)/i);
            const qText = parts[0].replace(/^[0-9]+\.\s*/, '').trim();
            const opts = [];
            const autoKeys = [];
            for (let i = 1; i < parts.length; i++) {
                const rawOpt = parts[i];
                // Detect if this option is marked as correct [x]
                if (/[o\-\*]?\s*\[[xX]\]/i.test(rawOpt)) {
                    autoKeys.push(i - 1);
                }
                // Clean up the marker
                opts.push(rawOpt.replace(/^(?:[A-D][\.\)\:\-\s]|[o\-\*]?\s*\[[\s_xX]?\])\s*/i, '').trim());
            }

            // fallback: try splitting by letters if no [ ] found but still only 1 part
            if (opts.length < 2) {
                const alt = content.split(/\s+(?=[A-D][\.\)\:\-\s])/i).slice(1);
                if (alt.length >= 2) {
                    opts.length = 0;
                    alt.forEach(a => opts.push(a.trim().replace(/^[A-D][\.\)\:\-\s]\s*/i, '')));
                }
            }

            if (isEssay) {
                // essay type question
                if (qText && keyText) {
                    db.questions.push({ text: qText, mapel, rombel, type: 'text', correct: keyText });
                    added++;
                } else {
                    failed++;
                }
            } else if (opts.length >= 2 && (keyLetters.length > 0 || autoKeys.length > 0)) {
                // multiple-choice question (single or complex)
                let indices = keyLetters.map(l => l.charCodeAt(0) - 65).filter(i => i >= 0 && i < opts.length);

                // If no keyLetters found from "Kunci:", use autoKeys from [x] markers
                if (indices.length === 0 && autoKeys.length > 0) {
                    indices = autoKeys;
                }

                const qType = indices.length > 1 ? 'multiple' : 'single';
                let correctVal = qType === 'multiple' ? indices : indices[0];

                // Limit to 4 options as requested
                const finalOpts = opts.slice(0, 4);
                if (qType === 'multiple' && Array.isArray(correctVal)) {
                    correctVal = correctVal.filter(idx => idx < 4);
                } else if (qType === 'single' && typeof correctVal === 'number' && correctVal >= 4) {
                    correctVal = 0; // fallback
                }

                db.questions.push({ text: qText, options: finalOpts, mapel, rombel, type: qType, correct: correctVal });
                added++;
            } else {
                // unable to parse
                failed++;
                importLog.push(`❌ Soal Gagal: Format tidak dikenali atau kunci jawaban tidak ditemukan (Blok: "${qText.substring(0, 30)}...")`);
            }
        });
    }


    save();

    // Show detailed result
    const resultMsg = `✅ Import Berhasil!\n\nDitambahkan: ${added} soal\n${failed > 0 ? `Gagal: ${failed} soal` : 'Semua soal berhasil diproses!'}`;
    alert(resultMsg);

    console.log('✅ Import complete. Added:', added, 'Failed:', failed);
    console.log(importLog.join('\n'));

    if (window.isTeacherMode) {
        renderTeacherQuestions();
    } else {
        renderAdminQuestions();
    }
    closeModals();
}

function importDatabase(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!confirm('Restore database akan menggantikan data saat ini. Lanjutkan?')) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed && typeof parsed === 'object') {
                db = parsed;
                save();
                alert('Restore berhasil. Halaman akan dimuat ulang.');
                location.reload();
            } else {
                alert('Format file tidak valid.');
            }
        } catch (err) {
            alert('Gagal membaca file: ' + err.message);
        }
    };
    reader.readAsText(file);
    // reset input value so same file can be selected again
    event.target.value = '';
}

async function handleWordFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    // quick backend ping before doing anything else
    const backendOk = await pingBackend();
    if (!backendOk) {
        const textarea = document.getElementById('import-text-area');
        textarea.value = 'Copy Paste secara manual dengan format\n\n' +
            'Contoh format word pilihan ganda\n' +
            '1. Apa itu teks prosedur....\n' +
            'A. Langkah-langkah\n' +
            'B. Rangkaian\n' +
            'C. Informasi\n' +
            'D. Berita\n' +
            'Kunci: A\n\n' +
            'Contoh format word pilihan ganda kompleks\n' +
            '1. Apa itu teks prosedur....\n' +
            'A. Langkah-langkah\n' +
            'B. Rangkaian\n' +
            'C. Informasi\n' +
            'D. Berita\n' +
            'Kunci: A, B\n\n' +
            'Contoh format word urauan/esai\n' +
            '1. Apa itu teks prosedur....\n' +
            'Kunci: Teks yang memuat langkah-langkah';
        alert('Tidak dapat menghubungi server. Silakan copy-paste manual di sini mengikuti contoh di textarea.');
        return;
    }


    try {
        // Show loading state
        const btn = document.querySelector('[onclick="processImport()"]');
        const originalText = btn.textContent;
        const textarea = document.getElementById('import-text-area');

        btn.disabled = true;
        btn.textContent = '⏳ Memproses Word...';
        textarea.value = '⏳ Sedang membaca file Word...';

        // Create FormData and send to backend
        const formData = new FormData();
        formData.append('file', file);
        formData.append('subject', document.getElementById('import-mapel').value);
        formData.append('class', document.getElementById('import-rombel').value);

        console.log('📤 Sending Word file to server:', file.name);

        const response = await fetch(getApiBaseUrl() + '/api/import-word', {
            method: 'POST',
            body: formData
        });

        console.log('📥 Response status:', response.status);
        // the backend should always send JSON, but if the server is unreachable / misconfigured
        // we may get an HTML error page (which starts with "<!DOCTYPE"). parsing that as JSON
        // throws a syntax error and leads to the issue seen in the console. guard against it.
        let result;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            result = await response.json();
        } else {
            // fallback: try to read text to aid debugging
            const text = await response.text();
            console.error('⚠️ Expected JSON but received:', text);
            let hint = 'Pastikan server berjalan dan endpoint benar.';
            if (response.status === 404) {
                hint = 'Endpoint tidak ditemukan (404) – apakah backend diaktifkan pada origin ini?';
            }
            throw new Error(`Server returned non-JSON response (status ${response.status}). ${hint} Lihat console untuk detail.`);
        }
        console.log('📦 Parsed result:', result);

        if (!response.ok) {
            const errorMsg = result.error || result.message || 'Unknown error';
            textarea.value = `❌ Gagal membaca Word:\n\n${errorMsg}\n\n` +
                `Contoh format word pilihan ganda\n` +
                `1. Apa itu teks prosedur\n` +
                `A. Langkah-langkah\n` +
                `B. Rangkaian\n` +
                `C. Informasi\n` +
                `D. Berita\n` +
                `Kunci: A\n\n` +
                `Contoh format word pilihan ganda kompleks\n` +
                `1. Apa itu teks prosedur\n` +
                `A. Langkah-langkah\n` +
                `B. Rangkaian\n` +
                `C. Informasi\n` +
                `D. Berita\n` +
                `Kunci: A, B\n\n` +
                `Contoh format word urauan/esai\n` +
                `1. Apa itu teks prosedur\n` +
                `Kunci: Teks yang memuat langkah-langkah`;
            alert('Gagal membaca Word: ' + errorMsg + '\nSilakan periksa format dokumen di textarea.');
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        // Store imported questions for preview
        window.importedQuestions = result.questions || [];
        window.importCount = result.imported || 0;

        console.log('✅ Successfully parsed:', window.importedQuestions.length, 'questions');

        // Show success message with detailed preview
        if (result.imported > 0) {
            const preview = result.questions.map((q, i) => {
                const optionsList = q.options && q.options.length > 0
                    ? `\n   Pilihan: ${q.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join(', ')}`
                    : '';
                let correctInfo = '';
                if (q.type === 'text') {
                    correctInfo = `\n   Jawab: ${q.correct}`;
                } else if (q.type === 'multiple') {
                    const correctLetters = Array.isArray(q.correct) ? q.correct.map(idx => String.fromCharCode(65 + idx)).join(', ') : String.fromCharCode(65 + q.correct);
                    correctInfo = `\n   Kunci: ${correctLetters}`;
                } else if (q.type === 'single') {
                    const correctLetter = String.fromCharCode(65 + q.correct);
                    correctInfo = `\n   Kunci: ${correctLetter}`;
                } else {
                    correctInfo = `\n   Jawab: ${Array.isArray(q.correct) ? q.correct.map(idx => q.options[idx] || `[${idx}]`).join(', ') : q.options[q.correct] || `[${q.correct}]`}`;
                }
                return `${i + 1}. ${q.text}${optionsList}${correctInfo}\n   Tipe: ${q.type === 'multiple' ? 'Pilihan Ganda Kompleks' : q.type} | Mapel: ${q.mapel} | Kelas: ${q.rombel}`;
            }).join('\n\n');

            textarea.value = `✅ BERHASIL MEMBACA ${result.imported} SOAL\n\n${preview}`;
            alert(`✅ Berhasil membaca ${result.imported} soal dari Word!\n\nKlik "PROSES IMPORT" untuk menambahkan ke database.`);
        } else {
            textarea.value = '⚠️ Tidak ada soal ditemukan dalam dokumen Word.\n\nPastikan file Anda menggunakan format yang didukung (tabel dengan kolom: Soal | Pilihan1 | ... | Jawaban atau format teks tanpa tabel seperti panduan).';
            alert('⚠️ Tidak ada soal ditemukan. Periksa format tabel atau teks dan coba lagi.');
        }

        btn.disabled = false;
        btn.textContent = originalText;

    } catch (err) {
        console.error('❌ Error:', err);
        const btn = document.querySelector('[onclick="processImport()"]');
        btn.disabled = false;
        const textarea = document.getElementById('import-text-area');
        textarea.value = 'Copy Paste secara manual dengan format\n\n' +
            'Contoh format word pilihan ganda\n' +
            '1. Apa itu teks prosedur....\n' +
            'A. Langkah-langkah\n' +
            'B. Rangkaian\n' +
            'C. Informasi\n' +
            'D. Berita\n' +
            'Kunci: A\n\n' +
            'Contoh format word pilihan ganda kompleks\n' +
            '1. Apa itu teks prosedur....\n' +
            'A. Langkah-langkah\n' +
            'B. Rangkaian\n' +
            'C. Informasi\n' +
            'D. Berita\n' +
            'Kunci: A, B\n\n' +
            'Contoh format word urauan/esai\n' +
            '1. Apa itu teks prosedur....\n' +
            'Kunci: Teks yang memuat langkah-langkah';
        alert('Gagal membaca Word. Silakan gunakan copy-paste manual seperti format di textarea.');
    }
}

function exportResultsToExcel() {
    const from = document.getElementById('results-date-from')?.value;
    const to = document.getElementById('results-date-to')?.value;
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : null;
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : null;

    // Filter the results using the same logic as renderAdminResults
    const filteredResults = db.results.filter(r => {
        const rombelFilter = document.getElementById('results-filter-rombel')?.value;
        const mapelFilter = document.getElementById('results-filter-mapel')?.value;

        if (rombelFilter && rombelFilter !== 'ALL' && r.rombel !== rombelFilter) return false;
        if (mapelFilter && mapelFilter !== 'ALL' && r.mapel !== mapelFilter) return false;

        if (!fromTs && !toTs) return true;
        if (!r.date) return false;
        const t = new Date(r.date).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
        return true;
    });

    // Prepare data for Excel
    const excelData = filteredResults.map(r => {
        let row = {
            'Nama Siswa': r.studentName,
            'Rombel': r.rombel,
            'Mata Pelajaran': r.mapel,
            'Tanggal': r.date ? new Date(r.date).toLocaleString() : '-',
            'Skor Akhir': r.score
        };

        // Add answers if available
        if (r.questions && r.answers) {
            r.questions.forEach((q, i) => {
                // catat jenis soal
                row[`Jenis Soal ${i + 1}`] = q.type || 'single';

                const studentAnswer = r.answers[i];
                let answerText = '';

                if (q.type === 'single') {
                    answerText = studentAnswer !== undefined && q.options ? q.options[studentAnswer] || 'Tidak dijawab' : 'Tidak dijawab';
                } else if (q.type === 'multiple') {
                    if (Array.isArray(studentAnswer) && q.options) {
                        answerText = studentAnswer.map(idx => q.options[idx]).join('; ') || 'Tidak dijawab';
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                } else if (q.type === 'text') {
                    answerText = studentAnswer || 'Tidak dijawab';
                } else if (q.type === 'tf') {
                    if (Array.isArray(studentAnswer) && q.options) {
                        answerText = q.options.map((opt, idx) => `${opt}: ${studentAnswer[idx] ? 'Benar' : 'Salah'}`).join('; ');
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                } else if (q.type === 'matching') {
                    let qSubQuestions = q.questions || [];
                    if (qSubQuestions.length === 0) {
                        const orig = db.questions.find(o =>
                            o.type === 'matching' && o.mapel === q.mapel &&
                            (o.text === q.text || (q.text && o.text && o.text.substring(0, 30) === q.text.substring(0, 30)))
                        );
                        if (orig) qSubQuestions = orig.questions || [];
                    }
                    if (Array.isArray(studentAnswer) && qSubQuestions.length > 0) {
                        answerText = qSubQuestions.map((sq, idx) => {
                            const a = studentAnswer[idx];
                            return `${sq}: ${(a !== null && a !== undefined) ? String(a) : 'Tidak dijawab'}`;
                        }).join('; ');
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                }

                row[`Jawaban Soal ${i + 1}`] = answerText;
            });
        }

        return row;
    });

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');

    // Set column widths
    worksheet['!cols'] = [
        { wch: 25 },  // Nama Siswa
        { wch: 12 },  // Rombel
        { wch: 20 },  // Mata Pelajaran
        { wch: 18 },  // Tanggal
        { wch: 12 }   // Skor Akhir
    ];

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Hasil_Ujian_${timestamp}.xlsx`;

    // Write the file
    XLSX.writeFile(workbook, filename);
}

function exportTeacherResultsToExcel() {
    if (!currentSiswa || !currentSiswa.subjects) {
        alert('Data guru tidak valid');
        return;
    }

    // Get filter values
    const selectedMapel = document.getElementById('teacher-results-filter-mapel')?.value || '';
    const selectedRombel = document.getElementById('teacher-results-filter-rombel')?.value || '';

    // Filter results using the same logic as renderTeacherResults
    let filteredResults = db.results.filter(r => {
        // Filter out deleted results
        if (r.deleted) return false;

        // Filter by teacher's subjects (normalized)
        if (!teacherSubjectNames(currentSiswa).includes(r.mapel)) return false;
        // also restrict by rombels per subject
        const allowed = teacherAllowedRombels(currentSiswa, r.mapel);
        if (!allowed.includes(r.rombel)) return false;

        // Filter by selected mapel
        if (selectedMapel && r.mapel !== selectedMapel) return false;

        // Filter by selected rombel
        if (selectedRombel && r.rombel !== selectedRombel) return false;

        return true;
    });

    // Prepare data for Excel
    const excelData = filteredResults.map(r => {
        let row = {
            'Nama Siswa': r.studentName,
            'Rombel': r.rombel,
            'Mata Pelajaran': r.mapel,
            'Tanggal': r.date ? new Date(r.date).toLocaleString() : '-',
            'Skor Akhir': r.score
        };

        // Add answers if available
        if (r.questions && r.answers) {
            r.questions.forEach((q, i) => {
                // sertakan jenis soal
                row[`Jenis Soal ${i + 1}`] = q.type || 'single';

                const studentAnswer = r.answers[i];
                let answerText = '';

                if (q.type === 'single') {
                    answerText = studentAnswer !== undefined && q.options ? q.options[studentAnswer] || 'Tidak dijawab' : 'Tidak dijawab';
                } else if (q.type === 'multiple') {
                    if (Array.isArray(studentAnswer) && q.options) {
                        answerText = studentAnswer.map(idx => q.options[idx]).join('; ') || 'Tidak dijawab';
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                } else if (q.type === 'text') {
                    answerText = studentAnswer || 'Tidak dijawab';
                } else if (q.type === 'tf') {
                    if (Array.isArray(studentAnswer) && q.options) {
                        answerText = q.options.map((opt, idx) => `${opt}: ${studentAnswer[idx] ? 'Benar' : 'Salah'}`).join('; ');
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                } else if (q.type === 'matching') {
                    let qSubQuestions = q.questions || [];
                    if (qSubQuestions.length === 0) {
                        const orig = db.questions.find(o =>
                            o.type === 'matching' && o.mapel === q.mapel &&
                            (o.text === q.text || (q.text && o.text && o.text.substring(0, 30) === q.text.substring(0, 30)))
                        );
                        if (orig) qSubQuestions = orig.questions || [];
                    }
                    if (Array.isArray(studentAnswer) && qSubQuestions.length > 0) {
                        answerText = qSubQuestions.map((sq, idx) => {
                            const a = studentAnswer[idx];
                            return `${sq}: ${(a !== null && a !== undefined) ? String(a) : 'Tidak dijawab'}`;
                        }).join('; ');
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                }

                row[`Jawaban Soal ${i + 1}`] = answerText;
            });
        }

        return row;
    });

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');

    // Set column widths
    worksheet['!cols'] = [
        { wch: 25 },  // Nama Siswa
        { wch: 12 },  // Rombel
        { wch: 20 },  // Mata Pelajaran
        { wch: 18 },  // Tanggal
        { wch: 12 }   // Skor Akhir
    ];

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Hasil_Ujian_Siswa_${timestamp}.xlsx`;

    // Write the file
    XLSX.writeFile(workbook, filename);
}

async function syncGradesToRaport() {
    const rombel = document.getElementById('raport-filter-rombel').value;
    const siswaId = document.getElementById('raport-filter-siswa')?.value || 'ALL';

    if (!rombel || rombel === 'ALL') return alert('Pilih Rombel spesifik terlebih dahulu.');

    let confirmMsg = `Ambil Nilai Akhir yang sudah diolah guru di rombel ${rombel}?`;
    if (siswaId !== 'ALL') {
        const student = (db.students || []).find(s => s.id === siswaId);
        const studentName = student ? student.name : siswaId;
        confirmMsg = `Ambil Nilai Akhir yang sudah diolah guru untuk siswa: ${studentName}?`;
    }

    if (!confirm(confirmMsg + `\nNilai-nilai ini akan dipindahkan ke daftar Raport untuk dicetak.`)) return;

    try {
        // 1. Ambil data nilai dari guru
        const resGrades = await fetch(getApiBaseUrl() + `/api/grades?rombel=${encodeURIComponent(rombel)}`);
        let grades = await resGrades.json();

        // 1.1 Filter by student if specified
        if (siswaId !== 'ALL') {
            grades = grades.filter(g => String(g.student_id).toLowerCase() === String(siswaId).toLowerCase());
        }

        if (!grades || !grades.length) {
            return alert('Tidak ada data nilai akhir guru ditemukan. Pastikan guru sudah menyimpan nilai di Manajemen Nilai.');
        }

        // 2. Petakan ke format hasil ujian (results)
        const syncDate = new Date().toISOString().split('T')[0]; // Stability for overwriting same-day syncs
        const syncData = grades.map(g => {
            const student = db.students.find(s => String(s.id).toLowerCase() === String(g.student_id).toLowerCase());
            return {
                studentId: g.student_id,
                studentName: student ? student.name : g.student_id,
                rombel: g.rombel,
                mapel: g.mapel,
                score: g.nilai_akhir,
                date: syncDate,
                is_raport_sync: true // Mark as synced from teacher
            };
        });

        // 3. Simpan ke database hasil (API /api/results)
        const resSync = await fetch(getApiBaseUrl() + '/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncData)
        });

        if (resSync.ok) {
            // Force reload results from server
            await ensureDataLoaded('results', true);
            alert(`Berhasil menarik ${syncData.length} nilai akhir dari guru. Sekarang data siap dicetak di Raport.`);
            renderRaport();
        } else {
            throw new Error('Gagal menyimpan sinkronisasi ke server.');
        }
    } catch (e) {
        console.error('Sync error:', e);
        alert('Gagal sinkronisasi: ' + e.message);
    }
}

function renderRaport() {
    const rombel = document.getElementById('raport-filter-rombel')?.value || 'ALL';
    const siswaId = document.getElementById('raport-filter-siswa')?.value || 'ALL';
    const tahun = document.getElementById('raport-tahun')?.value || '';
    const kopRombel = document.getElementById('raport-kop-rombel');
    const kopTahun = document.getElementById('raport-kop-tahun');
    const kopSiswa = document.getElementById('raport-kop-siswa');
    const kopTanggal = document.getElementById('raport-footer-date');
    const kopParent = document.getElementById('raport-footer-parent');
    const kopWali = document.getElementById('raport-footer-wali');
    const kopKepalaTitle = document.getElementById('raport-footer-kepala-title');
    const kopKepalaName = document.getElementById('raport-footer-kepala-name');
    const raportFooter = document.getElementById('raport-footer');
    const thead = document.getElementById('raport-thead');
    const tbody = document.getElementById('raport-tbody');
    const raportEmpty = document.getElementById('raport-empty');

    const schoolStats = db.schoolSettings || {};
    const parentName = document.getElementById('raport-parent-name')?.value?.trim() || 'Orang Tua / Wali Siswa';
    const waliName = document.getElementById('raport-wali-name')?.value?.trim() || 'Wali Kelas';
    const waliNip = document.getElementById('raport-wali-nip')?.value?.trim() || '-';
    const semester = document.getElementById('raport-semester')?.value?.trim() || 'GANJIL';
    const today = new Date();
    const dateLabel = today.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    // Update KOP Sekolah
    const kopYayasan = document.getElementById('raport-kop-yayasan');
    const kopNama = document.getElementById('raport-kop-nama');
    const kopAlamat = document.getElementById('raport-kop-alamat');
    const kopImg = document.getElementById('raport-logo');

    if (kopYayasan) kopYayasan.textContent = schoolStats.yayasan || 'YAYASAN PENDIDIKAN';
    if (kopNama) kopNama.textContent = schoolStats.name || 'NAMA SEKOLAH';
    if (kopAlamat) kopAlamat.textContent = schoolStats.address || '-';

    const savedLogo = localStorage.getItem('cbt_school_logo');
    if (kopImg && savedLogo) kopImg.src = savedLogo;

    // Gunakan settings database, fallback ke input field, lalu ke hardcoded lama
    const kepalaTitle = document.getElementById('raport-kepala-title')?.value?.trim() || (schoolStats.name ? `Kepala ${schoolStats.name}` : 'Kepala Sekolah');
    const kepalaName = document.getElementById('raport-kepala-name')?.value?.trim() || schoolStats.principal || '-';

    // Extract location (City/Town) from settings or address
    let location = schoolStats.kota || (schoolStats.address ? (schoolStats.address.split(',').length > 1 ? schoolStats.address.split(',').pop().trim() : schoolStats.address.split(' ').pop().trim()) : '-');
    location = location.replace(/[^a-zA-Z\s]/g, ''); // Clean up symbols

    if (kopRombel) kopRombel.textContent = rombel === 'ALL' ? 'Semua' : rombel;
    if (kopTahun) kopTahun.textContent = tahun || '2026/2027';
    if (kopSiswa) {
        if (siswaId === 'ALL') {
            kopSiswa.textContent = 'Semua';
        } else {
            const siswa = (db.students || []).find(s => s.id === siswaId);
            kopSiswa.textContent = siswa ? siswa.name : 'Tidak diketahui';
        }
    }
    if (kopTanggal) kopTanggal.textContent = `${location}, ${dateLabel}`;
    if (kopParent) kopParent.textContent = parentName;
    if (kopWali) kopWali.textContent = waliName;

    const kopSemester = document.getElementById('raport-semester-view');
    if (kopSemester) kopSemester.textContent = semester;

    const kopWaliNip = document.getElementById('raport-footer-wali-nip');
    if (kopWaliNip) {
        kopWaliNip.textContent = (waliNip && waliNip !== '-') ? `NIP. ${waliNip}` : 'NIP. -';
    }
    if (kopKepalaTitle) kopKepalaTitle.textContent = kepalaTitle;
    if (kopKepalaName) kopKepalaName.textContent = kepalaName;

    // Update NIP in Raport footer
    const kopKepalaNip = document.getElementById('raport-footer-kepala-nip');
    if (kopKepalaNip) {
        kopKepalaNip.textContent = schoolStats.principalNip ? `NIP. ${schoolStats.principalNip}` : 'NIP. -';
    }

    const filtered = (db.results || []).filter(r => {
        if (r.deleted) return false;
        if (rombel !== 'ALL' && r.rombel !== rombel) return false;
        if (siswaId !== 'ALL' && r.studentId !== siswaId) return false;
        return true;
    });

    // Consolidate: only take the latest result per mapel for each student
    const consolidatedMap = new Map();
    filtered.forEach(r => {
        const key = `${r.studentId}|${r.mapel}`;
        const existing = consolidatedMap.get(key);
        if (!existing || new Date(r.date) > new Date(existing.date)) {
            consolidatedMap.set(key, r);
        }
    });
    const consolidated = Array.from(consolidatedMap.values());

    if (!consolidated.length) {
        if (tbody) tbody.innerHTML = '';
        if (raportEmpty) {
            raportEmpty.classList.remove('hidden');
            raportEmpty.classList.add('flex');
        }
        if (raportFooter) raportFooter.classList.add('hidden');
        return;
    }

    if (raportEmpty) {
        raportEmpty.classList.add('hidden');
        raportEmpty.classList.remove('flex');
    }
    if (raportFooter) raportFooter.classList.remove('hidden');

    const rows = consolidated.sort((a, b) => {
        const nameCompare = (a.studentName || '').localeCompare(b.studentName || '');
        if (nameCompare !== 0) return nameCompare;
        const subjectCompare = (a.mapel || '').localeCompare(b.mapel || '');
        if (subjectCompare !== 0) return subjectCompare;
        return new Date(b.date) - new Date(a.date);
    }).map((r, index) => {
        const dateText = r.date ? new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4 text-xs text-slate-600 font-medium">${index + 1}</td>
                        <td class="px-6 py-4 text-xs text-slate-600 font-bold">${r.mapel || '-'}</td>
                        <td class="px-6 py-4 text-xs text-slate-500">${dateText}</td>
                        <td class="px-6 py-4 text-xs text-center font-black text-sky-600">${Number(r.score).toFixed(1)}</td>
                        <td class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center gap-2">
                                <button onclick="editRaportScore('${r.studentId}', '${r.mapel}')" 
                                    class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm flex items-center justify-center"
                                    title="Edit Nilai">
                                    <i class="fas fa-edit text-[10px]"></i>
                                </button>
                                <button onclick="deleteRaportEntry('${r.studentId}', '${r.mapel}')" 
                                    class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center"
                                    title="Hapus Nilai">
                                    <i class="fas fa-trash-alt text-[10px]"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
    });

    const siswaNameEl = document.getElementById('raport-siswa-name');
    const siswaRombelEl = document.getElementById('raport-siswa-rombel');
    if (siswaNameEl && siswaRombelEl) {
        if (siswaId === 'ALL') {
            siswaNameEl.textContent = 'Semua Siswa';
        } else {
            const siswa = (db.students || []).find(s => s.id === siswaId);
            siswaNameEl.textContent = siswa ? siswa.name : 'Tidak diketahui';
        }
        siswaRombelEl.textContent = rombel === 'ALL' ? 'Semua' : rombel;
    }

    if (thead) {
        thead.innerHTML = `
                    <tr>
                        <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">No</th>
                        <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Mata Pelajaran</th>
                        <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Tanggal</th>
                        <th class="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Nilai</th>
                        <th class="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Aksi</th>
                    </tr>`;
    }
    if (tbody) tbody.innerHTML = rows.join('');
}

function _buildRaportPrintHTML(forPrint = false) {
    renderRaport();

    // Ambil data sekolah: prioritas db, fallback ke localStorage
    let schoolDb = db.schoolSettings || {};
    let schoolLs = {};
    try {
        const raw = localStorage.getItem('cbt_school_settings') || localStorage.getItem(SCHOOL_SETTINGS_KEY);
        if (raw) schoolLs = JSON.parse(raw);
    } catch (e) { }
    const school = {
        yayasan: schoolDb.yayasan || schoolLs.yayasan || '',
        name: schoolDb.name || schoolLs.name || '',
        principal: schoolDb.principal || schoolLs.principal || '',
        principalNip: schoolDb.principalNip || schoolLs.principalNip || '',
        address: schoolDb.address || schoolLs.address || '',
        kota: schoolDb.kota || schoolLs.kota || ''
    };
    const logo = (db.schoolSettings && db.schoolSettings.logoUrl)
        ? (db.schoolSettings.logoUrl.startsWith('http') ? db.schoolSettings.logoUrl : getApiBaseUrl() + db.schoolSettings.logoUrl)
        : (localStorage.getItem('cbt_school_logo') || 'logo.png');
    const tahun = document.getElementById('raport-tahun')?.value || '2026/2027';
    const semester = document.getElementById('raport-semester')?.value || 'GANJIL';
    const siswaName = document.getElementById('raport-siswa-name')?.textContent || 'Semua Siswa';
    const rombel = document.getElementById('raport-siswa-rombel')?.textContent || 'Semua';
    const parentName = document.getElementById('raport-parent-name')?.value || '.....................';
    const waliName = document.getElementById('raport-wali-name')?.value || '.....................';
    const waliNip = document.getElementById('raport-wali-nip')?.value || '-';
    const kepalaName = school.principal || '.....................';
    const kepalaNip = school.principalNip || '-';
    const kepalaTitle = school.name ? `Kepala ${school.name}` : 'Kepala Sekolah';
    const kota = school.kota || (school.address ? school.address.split(',').pop().trim().replace(/[^a-zA-Z\s]/g, '') : '-');
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const tableEl = document.getElementById('raport-table');
    const tableHTML = tableEl ? tableEl.outerHTML : '';
    const yayasanHTML = school.yayasan ? `<h1>${school.yayasan}</h1>` : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>${forPrint ? 'Cetak Raport' : 'Preview Raport'} - ${siswaName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #0f172a; background: #fff; padding: 10mm 15mm; }
  
  /* KOP */
  .kop { display: flex; align-items: center; gap: 20px; padding-bottom: 12px; border-bottom: 3px solid #0f172a; margin-bottom: 8px; }
  .kop img { width: 70px; height: 70px; object-fit: contain; }
  .kop-text { text-align: center; flex: 1; }
  .kop-text h1 { font-size: 12pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
  .kop-text h2 { font-size: 16pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin: 2px 0; }
  .kop-text p { font-size: 9pt; color: #475569; }

  /* Judul */
  .judul { text-align: center; padding: 10px 0 6px; border-bottom: 1px solid #e2e8f0; }
  .judul h3 { font-size: 13pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
  .judul p { font-size: 9pt; color: #475569; margin-top: 3px; }

  /* Info baris */
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #e2e8f0; font-size: 10pt; font-weight: 700; }
  .semester-badge { font-weight: 900; color: #4338ca; font-size: 11pt; }

  /* Tabel */
  table { width: 100%; border-collapse: collapse; margin-top: 1px; font-size: 10pt; }
  thead th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 900; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { padding: 8px 10px; font-weight: 700; border-top: 2px solid #0f172a; background: #f8fafc; }

  /* Sembunyikan kolom Aksi (terakhir) saat cetak/preview */
  table th:last-child, table td:last-child { display: none !important; }

  /* Footer Tanda Tangan */
  .footer-sigs { margin-top: 30px; }
  .sig-row-top { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .sig-row-bottom { display: flex; justify-content: center; }
  .sig-box { text-align: center; min-width: 180px; }
  .sig-label { font-size: 8pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
  .sig-date { font-size: 8pt; color: #475569; margin-bottom: 3px; }
  .sig-space { height: 60px; }
  .sig-name { font-weight: 900; font-size: 11pt; padding-top: 4px; margin-top: 2px; min-width: 160px; display: inline-block; }
  .sig-nip { font-size: 8pt; color: #64748b; margin-top: 2px; }

  ${forPrint ? '@page { margin: 8mm 12mm; } @media print { body { padding: 0; } }' : ''}
</style>
</head>
<body>

  <!-- KOP Surat -->
  <div class="kop">
    <img src="${logo}" alt="Logo Sekolah" onerror="this.style.display='none'">
    <div class="kop-text">
      ${yayasanHTML}
      <h2>${school.name || 'NAMA SEKOLAH'}</h2>
      <p>${school.address || ''}</p>
    </div>
  </div>

  <!-- Judul -->
  <div class="judul">
    <h3>Laporan Hasil Belajar</h3>
    <p>Tahun Ajaran: <strong>${tahun}</strong></p>
  </div>

  <!-- Info Baris: Siswa | Rombel -- Semester -->
  <div class="info-row">
    <span>Nama Siswa: <strong>${siswaName}</strong> &nbsp;|&nbsp; Rombel: <strong>${rombel}</strong></span>
    <span>Semester: <span class="semester-badge">${semester.toUpperCase()}</span></span>
  </div>

  <!-- Tabel Nilai -->
  ${tableHTML}

  <!-- Tanda Tangan -->
  <div class="footer-sigs">
    <!-- Baris 1: Orang Tua & Wali Kelas -->
    <div class="sig-row-top">
      <div class="sig-box">
        <div class="sig-space"></div>
        <p class="sig-label">Orang Tua / Wali</p>
        <div class="sig-space"></div>
        <span class="sig-name">${parentName}</span>
      </div>
      <div class="sig-box">
        <p class="sig-date">${kota}, ${today}</p>
        <p class="sig-label">Wali Kelas</p>
        <div class="sig-space"></div>
        <span class="sig-name">${waliName}</span>
        <p class="sig-nip">NIP. ${waliNip !== '-' ? waliNip : '-'}</p>
      </div>
    </div>

    <!-- Baris 2: Kepala Sekolah (Tengah) -->
    <div class="sig-row-bottom">
      <div class="sig-box">
        <p class="sig-label">Mengetahui,</p>
        <p class="sig-label">${kepalaTitle}</p>
        <div class="sig-space"></div>
        <span class="sig-name">${kepalaName}</span>
        <p class="sig-nip">NIP. ${kepalaNip !== '-' ? kepalaNip : '-'}</p>
      </div>
    </div>
  </div>

${forPrint ? '<script>window.onload = function() { window.print(); }<\/script>' : ''}
</body>
</html>`;
}

function previewRaport() {
    const html = _buildRaportPrintHTML(false);
    const win = window.open('', '_blank');
    if (!win) { alert('Popup diblokir! Izinkan popup untuk halaman ini.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
}

function printRaport() {
    const html = _buildRaportPrintHTML(true);
    const win = window.open('', '_blank');
    if (!win) { alert('Popup diblokir! Izinkan popup untuk halaman ini.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
}

function downloadRaportPDF() {
    renderRaport();
    const raportContainer = document.getElementById('raport-container');
    if (!raportContainer || typeof html2pdf === 'undefined') return;

    const clone = raportContainer.cloneNode(true);
    clone.style.width = '210mm';
    clone.style.padding = '10mm';
    clone.style.boxSizing = 'border-box';
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Raport_${(document.getElementById('raport-siswa-name')?.textContent || 'Siswa').replace(/\s+/g, '_')}_${(document.getElementById('raport-siswa-rombel')?.textContent || 'Semua').replace(/\s+/g, '_')}_${(document.getElementById('raport-tahun')?.value || '').replace(/\D/g, '') || '2026'}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid' }
    };
    html2pdf().set(opt).from(clone).save();
}

function downloadRaportExcel() {
    renderRaport();
    const rombel = document.getElementById('raport-filter-rombel')?.value || 'ALL';
    const siswaId = document.getElementById('raport-filter-siswa')?.value || 'ALL';
    const tahun = document.getElementById('raport-tahun')?.value || '';
    const filtered = (db.results || []).filter(r => {
        if (r.deleted) return false;
        if (rombel !== 'ALL' && r.rombel !== rombel) return false;
        if (siswaId !== 'ALL' && r.studentId !== siswaId) return false;
        return true;
    });
    if (!filtered.length || typeof XLSX === 'undefined') return;

    const excelData = filtered.map((r, index) => ({
        No: index + 1,
        Mata_Pelajaran: r.mapel || '',
        Tanggal: r.date ? new Date(r.date).toLocaleDateString('id-ID') : '',
        Nilai: Number(r.score).toFixed(1)
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Raport');
    const selectedStudent = document.getElementById('raport-filter-siswa')?.value || 'ALL';
    const studentName = (document.getElementById('raport-siswa-name')?.textContent || 'Siswa');
    const rombelName = (document.getElementById('raport-siswa-rombel')?.textContent || 'Semua');
    XLSX.writeFile(workbook, `Raport_${studentName.replace(/\s+/g, '_')}_${rombelName.replace(/\s+/g, '_')}_${tahun.replace(/\D/g, '') || '2026'}.xlsx`);
}

function openEditRaportTab() {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
    Toast.fire({
        icon: 'info',
        title: 'Mode Edit Aktif',
        text: 'Klik ikon pensil untuk EDIT atau ikon sampah untuk HAPUS nilai di tabel raport.'
    });
}

function downloadKisiKisiExcel() {
    if (!currentKisiKisiData.length) return;
    const siswaNameText = document.getElementById('raport-siswa-name')?.textContent || 'Semua';
    const siswaRombelText = document.getElementById('raport-siswa-rombel')?.textContent || 'Semua';
    const ws = XLSX.utils.json_to_sheet(currentKisiKisiData.map(item => ({
        'No': item.no,
        'Kompetensi Dasar': item.kd,
        'Materi': item.materi,
        'Indikator Soal': item.indikator,
        'Level': item.level,
        'No Soal': item.no_soal,
        'Bentuk': item.bentuk
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kisi-kisi");
    XLSX.writeFile(wb, `Kisi-kisi_${document.getElementById('kk-mapel').value}_${document.getElementById('kk-rombel').value}.xlsx`);
}

function downloadKisiKisiWord() {
    if (!currentKisiKisiData.length) return;
    const mapel = document.getElementById('kk-mapel').value;
    const rombel = document.getElementById('kk-rombel').value;
    const schoolName = db.schoolSettings?.name || 'NAMA SEKOLAH';

    let html = `
                <div style="font-family: 'Arial', sans-serif;">
                    <h2 style="text-align: center; text-transform: uppercase;">KISI-KISI INSTRUMEN UJIAN</h2>
                    <table style="margin-bottom: 20px;">
                        <tr><td>Mata Pelajaran</td><td>: ${mapel}</td></tr>
                        <tr><td>Kelas / Rombel</td><td>: ${rombel}</td></tr>
                        <tr><td>Sekolah</td><td>: ${schoolName}</td></tr>
                    </table>
                    <table border="1" cellspacing="0" cellpadding="5" style="width: 100%; border-collapse: collapse;">
                        <thead style="background-color: #f2f2f2;">
                            <tr>
                                <th>No</th>
                                <th>Kompetensi Dasar</th>
                                <th>Materi</th>
                                <th>Indikator Soal</th>
                                <th>Level</th>
                                <th>No Soal</th>
                                <th>Bentuk</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentKisiKisiData.map(item => `
                                <tr>
                                    <td align="center">${item.no}</td>
                                    <td>${item.kd}</td>
                                    <td>${item.materi}</td>
                                    <td>${item.indikator}</td>
                                    <td align="center">${item.level}</td>
                                    <td align="center">${item.no_soal}</td>
                                    <td align="center">${item.bentuk}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

    // Simple blob trick for .doc
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
        "xmlns:w='urn:schemas-microsoft-com:office:word' " +
        "xmlns='http://www.w3.org/TR/REC-html40'>" +
        "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + html + footer;

    const blob = new Blob([sourceHTML], { type: 'application/msword;charset=utf-8' });
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    const downloadUrl = URL.createObjectURL(blob);
    fileDownload.href = downloadUrl;
    fileDownload.download = `Kisi-kisi_${mapel}_${rombel}.doc`;
    fileDownload.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    document.body.removeChild(fileDownload);
}

function toggleImportDropdown() {
    const dropdown = document.getElementById('import-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
    // Hide export dropdown if open
    const exportDropdown = document.getElementById('export-dropdown');
    if (exportDropdown) exportDropdown.classList.add('hidden');
}

/**
 * Show/hide question form containers based on selected type.
 * Used when opening teacher modal.
 */
function updateQuestionTypeDisplay(type) {
    const answerTextContainer = document.getElementById('q-answer-text-container');
    const tfContainer = document.getElementById('q-tf-container');
    const matchingContainer = document.getElementById('q-matching-container');
    const optsContainer = document.getElementById('q-opts-container');
    const correctButtonsGroup = document.getElementById('q-correct-buttons-group');
    const qText = document.getElementById('q-text');
    const qOpsiGroup = document.getElementById('q-opsi-group');

    // Hide all containers first
    if (answerTextContainer) answerTextContainer.classList.add('hidden');
    if (tfContainer) tfContainer.classList.add('hidden');
    if (matchingContainer) matchingContainer.classList.add('hidden');
    if (optsContainer) optsContainer.classList.add('hidden');
    if (correctButtonsGroup) correctButtonsGroup.classList.add('hidden');
    if (qText) qText.classList.remove('hidden');
    if (qOpsiGroup) qOpsiGroup.classList.add('hidden');

    // Show relevant containers based on type
    if (type === 'text') {
        if (answerTextContainer) answerTextContainer.classList.remove('hidden');
    } else if (type === 'tf') {
        if (tfContainer) tfContainer.classList.remove('hidden');
        const existingRows = tfContainer.querySelectorAll('.tf-row').length;
        for (let i = existingRows; i < 2; i++) {
            if (typeof addTfRow === 'function') addTfRow();
        }
    } else if (type === 'matching') {
        if (matchingContainer) matchingContainer.classList.remove('hidden');
        if (qText) qText.classList.remove('hidden');
    } else {
        // single or multiple
        if (optsContainer) optsContainer.classList.remove('hidden');
        if (correctButtonsGroup) correctButtonsGroup.classList.remove('hidden');
        if (qOpsiGroup) qOpsiGroup.classList.remove('hidden');
    }
}

let teacherLiveProgressPollInterval = null;

async function startLiveProgressPolling() {
    if (!currentSiswa || currentSiswa.role !== 'teacher') return;

    if (teacherLiveProgressPollInterval) {
        clearInterval(teacherLiveProgressPollInterval);
    }

    console.log('[Teacher Progress] Starting live progress polling...');

    try {
        if (typeof syncAdminLiveState === 'function') await syncAdminLiveState();
        if (typeof renderRombelProgress === 'function') renderRombelProgress();
    } catch (err) {
        console.warn('[Teacher Progress] Initial sync failed:', err);
    }

    teacherLiveProgressPollInterval = setInterval(async () => {
        const teacherTab = document.getElementById('teacher-tab-live-progress');
        if (teacherTab && !teacherTab.classList.contains('hidden')) {
            console.log('[Teacher Progress] Syncing live state...', new Date().toLocaleTimeString());
            if (typeof syncAdminLiveState === 'function') await syncAdminLiveState();
            if (typeof renderRombelProgress === 'function') renderRombelProgress();
        } else {
            console.log('[Teacher Progress] Section hidden, stopping poll');
            stopLiveProgressPolling();
        }
    }, 4000);
}

function stopLiveProgressPolling() {
    if (teacherLiveProgressPollInterval) {
        console.log('[Teacher Progress] Stopping live progress polling');
        clearInterval(teacherLiveProgressPollInterval);
        teacherLiveProgressPollInterval = null;
    }
}


