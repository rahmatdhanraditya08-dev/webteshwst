# Monitoring Kontrol HWST

Dashboard web statis untuk monitoring delapan sensor suhu DS18B20, parameter listrik PZEM-004T, mode operasi HWST, dan panel surya.

## Menjalankan lokal

```sh
npm install
npm run dev
```

Build produksi tersedia di folder `dist` setelah menjalankan `npm run build`.

## GitHub Pages

Workflow `.github/workflows/pages.yml` akan membangun dan menerbitkan situs saat ada push ke branch `main`. Di repository GitHub, buka **Settings → Pages** dan pilih **GitHub Actions** sebagai deployment source.

## Sumber data

`src/data/hwst-config.json` mengatur URL Firebase Realtime Database hanya untuk pembacaan suhu dan status sistem. Agar data live terbaca, aturan Firebase harus mengizinkan pembacaan pada `/temperature` dan `/system`; jangan menaruh kredensial admin atau rahasia Firebase di website. Bila Firebase tidak tersedia, dashboard kembali ke nilai contoh.

Metrik PZEM dan panel surya saat ini adalah data contoh. Firmware yang disertakan belum mengunggah data PZEM/panel surya, dan belum menerima perintah mode HWST dari web. Pilihan mode di dashboard hanya pratinjau antarmuka.

## Catatan akses

Login browser memakai nilai demo dari `src/data/hwst-config.json`. Karena situs statis dan source code-nya publik, nilai tersebut bisa dilihat siapa saja dan **bukan autentikasi atau perlindungan data**. Jangan gunakan login ini untuk membatasi akses data sensitif. Gunakan backend dengan autentikasi (misalnya Firebase Authentication dan Security Rules) jika akses perlu benar-benar dibatasi.