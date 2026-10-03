# Admin Sync System - Dokumentasi

## 📋 Overview

Sistem **Admin Sync** memungkinkan admin untuk melakukan perubahan tanpa langsung menyimpan ke server. Semua perubahan disimpan secara lokal terlebih dahulu, dan admin dapat memilih kapan untuk mensinkronkan dengan server.

**Fitur:**
- ✅ Perubahan disimpan lokal saja (untuk admin)
- ✅ Tombol sinkron floating di bottom-right
- ✅ Visual indicator untuk perubahan yang belum disinkronkan
- ✅ Guru dan Siswa tetap normal (save langsung)

---

## 🎯 Bagaimana Cara Kerja

### Mode Admin Aktif
1. Ketika **admin login**, sistem otomatis mendeteksi `currentSiswa.role === 'admin'`
2. `adminSyncState.isAdminMode` diatur ke `true`
3. Tombol sinkron dibuat secara otomatis di tampilan

### Ketika Admin Melakukan Perubahan
1. Admin melakukan operasi (edit guru, hapus soal, dll)
2. Sistem memanggil `adminSave()` daripada `save()`
3. Data disimpan ke **localStorage saja** (tidak ke server)
4. `markAdminChanges()` dipanggil untuk menandai ada perubahan
5. Tombol sinkron berubah warna menjadi merah dan berkedip

### Ketika Admin Klik Tombol Sinkron
1. Admin klik tombol sinkron (cloud upload icon)
2. `adminSyncToServer()` dipanggil
3. Sistem menjalankan `save({ forceServerSave: true })`
4. Semua perubahan lokal tersinkron ke server
5. Notifikasi sukses ditampilkan

---

## 🎨 UI Tombol Sinkron

**Lokasi:** Bottom-right corner (fixed position)

**Status:**

| Status | Warna | Animasi | Arti |
|--------|-------|---------|------|
| Normal | Biru | - | Tidak ada perubahan |
| Ada Perubahan | Merah | Berkedip (pulse) | Ada perubahan belum disinkronkan |
| Sedang Sinkronkan | Orange | Spinner | Proses sinkronisasi berlangsung |

**Tooltip:** Hover di button untuk melihat penjelasan

---

## 🔧 Implementasi Teknis

### State Management
```javascript
let adminSyncState = {
    isAdminMode: false,           // Admin mode active?
    hasUnsyncedChanges: false,    // Ada perubahan belum disinkronkan?
    isSyncing: false,             // Sedang sinkronkan?
    lastSyncTime: null            // Kapan terakhir disinkronkan?
};
```

### Functions Kunci

#### `adminSave(options)`
- Hanya untuk admin mode
- Menyimpan ke localStorage saja
- Tidak mengirim ke server

#### `markAdminChanges()`
- Menandai ada perubahan
- Update UI button sinkron
- Trigger pulse animation

#### `adminSyncToServer()`
- Manual sync trigger
- Menjalankan `save({ forceServerSave: true })`
- Tampilkan notifikasi hasil

#### `createAdminSyncUI()`
- Membuat button sinkron secara dinamis
- Inject CSS untuk styling
- Append ke `document.body`

---

## 📍 Functions yang Dimodifikasi

functions di `js/modules/admin.js` yang sudah diupdate:
- `deleteTeacher()` - Hapus akun guru
- `cleanCorruptedResults()` - Bersihkan hasil ujian corrupt
- `batchAiCorrectAllStudents()` - Koreksi esai dengan AI
- `deleteSelectedAdminQuestions()` - Hapus soal terpilih
- `deleteFilteredQuestions()` - Hapus soal berdasarkan filter
- `saveSchedules()` - Simpan jadwal akses
- `deleteAdminPackageQuestions()` - Hapus paket soal

Functions di `js/core/app-state.js` yang sudah diupdate:
- `deleteResult()` - Hapus hasil ujian (per item)
- `clearAllResults()` - Hapus semua hasil ujian
- `cleanIncompleteResults()` - Bersihkan hasil ujian tidak lengkap
- `saveStudent()` - Simpan/edit siswa
- `deleteStudent()` - Hapus siswa
- `resetStudentResults()` - Reset hasil ujian

---

## ✅ Behavioral Notes

### Guru & Siswa
- **Tetap normal** - Save langsung ke server
- Tidak terpengaruh oleh admin sync mode
- Perubahan mereka tetap langsung tersimpan

### Admin
- Hanya untuk admin dengan `role === 'admin'`
- Perubahan **tidak langsung** ke server
- Semua perubahan **harus disinkronkan** dengan tombol

### Notifikasi
- Toast message untuk sukses sinkronisasi
- Toast message untuk error sinkronisasi
- UI button memberikan visual feedback

---

## 🚀 Testing

1. **Login sebagai Admin**
   - Pastikan tombol sinkron muncul di bottom-right

2. **Lakukan Perubahan**
   - Edit guru
   - Hapus soal
   - Reset hasil ujian
   - Tombol seharusnya berubah merah dan berkedip

3. **Sinkronkan**
   - Klik tombol sinkron
   - Lihat spinner loading
   - Tunggu notifikasi sukses
   - Tombol kembali ke biru normal

4. **Refresh Halaman**
   - Setelah sinkronisasi, refresh halaman
   - Perubahan harus tetap ada
   - Tombol kembali normal (biru)

---

## 🔐 Security Considerations

- Perubahan disimpan di localStorage (local machine only)
- Data tidak terlindungi jika browser cache dibersihkan
- Gunakan secure connection (HTTPS) saat sinkronisasi
- Server memvalidasi semua perubahan seperti biasa saat disinkronkan

---

## 📝 CSS Animations

```css
@keyframes pulse-sync {
    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    50% { box-shadow: 0 0 30px 10px rgba(239, 68, 68, 0.3); }
    100% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
```

---

## 📞 Troubleshooting

**Q: Tombol sinkron tidak muncul**
- Check apakah user login sebagai admin
- Check browser console untuk error messages

**Q: Perubahan tidak tersimpan setelah sinkronisasi**
- Check server connection
- Lihat response dari `adminSyncToServer()` di console
- Pastikan localStorage tidak penuh

**Q: Tombol tetap merah setelah sinkronisasi**
- Refresh halaman
- Check browser console untuk error
- Coba sinkronisasi ulang

---

**Created:** October 1, 2026  
**System:** Admin Sync Mode v1.0  
**Target:** DR CBT Application

