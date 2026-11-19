# Gnamatech — Claude Code & Cloud Code Context

## Project Overview
Gnamatech is a customs pricing, tariff classification (via Gemini & Groq AI), and detail note generation platform for the CEMAC customs zone. It runs as both a web application (hosted on a VPS via Nginx) and a native offline-capable Windows desktop application (Tauri v2).

## Tech Stack
- Frontend: React 19, Vite 8, React Router v7, Lucide Icons, Vite-PWA
- Desktop: Tauri v2 (Rust backend, WebView2 on Windows)
- Backend & DB: Self-hosted Supabase (PostgreSQL 15, Storage buckets `documents` & `logos`) on Ubuntu VPS
- AI Engines: Google Gemini API (gemini-2.5-pro / flash) and Groq API
- Documentation: 665+ official CEMAC PDF documents viewed via embedded Mozilla PDF.js (/public/pdfjs/)

## Common Commands
- `npm run dev`: Start local development server on http://localhost:5173
- `npm run build`: Production frontend build into `dist/`
- `npm test` / `npm run lint`: Linting with ESLint

## Deployment
- Web Server: Ubuntu VPS at `102.208.104.198` (ST Digital), web root `/var/www/html/`
  Deploy command:
  `npm run build && scp dist/index.html dist/manifest_docs.json dist/manifest.webmanifest dist/registerSW.js dist/sw.js root@102.208.104.198:/var/www/html/ && scp -r dist/assets root@102.208.104.198:/var/www/html/`
- Windows App: Automatically built via GitHub Actions (`.github/workflows/build-windows.yml`) upon push or workflow_dispatch. Outputs installer to `/var/www/html/downloads/Gnamatech_Setup.exe`.

## Key Architecture & Constraints
1. **Unicode NFC Normalization**: All filenames in `public/manifest_docs.json` MUST be normalized to NFC format (`str.normalize('NFC')`). macOS uses decomposed NFD which breaks Windows NTFS lookups.
2. **Safe URL Encoding**: Never use raw `encodeURI()` for documentation paths containing `+`, `%`, `'` or spaces. Use `safeEncodePath()` from `src/components/CustomPDFViewer.jsx`.
3. **Tauri Windows Networking**: Use `customFetch` in `src/supabaseClient.js` for Supabase requests so `@tauri-apps/plugin-http` handles native Windows networking in Tauri.
4. **Offline Capability**: Core customs calculations and document viewing MUST function completely offline without an internet connection.
