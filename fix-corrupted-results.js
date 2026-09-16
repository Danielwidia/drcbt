// ─── CLEANUP FUNCTION: Hapus Hasil Ujian yang Invalid/Undefined ──────────────
function cleanCorruptedResults() {
    const corruptedResults = (db.results || []).filter(r => {
        if (r.deleted) return false;
        const hasUndefinedName = !r.studentName || String(r.studentName).trim() === 'undefined';
        const hasUndefinedRombel = !r.rombel || String(r.rombel).trim() === 'undefined';
        const hasUndefinedMapel = !r.mapel || String(r.mapel).trim() === 'undefined';
        const hasUndefinedId = !r.studentId || String(r.studentId).trim() === 'undefined';
        return hasUndefinedName || hasUndefinedRombel || hasUndefinedMapel || hasUndefinedId;
    });
    if (corruptedResults.length === 0) {
        alert('✅ Tidak ada hasil ujian yang corrupt. Semua data valid!');
        return;
    }
    if (!confirm(`⚠️ Akan menghapus ${corruptedResults.length} hasil ujian yang corrupt/undefined dari database.\n\nLanjutkan?`)) return;
    const now = Date.now();
    let cleanedCount = 0;
    db.results = (db.results || []).map(r => {
        if (!r || r.deleted) return r;
        const hasUndefinedName = !r.studentName || String(r.studentName).trim() === 'undefined';
        const hasUndefinedRombel = !r.rombel || String(r.rombel).trim() === 'undefined';
        const hasUndefinedMapel = !r.mapel || String(r.mapel).trim() === 'undefined';
        const hasUndefinedId = !r.studentId || String(r.studentId).trim() === 'undefined';
        if (hasUndefinedName || hasUndefinedRombel || hasUndefinedMapel || hasUndefinedId) {
            cleanedCount++;
            return { ...r, deleted: true, updatedAt: now, cleanedReason: 'Corrupted: undefined fields' };
        }
        return r;
    });
    if (cleanedCount > 0) {
        loadedCollections.results = true;
        save();
        updateCompletionCharts();
        renderAdminResults && renderAdminResults();
        alert(`✅ SUKSES!\n\n${cleanedCount} hasil ujian corrupt telah dibersihkan dan disimpan ke server.`);
    }
}
window.cleanCorruptedResults = cleanCorruptedResults;
