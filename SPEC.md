# SPEC — Lunr.js (Fork mLengse)

| | |
|---|---|
| **Modul** | `lunr.js` (bundle sumber), `lunr.min.js` (minify) |
| **Fork dari** | [olivernn/lunr.js](https://github.com/olivernn/lunr.js) `v2.3.9` |
| **Repository** | [mlengse/lunr.js](https://github.com/mlengse/lunr.js) |
| **Ekosistem** | [bahasa](https://github.com/mlengse/bahasa) — search engine Bahasa Indonesia |
| **Lisensi** | MIT |
| **Status** | Produksi (versi paket `2.3.9`, baseline `2.3.9` upstream + delta lokal) |

Dokumen ini mendeskripsikan perilaku yang **harus** dipenuhi fork ini. Semua
ketentuan di sini diturunkan dari implementasi saat ini dan merupakan kontrak
yang harus dijaga kompatibelnya oleh perubahan apa pun ke depannya. Bagian yang
berbeda dari upstream ditandai eksplisit (lihat §3).

---

## 1. Tujuan

Lunr.js adalah *client-side full-text search engine* ringan yang berjalan di
browser. Fork ini (mLengse) mempertahankan API dan format serialisasi `v2.3.9`
upstream, namun menambahkan perbaikan keamanan, normalisasi Unicode, dan
optimasi struktur data agar cocok dipakai sebagai mesin pencari untuk korpus
teks berbahasa Indonesia (tokenisasi `NFC`, `TokenSet` yang stabil pada
wildcard/fuzzy, `idf` yang benar pada posting `null-prototype`).

Tujuan utama:

1. **Index & pencarian vektor** — dokumen dipetakan ke vektor ruang term,
   kueri di-skor dengan model BM25-varian.
2. **Bahasa kueri** — wildcard, fuzzy (edit distance), boost, field-scoping,
   presence (`+`/`-`).
3. **Pipeline** — trimmer, stop-word filter, stemmer (dapat diganti untuk
   bahasa non-Inggris, mis. via `lunr-languages`).
4. **Serialisasi** — index dapat di-`toJSON`/`load` dan dipertukarkan antar
   sesi.

---

## 2. Ruang Lingkup

Dokumen ini mencakup:

- Perbedaan (delta) implementasi terhadap upstream `v2.3.9`.
- Arsitektur modul dan alur index/query.
- Model skoring dan struktur data internal (`TokenSet`, `Set`, `Vector`).
- API publik dan bahasa kueri.
- Format serialisasi dan validasi saat `load`.
- Proses build & pengujian.

Di luar lingkup:

- Plugin bahasa `lunr.id` (berada di [lunr-languages](../lunr-languages)).
- Stemmer non-Inggris.
- Backend server / pencarian terdistribusi.

---

## 3. Delta vs Upstream `v2.3.9`

Perubahan pada `lib/` diukur terhadap tag `v2.3.9` upstream (16 file,
+199/−91 baris). Dikelompokkan sebagai berikut.

### 3.1 Normalisasi Unicode (NFC)

- `lib/tokenizer.js`: input `string` dan tiap elemen array dinormalisasi
  `normalize('NFC')` **sebelum** `toLowerCase()`. Memastikan teks berkarakter
  gabungan (composed/decomposed) menghasilkan token yang identik.
- Separator tokenizer disederhanakan dari `/\s\-/` menjadi `/[\s-]+/`
  (ekivalen, ditulis sebagai karakter class eksplisit).

### 3.2 Stabilitas `TokenSet` (wildcard/fuzzy)

- `lib/token_set.js#intersect`: semantik dikembalikan ke upstream (tanpa
  memoization). Fork ini sempat menambahkan memoization — 1 node output per
  pasangan `(node.id, qNode.id)` + ekspansi tiap pasangan sekali — untuk
  meredam eksplosi eksponensial pada DAG minimal, namun ternyata **tidak
  sound**: node output yang dishare antar jalur menyebabkan finality bocor,
  sehingga hasil intersect bisa menyertakan kata yang salah (mis.
  `['abbca','dda']` × `*c*` → `['abbca','dda']`, upstream `['abbca']`; lihat
  audit 2026-08-03). Memoization tersebut dihapus; pasangan node yang sama
  dijangkau lewat jalur berbeda tetap menghasilkan node output terpisah dan
  hanya digabung bila dua match bertemu di edge karakter yang sama dari satu
  node output (union yang sound).
- `lib/token_set.js#toArray`: melempar `Error` bila `TokenSet` mengandung
  wildcard (`"*"` di `edges`) — melengkapi dokumentasi "unsupported use case".
- `lib/token_set_builder.js`: pemeriksaan `===` untuk kosongnya `uncheckedNodes`.

### 3.3 Perhitungan `idf` yang aman

- `lib/idf.js`: penambahan `Object.prototype.hasOwnProperty` saat iterasi field
  posting dan ref dokumen, sehingga `documentsWithTerm` tidak menghitung properti
  warisan (inherited enumerable). Hasil identik untuk posting normal.

### 3.4 Validasi input Builder & Index

- `lib/builder.js#add`: melempar `Error` bila dokumen `null`/`undefined`, bila
  field ref tidak ada, atau bila ref duplikat (mencegah pencatatan dokumen ganda).
- `lib/builder.js#build`: melempar `Error` bila `documentCount === 0`
  (menolak membangun index tanpa dokumen).
- `lib/builder.js#k1`: nilai negatif di-clamp ke `0` (mencegah parameter skor
  tidak valid).
- `lib/index.js#load`: validasi bentuk serialisasi sebelum diproses —
  `fieldVectors`, `invertedIndex`, `fields`, `pipeline` harus array; tuple
  fieldVectors `[ref, elements]` dan invertedIndex `[term, posting]` juga
  divalidasi. Cek `pipeline` dilakukan sebelum `Pipeline.load` (sebelumnya
  dead code — `Pipeline.load` terpanggil lebih dulu → `TypeError` mentah).
  Bentuk rusak → `Error` eksplisit, bukan error samar saat akses.
- `lib/field_ref.js#fromString`: melempar `new Error(...)` menggantikan
  `throw "string"` (sebelumnya melempar nilai string).
- `lib/vector.js#insert`: `throw new Error("duplicate index")` menggantikan
  `throw "duplicate index"`.

### 3.5 Keamanan prototype

- `lib/builder.js`: `fieldTermFrequencies`, `fieldLengths`, `accumulator`,
  `documentsWithField`, `fieldVectors` dibuat dengan `Object.create(null)`
  (bukan object literal), mencegah tabrakan dengan properti bawaan
  (`__proto__`, `constructor`, dst.).
- `lib/match_data.js#add` dan `#combine`: metadata array di-`slice()` saat
  disalin (defensive copy), mencegah alias/berbagi referensi array antar
  `MatchData`; `add` mengkopi isi metadata key-per-key ke object
  `Object.create(null)`.

### 3.6 Parser kueri & kesalahan

- `lib/query_parser.js#parseEditDistance`: edit distance negatif → `Error`
  "edit distance must be a non-negative integer".
- `lib/query_parser.js#parseBoost`: `parseFloat` menggantikan `parseInt`
  (mendukung boost desimal, mis. `foo^1.5`); boost ≤ 0 → `Error`
  "boost must be a positive number".
- `lib/query_lexer.js#lexBoost`: `acceptDecimalRun` (integer + opsional `.` +
  digit pecahan) menggantikan `acceptDigitRun`, sehingga `foo^1.5` di-lex
  sebagai satu lexeme BOOST `"1.5"`. Sebelumnya `acceptDigitRun` hanya
  membaca `"1"` dan `.5` jatuh menjadi term, membuat `parseFloat` tidak
  pernah melihat desimal.
- `lib/query_parse_error.js`: prototype `Object.create(Error.prototype)`
  + `constructor` di-reset; fungsi bernama sehingga `constructor.name ===
  "QueryParseError"`; `stack` diisi via `Error.captureStackTrace`.
- `lib/query.js#isNegated`: guard bila `clauses` kosong (return `false`,
  bukan iterasi loop kosong yang ambigu).

### 3.7 Perbaikan kecil (equality ketat, dll.)

- Perbandingan longgar (`==`/`!=`) pada `lib/` dikencangkan ke
  `===`/`!==` di titik yang relevan (builder, idf, index, match_data,
  pipeline, query_lexer, query_parser, set, stemmer, token_set,
  token_set_builder, tokenizer, vector).
- `lib/query.js`: dua perbandingan `!=` (periksa wildcard eksisting saat
  `LEADING`/`TRAILING`) sengaja dipertahankan karena `lunr.Query.wildcard`
  adalah objek `String` (`new String("*")`); loose equality dipakai untuk
  meng-koersi objek ke nilai primitifnya.
- `lib/vector.js#magnitude`: sentinel cache diubah dari `0` → `undefined`;
  pengecekan `_magnitude !== undefined` agar nilai magnitudo yang memang `0`
  (vector kosong) tetap dihitung ulang konsisten.
- `lib/vector.js#similarity`: ditambahkan docstring yang menjelaskan formula
  **bukan** cosine similarity murni — hasil asimetris (`a.similarity(b) !==
  b.similarity(a)`) karena hanya dibagi magnitudo vektor ini (selalu vektor
  kueri → normalisasi panjang kueri).
- `lib/trimmer.js`: `lunr.trimmer.wordCharacters` diekspos sebagai properti
  statis dan **dipakai** — regex `[^...]` dibangun dari properti tersebut
  per panggilan (default ASCII + Latin extend; `0-9` dan `_` dipertahankan
  sebagai word char agar setara dengan `\W`). Plugin bahasa dapat menimpanya.
- `lib/query.js`: komentar dokumentasi untuk `lunr.Query.wildcard` yang
  sengaja berupa objek `String` agar konstanta `NONE/LEADING/TRAILING`
  terpasang.

### 3.8 Lain-lain

- `lib/match_data.js`, `lib/token_set.js`: tautan isu di komentar diperbarui
  ke repo mLengse.
- Toolchain dev di-upgrade (`package.json`: `eslint ^8.57.1`, `mocha ^11.7.6`,
  `uglify-js ^3.19.3`, `jsdoc ^4.0.5`, dll.) + `overrides` untuk menutup
  CVE (`diff`, `serialize-javascript`, `minimatch`).
- `build/build.js` ditulis ulang sebagai skrip Node **cross-platform**
  (pengganti pipeline shell Unix di `Makefile`), termasuk target
  `lunr.js`, `lunr.min.js`, JSON templates, `size`, `clean`.

---

## 4. Arsitektur & Struktur Modul

Sumber di `lib/` (21 file), digabung oleh `build/build.js` ke `lunr.js`
mengikuti urutan deklarasi:

```
lib/lunr.js               factory lunr(config) → builder.build()
lib/utils.js              utils (warn, asString, clone)
lib/field_ref.js          ref "field/docRef" (joiner '/')
lib/set.js                Set (empty, complete, union, intersect)
lib/idf.js                idf(posting, documentCount)
lib/token.js              Token + token metadata
lib/tokenizer.js          pemisahan string → Token[]
lib/pipeline.js           pipeline register/run (index & search)
lib/vector.js             Vector sparse (elements flat pairs)
lib/stemmer.js            stemmer Porter Inggris (default)
lib/stop_word_filter.js   stop-word filter default
lib/trimmer.js            trimmer + wordCharacters statis
lib/token_set.js          TokenSet DAG + intersect/toArray/fromFuzzyString
lib/token_set_builder.js  builder DAG minimal (suffix sharing)
lib/index.js              Index: query, search, toJSON, load
lib/builder.js            Builder: add, field, build, skor BM25
lib/match_data.js         MatchData metadata hasil pencarian
lib/query.js              Query + clause + wildcard/presence
lib/query_parse_error.js  QueryParseError
lib/query_lexer.js        lexer bahasa kueri
lib/query_parser.js       parser bahasa kueri
```

Alur load/bundle: `build/wrapper_start` + isi `lib/*` + `build/wrapper_end`;
`@VERSION` diisi dari `VERSION`, `@YEAR` dari tahun build.

---

## 5. Pipeline & Tokenisasi

### 5.1 Tokenizer (`lunr.tokenizer`)

- Input `null`/`undefined` → `[]`.
- Input array → tiap elemen `asString(t).normalize('NFC').toLowerCase()`
  menjadi `Token` (metadata di-`clone`).
- Input lain → `obj.toString().normalize('NFC').toLowerCase()`, dipotong pada
  separator `/[\s-]+/`. Token kosong dibuang.
- `lunr.tokenizer.separator` dapat ditimpa per pemakaian.

### 5.2 Pipeline

- **Index pipeline** (dipakai saat add): `trimmer → stopWordFilter → stemmer`.
- **Search pipeline** (dipakai saat query): `stemmer`.
- Pipeline direpresentasikan `lunr.Pipeline` dengan `registerFunction`,
  `run`, `runString`, `before`, `after`, `remove`.
- Fungsi pipeline yang mengembalikan `null`/`undefined` → token di-skip;
  hasil array → diperluas (term expansion).

### 5.3 Trimmer

- `lunr.trimmer` memangkas karakter non-word dari ujung token.
- Karakter word ditentukan `lunr.trimmer.wordCharacters` (default kelas ASCII
  + Latin extend). Plugin bahasa (mis. `lunr.id.trimmer`) menimpa properti ini.

### 5.4 Stemmer & Stop-word

- `lunr.stemmer`: Porter stemmer bahasa Inggris (bundled default).
- `lunr.stopWordFilter`: daftar stop-word statis; dapat diganti per bahasa.
- Untuk Bahasa Indonesia, pasang plugin `lunr.id` dari `lunr-languages`.

---

## 6. Model Skoring

### 6.1 IDF

```
idf(term) = ln(1 + |(N - df + 0.5) / (df + 0.5)|)
```

- `df` dihitung dari posting: jumlah ref dokumen di seluruh field (properti
  `_index` diabaikan; properti warisan tidak dihitung).
- Berbagi antara `Builder.createFieldVectors` dan `Index.query`.

### 6.2 BM25 field score

```
score = idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * fieldLength / averageFieldLength))
```

- `k1` default `1.2` (negatif di-clamp ke `0`), `b` default `0.75`.
- Per-field, dengan `fieldTermFrequencies` dan `fieldLengths` berbasis
  `Object.create(null)`.

### 6.3 Skor dokumen

- Query membangun satu `lunr.Vector` per field (nilai = `boost` per term,
  di-`upsert` akumulatif).
- `Index.query` menjumlahkan `vector.dot(queryVector) / vector.magnitude()`
  di seluruh field (normalisasi hanya oleh magnitudo vektor dokumen —
  **bukan** cosine murni; lihat 3.7).
- Hasil disortir menurun oleh skor; `MatchData` mencatat metadata per
  term/field.

---

## 7. Struktur Data Internal

### 7.1 `TokenSet` (DAG minimal)

- TokenSet index dibangun `TokenSet.Builder` dengan **suffix sharing**
  (minimized DAG) agar `toArray`/`intersect` efisien.
- `fromString`, `fromArray`, `fromClause`, `fromFuzzyString` membangun
  TokenSet kueri (wildcard `*`, edit distance).
- `intersect(b)` — tanpa memoization lintas jalur: node output hanya dishare
  bila dua match bertemu di edge karakter yang sama dari satu node output
  (lihat 3.2).
- `toArray()` menolak TokenSet berwildcard (`Error`).

### 7.2 `lunr.Set`

- Himpunan ref dokumen (array terurut), operasi `union`, `intersect`,
  `toArray`, `length`; konstanta `empty` dan `complete`.

### 7.3 `lunr.Vector`

- Sparse: `elements` datar berpasangan `[index, value, index, value, ...]`
  terurut naik.
- `insert`, `upsert(index, val, fn)`, `positionForIndex` (binary search),
  `dot`, `magnitude` (cache lazy, sentinel `undefined`), `similarity`.

---

## 8. API Publik

Ruang nama global `lunr` (UMD): tersedia sebagai `require('lunr')`,
`window.lunr`, dst.

| Simbol | Keterangan |
|---|---|
| `lunr(config)` | Factory: `Builder` + pipeline default → `build()`. Dokumen **wajib** ditambahkan di dalam `config`. |
| `lunr.version` | Versi paket (`@VERSION` saat build). |
| `lunr.Builder` | `.ref(field)`, `.field(name, opts)`, `.add(doc, attrs)`, `.build()`, `.pipeline`, `.searchPipeline`, `.tokenizer`, `.b(n)`, `.k1(n)`, `.use(fn)`, `.metadataWhitelist`. |
| `lunr.Index` | `.search(qs)`, `.query(fn)`, `.toJSON()`, `Index.load(serialized)`, `.fields`, `.pipeline`. |
| `lunr.Pipeline` | `registerFunction`, `run`, `runString`, `before`, `after`, `remove`, `load`, `save`, `getRegisteredFunction`. |
| `lunr.Token` | `.toString()`, `.metadata`, `.update(fn)`, `.clone(fn)`. |
| `lunr.TokenSet` | `fromString`, `fromArray`, `fromClause`, `fromFuzzyString`, `intersect`, `toArray`, `toString`. |
| `lunr.Query` | `.term(str, opts)`, `.clause(clause)`, `.isNegated()`, `presence`, `wildcard`. |
| `lunr.QueryParser` / `lunr.QueryLexer` | Parsing bahasa kueri. |
| `lunr.QueryParseError` | Kesalahan parse kueri (`name`, `message`, `start`, `end`). |
| `lunr.trimmer` / `lunr.stopWordFilter` / `lunr.stemmer` | Fungsi pipeline default. |
| `lunr.idf` | Perhitungan inverse document frequency (dipakai builder & index). |
| `lunr.utils` | `warn`, `asString`, `clone`. |

### 8.1 Error yang dilempar (baru di fork ini)

| Kondisi | Error |
|---|---|
| `Builder.add(null/undefined)` | `"cannot add a undefined or null document to the index"` |
| dokumen tanpa field ref | `"cannot add a document without a '<ref>' field to the index"` |
| ref duplikat | `"cannot add a document with a duplicate ref '<ref>'"` |
| `build()` tanpa dokumen | `"cannot build index with no documents"` |
| serialisasi rusak saat `load` | `Error("malformed serialized index, ...")` — `fieldVectors`/`invertedIndex`/`fields`/`pipeline` harus array; tuple `[ref, elements]` & `[term, posting]` divalidasi |
| `FieldRef.fromString` tanpa joiner | `Error("malformed field ref string")` |
| `Vector.insert` duplikat | `Error("duplicate index")` |
| `TokenSet.toArray` berwildcard | `Error("cannot convert a TokenSet containing wildcards to an array")` |
| edit distance negatif | `QueryParseError("edit distance must be a non-negative integer")` |
| boost non-positif | `QueryParseError("boost must be a positive number")` |

---

## 9. Bahasa Kueri

| Sintaks | Arti |
|---|---|
| `foo` | term optional, di-stem |
| `foo bar` | OR antar term (dokumen dgn kedua term di-rank lebih tinggi) |
| `foo*`, `*oo*`, `f*o` | wildcard (pipeline nonaktif untuk term tsb) |
| `foo~2` | fuzzy, edit distance ≤ 2 |
| `foo^5`, `foo^1.5` | boost (harus positif; desimal didukung) |
| `title:foo` | scoping field |
| `+foo` / `-foo` | presence REQUIRED / PROHIBITED |
| `\~`, `\^`, `\:` dll. | escape karakter spesial |

Aturan parser:

- Term di-lowercase; token hasil pipeline dapat berekspansi menjadi banyak term.
- Field yang tidak terdaftar di index → `QueryParseError`
  `"unrecognised field '<f>', possible fields: ..."`.
- Edit distance non-negatif; boost positif (lihat §8.1).
- Presence REQUIRED pada term yang tidak ada di TokenSet → hasil kosong
  (early break).

---

## 10. Serialisasi & Kompatibilitas

### 10.1 Format `toJSON`

```
{
  version: "2.3.9",
  fields: [ "title", "body" ],
  fieldVectors: [ [ "field/docRef", [idx, val, ...] ], ... ],
  invertedIndex: [ [ "term", { _index: n, field: { ref: { meta: [...] } } } ], ... ],
  pipeline: [ "stemmer" ]
}
```

- `Index.load` memvalidasi bentuk dasar: `fieldVectors`, `invertedIndex`,
  `fields`, `pipeline` harus array; bentuk tuple tiap entri divalidasi
  sebelum diakses (bukan `TypeError` mentah).
- Peringatan `lunr.utils.warn` bila `version` berbeda dari
  `lunr.version` (tetap load, tidak throw).

### 10.2 Kompatibilitas versi

- Format serialisasi kompatibel dengan upstream `v2.3.9` (delta fork tidak
  mengubah bentuk `toJSON`/`load`).
- Hasil scoring dapat berbeda sangat kecil dari upstream hanya pada kasus
  posting dengan properti warisan (perilaku `idf` diperbaiki) — data normal
  identik.

---

## 11. Build & Packaging

Skrip build: `node build/build.js <target>` (cross-platform, tanpa shell Unix).

| Target | Hasil |
|---|---|
| `lunr.js` | Bundle dari `lib/` + wrapper |
| `lunr.min.js` | Minify `uglify-js` (compress + mangle) |
| `bower.json`/`package.json`/`component.json` | Dari template `build/*.json.template` |
| `size` | Ukuran gzip `lunr.min.js` (bytes) |
| `clean` | Hapus `lunr.js`, `lunr.min.js`, `docs/` |

- `npm run build` / `npm run minify` / `npm run docs` (jsdoc ke `docs/`).
- `Makefile` tetap ada namun `build.js` adalah jalur utama (Windows-compatible).

---

## 12. Pengujian

- **Framework**: `mocha` (TDD, `-u tdd`), runner `test/test_helper.js`.
- **Perintah**: `npm test` → `mocha test/*.js -u tdd -r test/test_helper.js -R dot -C`.
- **Status saat ini**: **540 test passing**.
- Cakupan: `builder`, `field_ref`, `idf`, `index`, `lunr` (factory),
  `match_data`, `pipeline`, `query`, `query_lexer`, `query_parser`,
  `query_parse_error`, `search`, `serialization`, `set`, `stemmer`,
  `stop_word_filter`, `token`, `tokenizer`, `token_set`, `trimmer`,
  `utils`, `vector`.
- Test baru di fork ini menambah: `idf` (empty posting, multi-field, `_index`
  diabaikan, inherited properties, df > N, monotonik), factory `lunr()`
  (Index instance, index fields, stem, stop-word), `QueryParseError`
  (properti, instance, `constructor` & `stack`), regresi `TokenSet.intersect`
  (DAG minimal × wildcard/fuzzy + search-level), `Index.load` rusak
  (pipeline & bentuk tuple), boost desimal (lexer + parser), dan trimmer
  `wordCharacters` (default non-ASCII + override).
- `npm run lint` → `eslint lib`.

---

## 13. Konstrain & Keputusan Desain

- **Tanpa runtime dependency** — hanya JS vanilla (UMD); aman dipakai via
  `<script>` maupun bundler.
- **`Object.create(null)`** untuk semua map yang di-iterasi (inverted index,
  field lengths, vektor, accumulator) — mencegah prototype pollution dan
  menjaga `idf`/looping konsisten.
- **Comparison ketat (`===`)** konsisten di seluruh `lib/` (dua pengecualian
  sengaja di `query.js` untuk koersi objek `String` wildcard).
- **Error eksplisit** menggantikan `throw string` / error samar (lihat §8.1).
- **NFC sebelum lowercase** — normalisasi dilakukan di tokenizer, bukan
  pipeline, agar konsisten untuk index & query.
- **`TokenSet.intersect` tanpa memoization lintas jalur** — trade-off: lebih
  banyak node output per jalur (bukan per pasangan node) namun sound untuk
  DAG minimal (wildcard/fuzzy); memoization lintas jalur terbukti tidak sound
  (lihat 3.2).
- **`Vector._magnitude` sentinel `undefined`** — cache tidak pernah menahan
  nilai `0` yang salah (vector kosong).
- **Kompatibilitas serialisasi dipertahankan** — delta fork tidak mengubah
  wire format `v2.3.9`.

---

## 14. Status & Item Terdefer

- **Selesai**: normalisasi NFC, validasi builder/index (termasuk `Index.load`
  dengan bentuk tuple & pipeline), perbaikan `TokenSet.intersect` (hapus
  memoization yang tidak sound, kembali ke semantik upstream), perbaikan
  `idf`, defensive copy `MatchData`, boost desimal (lexer `acceptDecimalRun`
  + parser `parseFloat`) & guard edit distance/boost, `QueryParseError`
  dengan `constructor` & `stack` yang benar, trimmer `wordCharacters`
  ter-wire, keamanan prototype, toolchain modern.
- **Item terdefer / tidak dilakukan**:
  - Perubahan wire format serialisasi (dihindari demi kompatibilitas).
  - Stemmer non-Inggris bawaan (didelegasikan ke `lunr-languages`).
  - Perubahan API publik yang breaking.
  - Memoization ulang `TokenSet.intersect` (perlu desain yang sound — lihat 3.2).
- **Catatan integrasi**: untuk Bahasa Indonesia gunakan plugin `lunr.id`
  dari [lunr-languages](../lunr-languages) bersama fork ini.
