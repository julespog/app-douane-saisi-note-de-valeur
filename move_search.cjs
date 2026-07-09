const fs = require('fs');
let content = fs.readFileSync('src/pages/NoteForm.jsx', 'utf-8');

const startTag = "      {/* BARRE DE RECHERCHE D'ARTICLES */}";
const endTag = "      {/* ZONE HAUTE : INFOS & VALEURS (75% / 25%) */}";
const targetTag = "      {/* ZONE BASSE : TABLEAU DES ARTICLES (100% de la largeur) */}";

const startIdx = content.indexOf(startTag);
const endIdx = content.indexOf(endTag);

if (startIdx !== -1 && endIdx !== -1) {
  const searchBar = content.substring(startIdx, endIdx);
  
  // remove search bar from current position
  content = content.substring(0, startIdx) + content.substring(endIdx);
  
  // Find target in the new content
  const newTargetIdx = content.indexOf(targetTag);
  
  if (newTargetIdx !== -1) {
    // insert search bar before target
    content = content.substring(0, newTargetIdx) + searchBar + content.substring(newTargetIdx);
    fs.writeFileSync('src/pages/NoteForm.jsx', content);
    console.log("Moved search bar successfully");
  } else {
    console.log("Target tag not found");
  }
} else {
  console.log("Start/End tags not found");
}
