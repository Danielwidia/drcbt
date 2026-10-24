$filePath = 'D:\BUAT APLIKASI\CBT\DR CBT - online\server.js'
$lines = [System.IO.File]::ReadAllLines($filePath)

# Line 2815 (index 2814) is corrupted - fix it
$lines[2814] = "   - Pertanyaan pemantik dan tugas untuk dikerjakan peserta didik"

# Insert the missing lines after index 2814 (after line 2815)
$before = $lines[0..2814]
$insert = @(
    "   - Ruang untuk kesimpulan dan refleksi peserta didik",
    "   Pastikan LKPD dirancang untuk mendukung kegiatan pembelajaran interaktif dan mengembangkan pemikiran kritis peserta didik.",
    "",
    "Pastikan setiap bagian jelas, terukur, dan sesuai dengan standar Kurikulum Merdeka.```;",
    "        } else if (formatRPP === 'k13') {",
    "            formatInstruction = 'Gunakan format Kurikulum 2013 dengan komponen: Identitas, Standar Kompetensi, Kompetensi Dasar, Indikator Pencapaian, Tujuan Pembelajaran, Materi Pokok, Metode Pembelajaran, Alokasi Waktu, Langkah-langkah Pembelajaran (Pendahuluan, Inti, Penutup), Media/Alat/Sumber Belajar, dan Penilaian.';",
    "        } else if (formatRPP === 'ringkas') {",
    "            formatInstruction = 'Buat RPP Ringkas dalam format 1 halaman maksimal. Fokus pada hal-hal esensial: Tujuan Pembelajaran singkat, Langkah Pembelajaran (Pendahuluan-Inti-Penutup) secara ringkas, dan Penilaian sederhana. Hindari penjelasan yang terlalu panjang.';",
    "        } else if (formatRPP === 'detail') {",
    "            formatInstruction = 'Buat RPP Detail dan Lengkap dengan penjelasan menyeluruh. Sertakan Identitas, Capaian Pembelajaran, Tujuan Pembelajaran, Indikator Ketercapaian, Materi Pembelajaran, Pendekatan/Strategi Pembelajaran, Langkah-langkah Pembelajaran (Pendahuluan dengan apersepsi, Inti dengan aktivitas detail, Penutup dengan refleksi), Media dan Sumber Belajar, dan Asesmen (Formatif & Sumatif) dengan rubrik penilaian yang jelas.';",
    "        }",
    "",
    "        promptText = ``Buatkan Rencana Pelaksanaan Pembelajaran (RPP) yang baik dan efektif untuk kelas/fase `${fase}` mata pelajaran `${mapel}` mengenai `${topicHint}`. Alokasi waktu: `${extraData?.waktu || '2 x 40 Menit'}`. Gunakan Model Pembelajaran: `${extraData?.model || 'Problem Based Learning'}`. `${formatInstruction}```;",
    "    } else if (type === 'prota-promes') {",
    "        docType = ``Prota dan Promes``;",
    "        promptText = ``Rancang secara ringkas Program Tahunan (Prota) and Program Semester (Promes) pada mata pelajaran `${mapel}` fase `${fase}` semester `${semester}` mengenai `${topicHint}`. Total Pekan Efektif yang direncanakan: `${extraData?.pekan || '18'}` Pekan.``;",
    "    } else if (type === 'kisi-kisi') {",
    "        docType = ``Kisi-kisi Ujian``;",
    "        promptText = ``Buatkan `${docType}` (Bentuk: `${extraData?.jenis || 'Soal Ujian Tertulis'}`) untuk mata pelajaran `${mapel}` `${topicHint}` fase `${fase}`. Sajikan dalam bentuk format matriks yang merinci: Indikator Soal, Level Kognitif (seperti L1/L2/L3 atau C1-C6), and Bentuk Soal.``;"
)
$after = $lines[2815..($lines.Length - 1)]

$newLines = $before + $insert + $after
[System.IO.File]::WriteAllLines($filePath, $newLines, [System.Text.Encoding]::UTF8)
Write-Output "Done. Total lines: $($newLines.Length)"
