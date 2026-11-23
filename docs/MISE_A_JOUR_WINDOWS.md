# Mise à jour de l'application Windows (Tauri)

Procédure pour publier une nouvelle version de l'application Windows Gnamatech
après des mises à jour de la version web.

> Exemple utilisé ci-dessous : passage de **1.0.0** à **1.0.1** (novembre 2026).
> Pour les versions suivantes, remplacer `1.0.1` par le nouveau numéro.

## Contexte

- L'application Windows (Tauri v2) **embarque une copie du frontend** au moment de la
  compilation (`src-tauri/tauri.conf.json` → `frontendDist: ../dist`). Elle ne recharge
  pas le code depuis gnamatech.com.
- Elle **ne se met pas à jour toute seule** : aucun module « updater » n'est configuré.
  Chaque poste doit télécharger et réinstaller la nouvelle version.
- Ce qui passe par le serveur fonctionne sans recompiler : données Supabase (notes,
  entreprises, documents importés), service IA (`/api/ai`) et ses réglages serveur.
- Ce qui est dans le code embarqué nécessite une recompilation : écrans, listes
  déroulantes, prompt IA (construit côté application), mise en page, impression.

### Contenu de la version 1.0.1

Installateurs précédents : 19/11/2026 11:55 (version 1.0.0). Commits inclus, tous sur `main` :

| Commit | Auteur | Changement |
|---|---|---|
| `122e748` | julespog | Affichage des PDF (web et desktop) |
| `1682ebb` | Joe | Documents supprimés par l'admin qui restaient visibles chez les utilisateurs |
| `61890fb` | Joe | Aperçu PDF des documents importés par l'admin |
| `80e38e0`, `0469f89`, `5a17aba` | Joe | Recherche IA : règles de classification, fiche « Imprimer l'analyse » complète, prompt d'expert |
| `8c2ad63`, `7171a34`, `21711cc` | julespog | Recherche IA : bascule Claude, extraction du texte, sections retirées |
| `2165d0f` | Joe | Liste déroulante des codes additionnels (marchandises) |
| `02a22d4` | Joe | Listes Mode d'opération / Régime étendu, Code Add automatique |
| `2c8bfd1` | Joe | Code Add multiple (4 max), section Devise de règlement sur une ligne |

## Étapes

### 1. Se mettre à jour

```bash
git checkout main && git pull --ff-only
```

Vérifier que le dernier commit est bien le plus récent attendu (`git log --oneline -1`).

### 2. Vérifier que le build passe en local

```bash
npm install && npm run build
```

Le build doit se terminer sans erreur.

### 3. Changer le numéro de version (aux deux endroits)

- `src-tauri/tauri.conf.json` : `"version": "1.0.1"`
- `src-tauri/Cargo.toml` : `version = "1.0.1"`

```bash
git commit -am "chore(windows): version 1.0.1" && git push origin main
```

### 4. Compiler l'installateur sur GitHub

GitHub → onglet **Actions** → **Build Gnamatech Windows Executable** → **Run workflow**
(branche `main`). Durée : environ 14 minutes.

Le workflow (`.github/workflows/build-windows.yml`) publie :
- une **Release** « Gnamatech v1.0.1 » (tag `v1.0.1`) ;
- un **artefact** « Gnamatech-Windows-Installer » (`.exe` NSIS + `.msi`).

Le workflow se déclenche aussi sur un tag `v*` poussé, mais **pas** sur un simple push sur `main`.
En cas d'échec, lire le journal de l'étape « Build Tauri Windows App ».

### 5. Mettre les installateurs sur le VPS

Le workflow **ne copie pas** les fichiers sur le serveur : à faire à la main.

1. Télécharger l'artefact (ou les fichiers de la Release v1.0.1).
2. Sur le VPS, sauvegarder d'abord les anciens installateurs :

   ```bash
   mkdir -p /root/backups/downloads-1.0.0
   cp -p /var/www/html/downloads/* /root/backups/downloads-1.0.0/
   ```

3. Copier les nouveaux fichiers dans `/var/www/html/downloads/` :
   - `Gnamatech_Setup.exe` : copie de `Gnamatech_1.0.1_x64-setup.exe`
     (nom utilisé par le bouton « App Windows (.exe) » du site) ;
   - `Gnamatech_Setup.msi` : copie de `Gnamatech_1.0.1_x64_en-US.msi` ;
   - garder aussi les fichiers versionnés `Gnamatech_1.0.1_x64-setup.exe` et
     `Gnamatech_1.0.1_x64_en-US.msi`.

   Les fichiers 1.0.0 peuvent être supprimés de `downloads/` : ils sont sauvegardés.

### 6. Vérifier

- `https://gnamatech.com/downloads/Gnamatech_Setup.exe` se télécharge, avec la nouvelle
  taille et la nouvelle date.
- Installer sur un poste Windows et contrôler :
  - la version affichée est 1.0.1 ;
  - l'aperçu des PDF importés par l'admin s'affiche ;
  - un clic sur « Code additionnel » (ajout de marchandise) ouvre la liste des codes ;
  - les champs Mode d'opération / Régime étendu / Code Add sont dans « Devise de règlement » ;
  - la recherche IA fonctionne et « Imprimer l'analyse » sort la fiche complète ;
  - le mode hors-ligne fonctionne (calculs des droits et PDF locaux sans internet).

### 7. Prévenir les utilisateurs Windows

Ils doivent **télécharger et réinstaller** l'application : il n'y a pas de mise à jour automatique.

## Règles à respecter

- Toujours faire `git pull` avant `npm run build`, pour le web comme pour Windows :
  sinon on écrase les mises à jour de l'autre développeur.
- Se prévenir avant de publier une version (web ou Windows).
- Garder le wrapper `customFetch` (`src/supabaseClient.js`), la normalisation Unicode NFC
  et `safeEncodePath()` (voir `CLAUDE.md`).

## Pour la suite

Ajouter le plugin **updater** de Tauri pour que l'application propose elle-même les
nouvelles versions, et automatiser dans le workflow la copie des installateurs sur le VPS.
