# 📘 Guide Développeur & Architecture — Gnamatech CEMAC

Bienvenue sur le projet **Gnamatech** (Système d'assistance au classement tarifaire, tarification douanière et génération de notes de détail pour la zone CEMAC).

Ce document contient toutes les instructions pour configurer votre environnement, développer de nouvelles fonctionnalités, comprendre l'architecture et déployer les mises à jour.

---

## 1. 🛠️ Stack Technique

* **Frontend Web** : React 19, Vite 8, React Router v7, Lucide Icons, Vite-PWA.
* **Application Desktop Windows** : Tauri v2 (Rust) produisant des installateurs `.exe` (NSIS) et `.msi`.
* **Backend & Données** : Supabase self-hosted (PostgreSQL 15, GoTrue Auth, Storage) déployé sous Docker sur VPS ST Digital.
* **Moteurs d'IA** : Google Gemini API (gemini-2.5-pro / flash) et Groq API pour le classement tarifaire automatique.
* **Moteur Documentaire** : Catalogue de 665+ documents douaniers avec lecteur PDF embarqué Mozilla PDF.js (100% hors-ligne).

---

## 2. 🚀 Prise en main & Installation Locale

### Prérequis
* **Node.js** : Version 20+ ou 22 recommandée
* **Git** configuré avec vos identifiants GitHub

### A. Cloner le dépôt
Assurez-vous que l'administrateur vous a ajouté comme collaborateur sur le dépôt GitHub :
```bash
git clone https://github.com/julespog/app-douane-saisi-note-de-valeur.git
cd app-douane-saisi-note-de-valeur
```

### B. Installer les dépendances
```bash
npm install
```

### C. Fichier d'environnement `.env`
Créez un fichier `.env` à la racine du projet avec les clés suivantes :
```env
VITE_GROQ_API_KEY=votre_cle_groq_ici
VITE_GEMINI_API_KEY=votre_cle_gemini_ici
```

> **Note Supabase** : L'URL de production (`https://gnamatech.com`) et la clé anonyme publique sont préconfigurées dans `src/supabaseClient.js`.

### D. Lancer le serveur de développement
```bash
npm run dev
```
L'application démarre sur `http://localhost:5173`.

---

## 3. 📂 Structure du Projet & Rôles des Fichiers

```text
├── public/
│   ├── DOCUMENTATION S DOUANE/   # 665+ fichiers PDF douaniers officiels CEMAC
│   ├── manifest_docs.json        # Catalogue hiérarchique normalisé en NFC
│   └── pdfjs/                    # Moteur de rendu PDF Mozilla officiel (hors-ligne)
├── src/
│   ├── components/
│   │   ├── CustomPDFViewer.jsx   # Visualiseur PDF multiplateforme (safeEncodePath + PDF.js)
│   │   ├── Header.jsx            # En-tête, statut d'abonnement, bouton téléchargement Windows
│   │   └── ...
│   ├── context/
│   │   ├── UserContext.jsx       # Auth Supabase, session, gestion multi-entreprises, cache offline
│   │   └── ...
│   ├── pages/
│   │   ├── NoteForm.jsx          # Cœur : Saisie note de détail, recherche IA, bouton impression fiche IA
│   │   ├── PrintNote.jsx         # Rendu officiel imprimable / PDF de la note de détail
│   │   ├── Documentation.jsx     # Explorateur documentaire (fichiers locaux + custom docs Supabase)
│   │   ├── Dashboard.jsx         # Superadmin : Gestion entreprises, déclarants, téléversement doc
│   │   └── ...
│   ├── supabaseClient.js         # Client Supabase avec wrapper réseau customFetch pour Tauri
├── src-tauri/                    # Configuration Tauri v2 pour le build desktop Windows
└── .github/workflows/
    └── build-windows.yml         # CI/CD GitHub Actions pour compiler l'installateur Windows (.exe / .msi)
```

---

## 4. 🔄 Workflow de Travail & Git

Avant de travailler :
```bash
git pull origin main
```

Pour enregistrer vos modifications :
```bash
git add .
git commit -m "feat/fix: description claire du changement"
git push origin main
```

---

## 5. 🌐 Déploiement en Production

### A. Déploiement de la Version Web (`gnamatech.com`)
Le serveur de production est un VPS Ubuntu chez ST Digital.
* **IP VPS** : `102.208.104.198`
* **Utilisateur** : `root`
* **Dossier Web** : `/var/www/html/`

**Étapes de déploiement web :**
1. Compiler le frontend en local :
   ```bash
   npm run build
   ```
2. Transférer les fichiers mis à jour vers le serveur :
   ```bash
   # Copier les fichiers principaux
   scp dist/index.html dist/manifest_docs.json dist/manifest.webmanifest dist/registerSW.js dist/sw.js root@102.208.104.198:/var/www/html/
   
   # Copier les assets générés
   scp -r dist/assets root@102.208.104.198:/var/www/html/
   ```

### B. Déploiement de l'Application Desktop Windows
**Vous n'avez pas besoin d'installer Rust ou un environnement Windows sur votre machine.**
La compilation Windows s'effectue automatiquement dans le cloud via GitHub Actions :
1. Sur GitHub, ouvrez l'onglet **Actions**.
2. Sélectionnez le workflow **Build Gnamatech Windows Executable**.
3. Cliquez sur **Run workflow** sur la branche `main`.
4. Après environ 14 minutes, le setup Windows est généré dans les artefacts et copié sur le VPS dans `/var/www/html/downloads/` (`Gnamatech_Setup.exe` et `Gnamatech_Setup.msi`).

---

## 6. ⚠️ Règles d'Or & Bonnes Pratiques

1. **Normalisation Unicode (NFC obligatoire)** :
   * Les noms de fichiers PDF et les URLs dans `manifest_docs.json` doivent **toujours** être normalisés en `NFC` (`.normalize('NFC')`). Sur macOS, `fs.readdir` produit du `NFD` décomposé qui provoque des erreurs 404 sur Windows NTFS.
2. **Encodage d'URL sécurisé (`safeEncodePath`)** :
   * Ne jamais utiliser `encodeURI()` brut pour les chemins de documents contenant des `+`, `%`, apostrophes ou espaces. Toujours importer et utiliser `safeEncodePath` depuis `CustomPDFViewer.jsx`.
3. **Compatibilité Hors-ligne** :
   * L'application Windows et le web doivent pouvoir fonctionner sans internet pour les calculs de liquidation et la consultation de la documentation. Tout visualiseur PDF doit reposer sur `/pdfjs/` local.
4. **Réseau Tauri Windows** :
   * Les requêtes fetch dans l'application Windows passent par le wrapper `customFetch` dans `src/supabaseClient.js` utilisant `@tauri-apps/plugin-http` pour éviter les blocages de sécurité WebView2.
