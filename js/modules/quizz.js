/**
 * js/modules/quizz.js
 * Part of CBT application refactored module
 */

async function renderApiKeysList() {
    const container = document.getElementById('api-keys-list');
    if (!container) return;

    try {
        const response = await fetch(getApiBaseUrl() + '/api/admin/global-api-keys');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.ok && Array.isArray(result.globalKeys)) {
            const keys = result.globalKeys;
            window.globalApiKeysActive = result.activeCount || 0;
            window.globalApiKeysExhausted = result.exhaustedCount || 0;
            updateStats(); // Update stats with new API keys data

            // Helper function to detect provider from API key
            function detectProviderFromKey(key) {
                if (!key) return 'Unknown';
                if (key.startsWith('AIzaSy')) return 'Google Gemini';
                if (key.startsWith('sk-')) return 'OpenAI (ChatGPT)';
                if (key.startsWith('sk-or-v1-') || key.startsWith('sk-or-')) return 'OpenRouter';
                if (key.startsWith('gsk_')) return 'Groq';
                if (key.includes('deepseek')) return 'DeepSeek';
                return 'Unknown';
            }

            container.innerHTML = keys.length === 0 ?
                '<p class="text-xs text-slate-500">Belum ada API Key global</p>' :
                keys.map((key, index) => {
                    const fullKey = key.key || '';
                    const displayKey = fullKey.length > 20 ? fullKey.substring(0, 20) + '...' : fullKey;

                    // Use detected provider from key format, fallback to stored provider
                    const detectedProvider = detectProviderFromKey(fullKey);
                    const displayProvider = detectedProvider !== 'Unknown' ? detectedProvider : (key.provider || 'Unknown');

                    const source = key.addedAt || 'Global Settings';
                    const isExternal = key.source === 'teacher' || key.source === 'env';

                    // Prepare identifiers for deletion
                    const deleteArgs = JSON.stringify({
                        id: key.id,
                        source: key.source,
                        index: key.index,
                        key: fullKey
                    }).replace(/"/g, '&quot;');

                    return `
                                <div class="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-2">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-600">${displayProvider}</span>
                                            <span class="text-[10px] font-bold px-2 py-0.5 rounded ${key.source === 'teacher' ? 'bg-amber-100 text-amber-700' : (key.source === 'env' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700')}">${source}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-mono text-slate-700">${displayKey}</span>
                                            ${key.status === 'exhausted' ? '<span class="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">KUOTA HABIS</span>' : '<span class="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">AKTIF</span>'}
                                        </div>
                                    </div>
                                    ${!isExternal ? `
                                    <button onclick="removeGlobalApiKey(${deleteArgs})" class="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                    ` : `
                                    <div class="w-8 h-8 flex items-center justify-center text-slate-300 cursor-not-allowed" title="Key ini dikelola di sumber aslinya (Guru/Env)">
                                        <i class="fas fa-lock text-xs"></i>
                                    </div>
                                    `}
                                </div>
                            `;
                }).join('');
        } else {
            container.innerHTML = `<p class="text-xs text-red-500">Error: ${result.error || 'Response tidak valid'}</p>`;
        }
    } catch (err) {
        console.error('Error loading API keys:', err);
        container.innerHTML = `<p class="text-xs text-red-500">Gagal memuat API Keys: ${err.message}</p>`;
    }
}

