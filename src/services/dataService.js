/**
 * Service de Données (Mocks & Préparation)
 * 
 * Ce fichier prépare l'architecture pour l'intégration future des fichiers PDF et Excel
 * (Code des douanes, Règlementation, Tarif des douanes, Notes explicatives).
 * 
 * Dans la version finale Desktop (Offline-ready), ces fonctions liront depuis IndexedDB
 * ou le FileSystem local après importation des fichiers par l'Administrateur.
 */

// Simulation d'une base de données locale (IndexedDB/LocalStorage)
const localDatabase = {
  tarifs: [],
  notesExplicatives: {},
  reglementation: []
};

/**
 * Fonction pour rechercher le taux de douane d'un Code SH spécifique
 * Sera connectée au parseur Excel du "Tarif des douanes"
 */
export const fetchTauxDouane = async (codeSH) => {
  console.log(`Recherche du tarif pour le code : ${codeSH}`);
  // TODO: Remplacer par la vraie logique de recherche
  // Mock: Retourne un taux aléatoire entre 5% et 30%
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.floor(Math.random() * 25) + 5);
    }, 300);
  });
};

/**
 * Fonction pour récupérer la note explicative d'une position tarifaire
 * Sera connectée au parseur PDF "Notes explicatives"
 */
export const fetchNoteExplicative = async (codeSH) => {
  console.log(`Recherche de la note pour : ${codeSH}`);
  // TODO: Remplacer par la vraie logique
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("Cette position comprend les articles non spécifiés ailleurs...");
    }, 300);
  });
};

/**
 * Fonction d'importation globale (réservée à l'Admin)
 * Permettra de charger les fichiers Excel/PDF fournis par l'utilisateur
 */
export const importerFichiersReference = async (files) => {
  console.log("Importation des fichiers :", files);
  // Logique future :
  // 1. Lire files[0] (ex: Excel Tarifs) avec une librairie comme xlsx
  // 2. Parser les données
  // 3. Sauvegarder dans localDatabase / IndexedDB
  return { success: true, message: "Fichiers importés et base de données locale mise à jour." };
};