window.removeGlobalApiKey = async function (ident) {
    if (!confirm('Apakah Anda yakin ingin menghapus Global API Key ini?')) return;

    let body = {};
    if (typeof ident === 'object') {
        if (ident.source === 'supabase') body.keyId = ident.id;
        else if (ident.source === 'mysql') body.keyIndex = ident.index;
        else body.keyValue = ident.key; // Fallback
    } else {
        body.keyIndex = ident; // Legacy support
    }

    try {
        const response = await fetch(getApiBaseUrl() + '/api/admin/remove-global-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await response.json();

        if (result.ok) {
            showToast('Global API Key berhasil dihapus', 'success');
            renderApiKeysList(); // Refresh list for admin overview
            updateStats(); // Update stats
        } else {
            showToast(result.error || 'Gagal menghapus key', 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
};

// ─── Detailed API Keys Modal Logic ───────────────────
window.openApiKeysDetailModal = async function () {
    const modal = document.getElementById('api-keys-detail-modal');
    if (modal) modal.classList.remove('hidden');
    if (modal) modal.classList.add('flex');

    // Show loading in table body
    const tbody = document.getElementById('api-keys-detail-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400 font-bold"><i class="fas fa-spinner fa-spin mr-2"></i> Mengambil data API Keys...</td></tr>`;

    try {
        const response = await fetch(getApiBaseUrl() + '/api/admin/global-api-keys');
        if (!response.ok) throw new Error('Refresh gagal');
        const result = await response.json();

        if (result.ok && Array.isArray(result.globalKeys)) {
            renderApiKeysDetailTable(result.globalKeys);
        } else {
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500 font-bold">Gagal memuat data API Keys</td></tr>`;
        }
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500 font-bold">Error: ${err.message}</td></tr>`;
    }
};

window.closeApiKeysDetailModal = function () {
    const modal = document.getElementById('api-keys-detail-modal');
    if (modal) modal.classList.add('hidden');
    if (modal) modal.classList.remove('flex');
};

function renderApiKeysDetailTable(keys) {
    const tbody = document.getElementById('api-keys-detail-table-body');
    if (!tbody) return;

    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400 font-bold">Belum ada API Key global terdaftar.</td></tr>`;
        return;
    }

    function detectProviderFromKey(key) {
        if (!key) return 'Unknown';
        if (key.startsWith('AIzaSy')) return 'Google Gemini';
        if (key.startsWith('sk-')) return 'OpenAI (ChatGPT)';
        if (key.startsWith('sk-or-v1-') || key.startsWith('sk-or-')) return 'OpenRouter';
        if (key.startsWith('gsk_')) return 'Groq';
        if (key.includes('deepseek')) return 'DeepSeek';
        return 'Unknown';
    }

    tbody.innerHTML = keys.map((k, i) => {
        const fullKey = k.key || '';
        const provider = detectProviderFromKey(fullKey);
        const source = k.addedAt || 'Global Settings';
        const isExhausted = k.status === 'exhausted';
        const lastUpdated = k.updatedAt ? new Date(k.updatedAt).toLocaleString('id-ID') : '-';
        const isExternal = k.source === 'teacher' || k.source === 'env';

        const deleteArgs = JSON.stringify({
            id: k.id,
            source: k.source,
            index: k.index,
            key: fullKey
        }).replace(/"/g, '&quot;');

        return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4 text-center font-bold text-slate-400">${i + 1}</td>
                        <td class="px-6 py-4">
                            <span class="text-[10px] font-black uppercase px-2 py-1 rounded bg-slate-200 text-slate-600">${provider}</span>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-2">
                                <code class="text-xs font-mono bg-white border border-slate-100 px-2 py-1 rounded-lg text-slate-700">${fullKey.substring(0, 8)}••••••••${fullKey.substring(fullKey.length - 4)}</code>
                                <button onclick="copyApiKey('${fullKey}')" class="text-slate-400 hover:text-sky-600 transition-all" title="Salin Key">
                                    <i class="fas fa-copy text-xs"></i>
                                </button>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            ${isExhausted ?
                '<span class="text-[9px] font-black bg-red-100 text-red-600 px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><i class="fas fa-times-circle"></i> KUOTA HABIS</span>' :
                '<span class="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><i class="fas fa-check-circle"></i> AKTIF</span>'
            }
                        </td>
                        <td class="px-6 py-4">
                            <span class="text-[10px] font-bold text-slate-500">${source}</span>
                            ${k.note ? `<p class="text-[10px] text-slate-400 mt-0.5 italic">${k.note}</p>` : ''}
                        </td>
                        <td class="px-6 py-4 text-center">
                            ${!isExternal ? `
                            <button onclick="removeGlobalApiKey(${deleteArgs})" class="w-8 h-8 flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Hapus Key">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                            ` : `
                            <div class="w-8 h-8 flex items-center justify-center text-slate-300 cursor-not-allowed" title="Key ini dikelola di sumber aslinya">
                                <i class="fas fa-lock text-xs"></i>
                            </div>
                            `}
                        </td>
                    </tr>
                `;
    }).join('');
}

window.copyApiKey = function (key) {
    navigator.clipboard.writeText(key).then(() => {
        showToast('API Key disalin ke clipboard!', 'success');
    }).catch(err => {
        console.error('Clipboard error:', err);
        showToast('Gagal menyalin key', 'error');
    });
};

// --- END API KEY MANAGEMENT FUNCTIONS ---

// --- QUIZZ MANAGEMENT FUNCTIONS ---

async function openQuizzAiModal() {
    let mapelOpts = '<option value="">--Pilih Mapel--</option>';
    if (db.subjects) {
        db.subjects.forEach(m => {
            const mName = typeof m === 'string' ? m : m.name;
            mapelOpts += `<option value="${mName}">${mName}</option>`;
        });
    }
    let rombelOpts = '<option value="">--Pilih Rombel--</option>';
    if (db.rombels) {
        db.rombels.forEach(r => rombelOpts += `<option value="${r}">${r}</option>`);
    }

    const mapelSelect = document.getElementById('quizz-ai-mapel');
    const rombelSelect = document.getElementById('quizz-ai-rombel');

    const isTeacher = currentSiswa && currentSiswa.role === 'teacher';
    if (isTeacher) {
        const teacher = currentSiswa;
        const subjects = teacherSubjectNames(teacher);
        mapelOpts = '<option value="">--Pilih Mapel--</option>' + subjects.map(n => `<option value="${n}">${n}</option>`).join('');

        const updateRombels = (chosenMapel) => {
            let rombelsToUse;
            if (chosenMapel) {
                rombelsToUse = teacherAllowedRombels(teacher, chosenMapel);
            } else {
                rombelsToUse = teacherCombinedRombels(teacher);
            }
            rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
        };

        if (mapelSelect) {
            mapelSelect.innerHTML = mapelOpts;
            mapelSelect.onchange = () => updateRombels(mapelSelect.value);
        }
        if (rombelSelect) {
            updateRombels(mapelSelect ? mapelSelect.value : '');
        }
    } else {
        if (mapelSelect) mapelSelect.innerHTML = mapelOpts;
        if (rombelSelect) rombelSelect.innerHTML = rombelOpts;
    }

    document.getElementById('quizz-ai-topic').value = '';
    document.getElementById('quizz-ai-count').value = '5';
    document.getElementById('quizz-ai-modal-error').classList.add('hidden');

    const modal = document.getElementById('quizz-ai-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function adjustQuizzAiCount(delta) {
    const input = document.getElementById('quizz-ai-count');
    let val = parseInt(input.value) || 5;
    val += delta;
    if (val < 1) val = 1;
    if (val > 30) val = 30;
    input.value = val;
}

async function generateQuizzWithAi() {
    const topic = document.getElementById('quizz-ai-topic').value;
    const count = parseInt(document.getElementById('quizz-ai-count').value) || 5;
    const mapel = document.getElementById('quizz-ai-mapel').value;
    const rombel = document.getElementById('quizz-ai-rombel').value;
    const errorEl = document.getElementById('quizz-ai-modal-error');

    if (!topic || !mapel || !rombel) {
        errorEl.innerText = "Topik, Mapel, dan Rombel wajib diisi!";
        errorEl.classList.remove('hidden');
        return;
    }
    errorEl.classList.add('hidden');

    closeModals();

    Swal.fire({
        title: 'Membuat Quizz...',
        html: '<div class="text-sm text-slate-500">AI sedang menyusun pertanyaan interaktif, harap tunggu.</div>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        let teacherId = null;
        if (typeof currentSiswa !== 'undefined' && currentSiswa && currentSiswa.role === 'guru') {
            teacherId = currentSiswa.id;
        }
        const response = await fetch(getApiBaseUrl() + '/api/generate-quizz-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: topic,
                count: count,
                teacherId: teacherId
            })
        });

        const data = await response.json();
        if (data.ok && data.questions) {
            if (!db.quizzes) db.quizzes = [];
            const questions = data.questions.map(q => ({
                mapel: mapel,
                rombel: rombel,
                ...q
            }));
            db.quizzes.push(...questions);
            await save();
            renderAdminQuizz();
            if (typeof renderTeacherQuizz === 'function') renderTeacherQuizz();
            Swal.fire('Berhasil!', `${questions.length} soal quizz telah ditambahkan.`, 'success');
        } else {
            throw new Error(data.error || 'Gagal generate AI');
        }
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// === Quizz Image Helpers ===
async function previewQuizzImages(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (!window.storedQuizzImages) window.storedQuizzImages = [];

    showToast('Memproses gambar...', 'info');

    for (const file of files) {
        try {
            const base64 = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            if (file.type.startsWith('image/')) {
                const compressed = await compressImage(base64);
                const cloudUrl = await uploadImageToServer(compressed, file.name);
                window.storedQuizzImages.push(cloudUrl);
            } else {
                window.storedQuizzImages.push(base64);
            }
        } catch (err) {
            console.error('Failed to upload image:', file.name, err);
            showToast('Gagal upload ' + file.name + ': ' + err.message, 'error');
        }
    }
    showToast('Proses upload selesai', 'success');
    renderQuizzImagePreviews();
}

async function addQuizzImageUrl() {
    const urlInput = document.getElementById('quizz-image-url');
    const url = urlInput.value.trim();
    if (!url) return;

    if (!window.storedQuizzImages) window.storedQuizzImages = [];

    if (url.startsWith('data:image')) {
        showToast('Mengunggah data gambar...', 'info');
        try {
            const compressed = await compressImage(url);
            const cloudUrl = await uploadImageToServer(compressed, 'pasted-image.jpg');
            window.storedQuizzImages.push(cloudUrl);
            showToast('Gambar berhasil diunggah ke cloud', 'success');
        } catch (err) {
            showToast('Gagal upload ke cloud: ' + err.message, 'error');
            window.storedQuizzImages.push(url);
        }
    } else {
        window.storedQuizzImages.push(url);
    }

    urlInput.value = '';
    renderQuizzImagePreviews();
}

function removeQuizzImage(index) {
    if (window.storedQuizzImages && window.storedQuizzImages.length > index) {
        window.storedQuizzImages.splice(index, 1);
        renderQuizzImagePreviews();
    }
}

function renderQuizzImagePreviews() {
    const previewContainer = document.getElementById('quizz-images-preview');
    previewContainer.innerHTML = '';

    if (!window.storedQuizzImages) return;

    window.storedQuizzImages.forEach((url, idx) => {
        const wrp = document.createElement('div');
        wrp.className = 'relative inline-block';
        wrp.innerHTML = `
            <img src="${normalizeImgSrc(url)}" class="h-16 w-16 object-cover rounded shadow-sm border border-slate-200 cursor-pointer" onclick="openImageZoom('${normalizeImgSrc(url)}', ${idx}, window.storedQuizzImages)">
            <button onclick="removeQuizzImage(${idx})" class="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center hover:bg-red-600 shadow">&times;</button>
        `;
        previewContainer.appendChild(wrp);
    });
}
// === End Quizz Image Helpers ===

async function openQuizzModal(idx = null) {
    let mapelOpts = '<option value="">--Pilih Mapel--</option>';
    if (db.subjects) {
        db.subjects.forEach(m => {
            const mName = typeof m === 'string' ? m : m.name;
            mapelOpts += `<option value="${mName}">${mName}</option>`;
        });
    }
    let rombelOpts = '<option value="">--Pilih Rombel--</option>';
    if (db.rombels) {
        db.rombels.forEach(r => rombelOpts += `<option value="${r}">${r}</option>`);
    }

    const mapelSelect = document.getElementById('quizz-mapel');
    const rombelSelect = document.getElementById('quizz-rombel');

    // Filter for teacher mode
    const isTeacher = currentSiswa && currentSiswa.role === 'teacher';
    if (isTeacher) {
        const teacher = currentSiswa;
        const subjects = teacherSubjectNames(teacher);
        mapelOpts = '<option value="">--Pilih Mapel--</option>' + subjects.map(n => `<option value="${n}">${n}</option>`).join('');

        const updateRombels = (chosenMapel) => {
            let rombelsToUse;
            if (chosenMapel) {
                rombelsToUse = teacherAllowedRombels(teacher, chosenMapel);
            } else {
                rombelsToUse = teacherCombinedRombels(teacher);
            }
            rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
        };

        if (mapelSelect) {
            mapelSelect.innerHTML = mapelOpts;
            mapelSelect.onchange = () => updateRombels(mapelSelect.value);
        }
        if (rombelSelect) {
            updateRombels(mapelSelect ? mapelSelect.value : '');
        }
    } else {
        if (mapelSelect) mapelSelect.innerHTML = mapelOpts;
        if (rombelSelect) rombelSelect.innerHTML = rombelOpts;
    }

    document.getElementById('quizz-modal-error').classList.add('hidden');
    window.storedQuizzImages = [];

    // Initialize Quill editors if needed
    setTimeout(() => initQuillEditors(), 50);

    if (idx !== null && db.quizzes && db.quizzes[idx]) {
        const q = db.quizzes[idx];
        document.getElementById('quizz-modal-title').innerText = "Edit Soal Quizz";
        document.getElementById('quizz-edit-idx').value = idx.toString();

        mapelSelect.value = q.mapel || '';
        rombelSelect.value = q.rombel || '';
        document.getElementById('quizz-question').value = q.question || '';
        setTimeout(() => setQuillContent('quizz', q.question || ''), 80);

        document.getElementById('quizz-a0').value = q.answers[0] || '';
        document.getElementById('quizz-a1').value = q.answers[1] || '';
        document.getElementById('quizz-a2').value = q.answers[2] || '';
        document.getElementById('quizz-a3').value = q.answers[3] || '';

        setQuizzCorrect(q.correct || 0);

        if (q.images && q.images.length > 0) {
            window.storedQuizzImages = [...q.images];
        }
    } else {
        document.getElementById('quizz-modal-title').innerText = "Soal Quizz Baru";
        document.getElementById('quizz-edit-idx').value = '';

        document.getElementById('quizz-question').value = '';
        setTimeout(() => setQuillContent('quizz', ''), 80);
        document.getElementById('quizz-a0').value = '';
        document.getElementById('quizz-a1').value = '';
        document.getElementById('quizz-a2').value = '';
        document.getElementById('quizz-a3').value = '';
        setQuizzCorrect(0);
    }

    renderQuizzImagePreviews();

    const modal = document.getElementById('quizz-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function setQuizzCorrect(idx) {
    document.getElementById('quizz-correct-val').value = idx;
    document.querySelectorAll('.quizz-c-btn').forEach((btn, i) => {
        if (i === idx) {
            const colors = ['sky', 'indigo', 'violet', 'amber'];
            btn.className = `quizz-c-btn flex-1 py-3 rounded-xl font-black text-sm border-2 border-${colors[i]}-500 bg-${colors[i]}-50 text-${colors[i]}-700 transition-all shadow-sm`;
        } else {
            btn.className = `quizz-c-btn flex-1 py-3 rounded-xl font-black text-sm border-2 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-all`;
        }
    });
}

async function saveQuizzManual() {
    const mapel = document.getElementById('quizz-mapel').value;
    const rombel = document.getElementById('quizz-rombel').value;
    const q = getQuillContent('quizz');
    const a0 = document.getElementById('quizz-a0').value;
    const a1 = document.getElementById('quizz-a1').value;
    const a2 = document.getElementById('quizz-a2').value;
    const a3 = document.getElementById('quizz-a3').value;
    const correctIdx = parseInt(document.getElementById('quizz-correct-val').value) || 0;
    const errorEl = document.getElementById('quizz-modal-error');

    if (!mapel || !rombel) {
        errorEl.innerText = "Mapel dan Rombel wajib dipilih!";
        errorEl.classList.remove('hidden');
        return;
    }
    if (!q || !a0 || !a1) {
        errorEl.innerText = "Pertanyaan dan minimal 2 opsi (A & B) wajib diisi!";
        errorEl.classList.remove('hidden');
        return;
    }

    const answers = [a0, a1, a2, a3].filter(x => x && x.trim() !== "");
    const safeCorrect = Math.min(correctIdx, answers.length - 1);

    const editIdx = document.getElementById('quizz-edit-idx').value;

    if (!db.quizzes) db.quizzes = [];

    const quizzObj = {
        mapel: mapel,
        rombel: rombel,
        question: q,
        answers: answers,
        correct: safeCorrect,
        images: window.storedQuizzImages && window.storedQuizzImages.length > 0 ? [...window.storedQuizzImages] : []
    };

    if (editIdx !== '') {
        const idx = parseInt(editIdx);
        if (idx >= 0 && idx < db.quizzes.length) {
            db.quizzes[idx] = quizzObj;
        } else {
            db.quizzes.push(quizzObj);
        }
    } else {
        db.quizzes.push(quizzObj);
    }

    await save();
    if (currentSiswa && currentSiswa.role === 'teacher') {
        renderTeacherQuizz();
    } else {
        renderAdminQuizz();
    }
    if (typeof renderTeacherQuizz === 'function') renderTeacherQuizz();

    closeModals();
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    Toast.fire({ icon: 'success', title: editIdx !== '' ? 'Pertanyaan Quizz Diperbarui!' : 'Pertanyaan Quizz Ditambahkan!' });
}

async function deleteQuizz(idx) {
    const result = await Swal.fire({
        title: 'Hapus Pertanyaan Quizz?',
        text: 'Pertanyaan ini akan dihapus secara permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus!'
    });
    if (result.isConfirmed) {
        db.quizzes.splice(idx, 1);
        await save();
        renderAdminQuizz();
        renderTeacherQuizz();
    }
}

function populateQuizzFilters(mapelSelect, rombelSelect) {
    const isTeacher = currentSiswa && currentSiswa.role === 'teacher';
    const isTeacherSelect = mapelSelect && mapelSelect.id.includes('teacher');

    if (mapelSelect && mapelSelect.options.length <= 1) {
        let subjects = db.subjects || [];
        if (isTeacher && isTeacherSelect) {
            subjects = teacherSubjectNames(currentSiswa);
        }

        mapelSelect.innerHTML = '<option value="">Semua Mapel</option>';
        subjects.forEach(m => {
            const mName = typeof m === 'string' ? m : m.name;
            const opt = document.createElement('option');
            opt.value = opt.textContent = mName;
            mapelSelect.appendChild(opt);
        });

        // Add change listener to update rombels if it's teacher select
        if (isTeacher && isTeacherSelect && rombelSelect) {
            mapelSelect.addEventListener('change', () => {
                const selectedMapel = mapelSelect.value;
                let rombels = [];
                if (selectedMapel) {
                    rombels = teacherAllowedRombels(currentSiswa, selectedMapel);
                } else {
                    rombels = teacherCombinedRombels(currentSiswa);
                }
                const currentRombel = rombelSelect.value;
                rombelSelect.innerHTML = '<option value="">Semua Rombel</option>' +
                    rombels.map(r => `<option value="${r}">${r === currentRombel ? ' selected' : ''}>${r}</option>`).join('');
            });
        }
    }

    if (rombelSelect && rombelSelect.options.length <= 1) {
        let rombels = db.rombels || [];
        if (isTeacher && isTeacherSelect) {
            const selectedMapel = mapelSelect ? mapelSelect.value : '';
            if (selectedMapel) {
                rombels = teacherAllowedRombels(currentSiswa, selectedMapel);
            } else {
                rombels = teacherCombinedRombels(currentSiswa);
            }
        }

        rombelSelect.innerHTML = '<option value="">Semua Rombel</option>';
        rombels.forEach(m => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = m;
            rombelSelect.appendChild(opt);
        });
    }
}

function buildQuizzRow(tbody, q, baseIdx) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-50 hover:bg-slate-50/50 transition-colors';
    let answersHtml = q.answers.map((a, i) =>
        `<div class="${i === q.correct ? 'text-green-600 font-bold' : 'text-slate-500'} bg-slate-50 p-1 mb-1 rounded flex items-center justify-between">
                    <span>${String.fromCharCode(65 + i)}. ${a}</span>
                    <i class="fas ${i === q.correct ? 'fa-check text-green-500' : 'fa-times opacity-0'}"></i>
                </div>`
    ).join('');

    let mapelBadge = q.mapel ? `<span class="bg-blue-100 text-blue-700 font-bold text-[9px] px-2 py-0.5 rounded-full mr-1">${q.mapel}</span>` : '';
    let rombelBadge = q.rombel ? `<span class="bg-purple-100 text-purple-700 font-bold text-[9px] px-2 py-0.5 rounded-full">${q.rombel}</span>` : '';

    let imagesHtml = '';
    if (q.images && q.images.length > 0) {
        imagesHtml = `<div class="mt-2 flex flex-wrap gap-2">` +
            q.images.map((img, imgIdx) => `<img src="${img}" class="h-16 w-16 object-cover rounded border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all" onclick="openImageZoom('${img}', ${imgIdx}, ${JSON.stringify(q.images).replace(/"/g, '&quot;')})">`).join('') +
            `</div>`;
    }

    tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="mb-2">${mapelBadge}${rombelBadge}</div>
                    <div class="text-sm font-bold text-slate-800">${q.question}</div>
                    ${imagesHtml}
                </td>
                <td class="px-6 py-4 text-xs w-1/2">${answersHtml}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="openQuizzModal(${baseIdx})" class="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all" title="Edit Soal">
                            <i class="fas fa-pencil-alt text-[10px]"></i>
                        </button>
                        <button onclick="deleteQuizz(${baseIdx})" class="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all" title="Hapus Soal">
                            <i class="fas fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                </td>
            `;
    tbody.appendChild(tr);
}

function renderAdminQuizz() {
    const tbody = document.getElementById('admin-quizz-table-body');
    const mapelFilter = document.getElementById('admin-quizz-filter-mapel');
    const rombelFilter = document.getElementById('admin-quizz-filter-rombel');
    if (!tbody) return;

    populateQuizzFilters(mapelFilter, rombelFilter);

    const fMapel = mapelFilter ? mapelFilter.value : '';
    const fRombel = rombelFilter ? rombelFilter.value : '';

    let quizzes = db.quizzes || [];
    if (fMapel) quizzes = quizzes.filter(q => q.mapel === fMapel);
    if (fRombel) quizzes = quizzes.filter(q => q.rombel === fRombel);

    tbody.innerHTML = '';

    if (quizzes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-slate-400"><i class="fas fa-gamepad text-3xl mb-2 opacity-30 block"></i>Belum ada pertanyaan quizz untuk kategori ini.</td></tr>';
        return;
    }

    quizzes.forEach((q) => {
        const baseIdx = db.quizzes.indexOf(q);
        buildQuizzRow(tbody, q, baseIdx);
    });
}

function renderTeacherQuizz() {
    const tbody = document.getElementById('teacher-quizz-table-body');
    const mapelFilter = document.getElementById('teacher-quizz-filter-mapel');
    const rombelFilter = document.getElementById('teacher-quizz-filter-rombel');
    if (!tbody) return;

    populateQuizzFilters(mapelFilter, rombelFilter);

    const fMapel = mapelFilter ? mapelFilter.value : '';
    const fRombel = rombelFilter ? rombelFilter.value : '';

    let quizzes = db.quizzes || [];

    // Strict enforcement for teachers
    if (currentSiswa && currentSiswa.role === 'teacher') {
        const tSubjects = teacherSubjectNames(currentSiswa);
        quizzes = quizzes.filter(q => {
            const allowedRombels = teacherAllowedRombels(currentSiswa, q.mapel);
            return tSubjects.includes(q.mapel) && allowedRombels.includes(q.rombel);
        });
    } else if (currentSiswa && currentSiswa.role === 'admin') {
        // Admin sees all
    }

    if (fMapel) quizzes = quizzes.filter(q => q.mapel === fMapel);
    if (fRombel) quizzes = quizzes.filter(q => q.rombel === fRombel);

    tbody.innerHTML = '';

    if (quizzes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-slate-400"><i class="fas fa-gamepad text-3xl mb-2 opacity-30 block"></i>Belum ada pertanyaan quizz untuk kategori ini.</td></tr>';
        return;
    }

    quizzes.forEach((q) => {
        const baseIdx = db.quizzes.indexOf(q);
        buildQuizzRow(tbody, q, baseIdx);
    });
}

window.syncUploadToSupabase = async function () {
    const btn = document.getElementById('btn-sync-upload');
    const status = document.getElementById('sync-status');
    const statusContent = document.getElementById('sync-status-content');

    if (!confirm('Apakah Anda yakin ingin mengupload database lokal ke Supabase Cloud? Ini akan memperbarui data di cloud dengan data lokal saat ini.')) return;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        }
        if (status) status.classList.remove('hidden');
        if (statusContent) {
            statusContent.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan ke server...';
            statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-sky-50 text-sky-600 border border-sky-100';
        }

        const response = await fetch(getApiBaseUrl() + '/api/sync/upload-to-supabase', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.ok) {
            if (statusContent) {
                statusContent.innerHTML = `<i class="fas fa-check-circle"></i> ${result.message}`;
                statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-emerald-50 text-emerald-600 border border-emerald-100';
            }
            Swal.fire('Berhasil', result.message, 'success');
        } else {
            throw new Error(result.error || 'Terjadi kesalahan saat upload');
        }
    } catch (e) {
        console.error('Sync Upload Error:', e);
        if (statusContent) {
            statusContent.innerHTML = `<i class="fas fa-exclamation-circle"></i> Gagal: ${e.message}`;
            statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-red-50 text-red-600 border border-red-100';
        }
        Swal.fire('Gagal', e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload ke Supabase';
        }
    }
};

window.syncDownloadFromSupabase = async function () {
    const btn = document.getElementById('btn-sync-download');
    const status = document.getElementById('sync-status');
    const statusContent = document.getElementById('sync-status-content');

    if (!confirm('Apakah Anda yakin ingin mendownload database dari Supabase Cloud? DATA LOKAL AKAN DITIMPA dengan data dari cloud.')) return;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        }
        if (status) status.classList.remove('hidden');
        if (statusContent) {
            statusContent.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan ke server...';
            statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-sky-50 text-sky-600 border border-sky-100';
        }

        const response = await fetch(getApiBaseUrl() + '/api/sync/download-from-supabase', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.ok) {
            if (statusContent) {
                statusContent.innerHTML = `<i class="fas fa-check-circle"></i> ${result.message}`;
                statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-emerald-50 text-emerald-600 border border-emerald-100';
            }
            Swal.fire({
                title: 'Berhasil',
                text: result.message + ' Halaman akan dimuat ulang.',
                icon: 'success',
                confirmButtonText: 'OK'
            }).then(() => {
                location.reload();
            });
        } else {
            throw new Error(result.error || 'Terjadi kesalahan saat download');
        }
    } catch (e) {
        console.error('Sync Download Error:', e);
        if (statusContent) {
            statusContent.innerHTML = `<i class="fas fa-exclamation-circle"></i> Gagal: ${e.message}`;
            statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-red-50 text-red-600 border border-red-100';
        }
        Swal.fire('Gagal', e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Download dari Supabase';
        }
    }
};

window.openQuizzAiModal = openQuizzAiModal;
window.openQuizzModal = openQuizzModal;
window.deleteQuizz = deleteQuizz;
window.renderAdminQuizz = renderAdminQuizz;
window.renderTeacherQuizz = renderTeacherQuizz;
window.syncUploadToSupabase = syncUploadToSupabase;
window.syncDownloadFromSupabase = syncDownloadFromSupabase;

async function openQuizzLeaderboardModal() {
    const mapelSel = document.getElementById('leaderboard-filter-mapel');
    const rombelSel = document.getElementById('leaderboard-filter-rombel');
    const modal = document.getElementById('quizz-leaderboard-modal');
    if (!mapelSel || !rombelSel || !modal) return;

    let subjects = [...new Set((db.quizzes || []).map(q => q.mapel))].filter(Boolean);
    let sections = [...new Set((db.quizzes || []).map(q => q.rombel))].filter(Boolean);

    if (currentSiswa && currentSiswa.role === 'teacher') {
        const tSubjects = teacherSubjectNames(currentSiswa);
        subjects = subjects.filter(s => tSubjects.includes(s));

        const updateLeaderboardRombels = (chosenMapel) => {
            let rombelsToUse;
            if (chosenMapel) {
                rombelsToUse = teacherAllowedRombels(currentSiswa, chosenMapel);
            } else {
                rombelsToUse = teacherCombinedRombels(currentSiswa);
            }
            rombelSel.innerHTML = '<option value="">Pilih Rombel</option>' +
                rombelsToUse.filter(r => sections.includes(r)).map(s => `<option value="${s}">${s}</option>`).join('');
        };

        mapelSel.innerHTML = '<option value="">Pilih Mapel</option>' + subjects.map(s => `<option value="${s}">${s}</option>`).join('');
        mapelSel.onchange = () => {
            updateLeaderboardRombels(mapelSel.value);
            fetchQuizzLeaderboard();
        };
        updateLeaderboardRombels('');
    } else {
        mapelSel.innerHTML = '<option value="">Pilih Mapel</option>' + subjects.map(s => `<option value="${s}">${s}</option>`).join('');
        rombelSel.innerHTML = '<option value="">Pilih Rombel</option>' + sections.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (window.leaderboardInterval) clearInterval(window.leaderboardInterval);
    window.leaderboardInterval = setInterval(fetchQuizzLeaderboard, 5000);
    fetchQuizzLeaderboard();
}

async function fetchQuizzLeaderboard() {
    const mapel = document.getElementById('leaderboard-filter-mapel').value;
    const rombel = document.getElementById('leaderboard-filter-rombel').value;
    const body = document.getElementById('leaderboard-body');
    const table = document.getElementById('leaderboard-table');
    const loading = document.getElementById('leaderboard-loading');
    const empty = document.getElementById('leaderboard-empty');

    if (!mapel || !rombel) {
        if (empty) empty.classList.remove('hidden');
        if (table) table.classList.add('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    if (body && !body.innerHTML.trim() && loading) loading.classList.remove('hidden');

    try {
        const res = await fetch(`/api/quizz/participants?mapel=${encodeURIComponent(mapel)}&rombel=${encodeURIComponent(rombel)}`);
        const participants = await res.json();

        if (loading) loading.classList.add('hidden');
        participants.sort((a, b) => (b.score || 0) - (a.score || 0));

        if (body) {
            if (participants.length === 0) {
                body.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-slate-400 font-bold italic">Belum ada peserta aktif dalam kuis ini.</td></tr>';
            } else {
                body.innerHTML = participants.map((p, idx) => `
                    <tr class="hover:bg-slate-50 transition-colors animate-fade-in">
                        <td class="px-4 py-4 text-center">
                            <div class="w-8 h-8 rounded-lg ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-orange-900' : 'bg-slate-100 text-slate-400'} flex items-center justify-center font-black mx-auto shadow-sm">
                                ${idx + 1}
                            </div>
                        </td>
                        <td class="px-4 py-4">
                            <div class="font-bold text-slate-700">${p.student_name}</div>
                            <div class="text-[10px] text-slate-400 uppercase font-black tracking-tighter">${p.student_id}</div>
                        </td>
                        <td class="px-4 py-4 text-center font-black text-sky-600 text-sm">
                            ${(p.score || 0).toLocaleString()}
                        </td>
                    </tr>
                `).join('');
            }
            if (table) table.classList.remove('hidden');
        }
    } catch (e) {
        console.error('Leaderboard Fetch Error:', e);
    }
}

async function openExamResultsRankingModal() {
    const rombelSel = document.getElementById('exam-ranking-filter-rombel');
    const mapelSel = document.getElementById('exam-ranking-filter-mapel');
    const modal = document.getElementById('exam-results-ranking-modal');
    if (!rombelSel || !mapelSel || !modal) return;

    await ensureDataLoaded('results');

    const results = (db.results || []).filter(r => !r.deleted && r.rombel);
    const rombels = [...new Set(results.map(r => r.rombel))].sort();
    rombelSel.innerHTML = '<option value="">Pilih Rombel</option>' + rombels.map(r => `<option value="${r}">${r}</option>`).join('');
    mapelSel.innerHTML = '<option value="">Semua Mapel</option>';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    fetchExamResultsRanking();
}

function fetchExamResultsRanking() {
    const rombel = document.getElementById('exam-ranking-filter-rombel')?.value;
    const mapel = document.getElementById('exam-ranking-filter-mapel')?.value;
    const body = document.getElementById('exam-ranking-body');
    const table = document.getElementById('exam-ranking-table');
    const loading = document.getElementById('exam-ranking-loading');
    const empty = document.getElementById('exam-ranking-empty');

    if (!body || !table || !loading || !empty) return;
    if (!rombel) {
        empty.classList.remove('hidden');
        table.classList.add('hidden');
        return;
    }

    empty.classList.add('hidden');
    loading.classList.remove('hidden');
    table.classList.add('hidden');

    const allResults = (db.results || []).filter(r => !r.deleted && r.rombel === rombel);
    const mapels = [...new Set(allResults.map(r => r.mapel))].sort();
    const mapelSel = document.getElementById('exam-ranking-filter-mapel');
    if (mapelSel) {
        mapelSel.innerHTML = '<option value="">Semua Mapel</option>' + mapels.map(m => `<option value="${m}">${m}</option>`).join('');
        if (mapel && !mapels.includes(mapel)) {
            mapelSel.value = '';
        }
    }

    const filteredResults = mapel ? allResults.filter(r => r.mapel === mapel) : allResults;
    const aggregated = {};

    filteredResults.forEach(r => {
        const key = (r.studentId || r.studentName || '').trim() || `unknown-${r.mapel}`;
        if (!aggregated[key]) {
            aggregated[key] = {
                studentId: r.studentId || '—',
                studentName: r.studentName || '—',
                score: 0,
                count: 0,
                latestDate: r.date ? new Date(r.date) : null,
                mapelLabel: mapel ? mapel : 'Semua Mapel'
            };
        }
        aggregated[key].score += Number(r.score || 0);
        aggregated[key].count += 1;
        const date = r.date ? new Date(r.date) : null;
        if (date && (!aggregated[key].latestDate || date > aggregated[key].latestDate)) {
            aggregated[key].latestDate = date;
        }
    });

    const rows = Object.values(aggregated);

    setTimeout(() => {
        loading.classList.add('hidden');
        if (rows.length === 0) {
            empty.classList.remove('hidden');
            table.classList.add('hidden');
            body.innerHTML = '';
            return;
        }

        rows.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.latestDate && a.latestDate) return b.latestDate - a.latestDate;
            return 0;
        });

        body.innerHTML = rows.map((r, idx) => `
            <tr class="hover:bg-slate-50 transition-colors animate-fade-in">
                <td class="px-4 py-4 text-center">
                    <div class="w-8 h-8 rounded-lg ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-orange-900' : 'bg-slate-100 text-slate-400'} flex items-center justify-center font-black mx-auto shadow-sm">
                        ${idx + 1}
                    </div>
                </td>
                <td class="px-4 py-4">
                    <div class="font-bold text-slate-700">${r.studentName}</div>
                    <div class="text-[10px] text-slate-400 uppercase font-black tracking-tighter">${r.studentId}</div>
                    <div class="text-[10px] text-slate-500 mt-1">${r.count} hasil ujian</div>
                </td>
                <td class="px-4 py-4 text-slate-600">${r.mapelLabel}</td>
                <td class="px-4 py-4 text-center font-black text-sky-600 text-sm">${r.score.toFixed(1)}</td>
                <td class="px-4 py-4 text-slate-400 text-xs">${r.latestDate ? r.latestDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
            </tr>
        `).join('');

        empty.classList.add('hidden');
        table.classList.remove('hidden');
    }, 50);
}

window.openQuizzLeaderboardModal = openQuizzLeaderboardModal;
window.fetchQuizzLeaderboard = fetchQuizzLeaderboard;
window.openExamResultsRankingModal = openExamResultsRankingModal;
window.fetchExamResultsRanking = fetchExamResultsRanking;

// --- Gemini Model Preference ---
async function saveGeminiModelPreference() {
    const sel = document.getElementById('gemini-model-selection');
    if (!sel) return;
    const model = sel.value;
    try {
        const res = await fetch('/api/admin/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'gemini_model_preference', value: model })
        });
        if (res.ok) {
            console.log('[AI] Gemini model preference saved:', model);
            if (typeof Swal !== 'undefined') {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'bottom-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true
                });
                Toast.fire({ icon: 'success', title: `Model preferred: ${model}` });
            }
        }
    } catch (e) {
        console.error('[AI] Failed to save Gemini model preference:', e.message);
    }
}

async function loadGeminiModelPreference() {
    const sel = document.getElementById('gemini-model-selection');
    if (!sel) return;
    try {
        const res = await fetch('/api/admin/config/gemini_model_preference');
        if (res.ok) {
            const data = await res.json();
            if (data.value) {
                sel.value = data.value;
                console.log('[AI] Gemini model preference loaded:', data.value);
            }
        }
    } catch (e) {
        console.error('[AI] Failed to load Gemini model preference:', e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadGeminiModelPreference, 1000);
});

window.saveGeminiModelPreference = saveGeminiModelPreference;
window.loadGeminiModelPreference = loadGeminiModelPreference;


