/**
 * Algorithme de regroupement des positions tarifaires.
 * Le cahier des charges impose un maximum de 25 positions par note.
 */

// Helper pour extraire le chapitre (2 premiers chiffres)
const getChapitre = (codeSH) => (codeSH && codeSH.length >= 2 ? codeSH.substring(0, 2) : codeSH);

// Helper pour extraire la position (4 premiers chiffres)
const getPosition = (codeSH) => (codeSH && codeSH.length >= 4 ? codeSH.substring(0, 4) : codeSH);

// Fonction générique de fusion d'articles
const mergeArticles = (articles, groupingKeyFn) => {
  const grouped = {};
  
  articles.forEach(article => {
    const key = groupingKeyFn(article);
      if (!grouped[key]) {
        grouped[key] = {
          ...article,
          // On concatène les descriptions pour garder une trace
          description: article.description,
          quantite: parseFloat(article.quantite) || 0,
          pBrut: parseFloat(article.pBrut) || 0,
          pNet: parseFloat(article.pNet) || 0,
          colis: parseInt(article.colis || '0', 10) || 0,
          codeAdditionnel: article.codeAdditionnel || '000',
          valeurImposable: parseFloat(article.valeurImposable) || 0,
          valeur: parseFloat(article.valeur) || 0,
          originalIds: [article.id],
          originalArticles: [article]
        };
      } else {
        grouped[key].description += ' + ' + article.description;
        grouped[key].quantite += parseFloat(article.quantite) || 0;
        grouped[key].pBrut += parseFloat(article.pBrut) || 0;
        grouped[key].pNet += parseFloat(article.pNet) || 0;
        grouped[key].colis += parseInt(article.colis || '0', 10) || 0;
        grouped[key].valeurImposable += parseFloat(article.valeurImposable) || 0;
        grouped[key].valeur += parseFloat(article.valeur) || 0;
        if (article.id) grouped[key].originalIds.push(article.id);
        grouped[key].originalArticles.push(article);
        // Pour les prix unitaires, fret, assurance, ça devient des moyennes pondérées ou on les ignore dans le résumé
      }
  });

  // Appliquer la règle de rétention : on garde le plus petit Code SH parmi les fusionnés
  return Object.values(grouped).map(group => {
    if (group.originalArticles && group.originalArticles.length > 1) {
      // Trier par codeSH décroissant (plus grand code en premier)
      const sorted = [...group.originalArticles].sort((a, b) => String(b.codeSH).localeCompare(String(a.codeSH)));
      // On remplace le codeSH et l'intitulé par ceux du plus petit code
      group.codeSH = sorted[0].codeSH;
      group.intitule = sorted[0].intitule;
      group.codeAdditionnel = sorted[0].codeAdditionnel || '000';
    }
    
    // Arrondir les poids (Brut et Net) à l'entier le plus proche
    group.pBrut = Math.round(group.pBrut);
    group.pNet = Math.round(group.pNet);
    
    // Arrondir les valeurs monétaires pour éviter les bugs d'affichage (ex: 1420.67999999)
    group.valeur = Number(group.valeur.toFixed(2));
    group.valeurImposable = Math.round(group.valeurImposable);

    delete group.originalArticles;
    return group;
  });
};

export const applyGroupingLogic = (articles) => {
  // Niveau 1 (Toujours appliqué) : Fusion stricte (Code SH exact, origine, taux)
  let level1Articles = mergeArticles(articles, (a) => `${a.codeSH}-${a.origine}-${a.tauxDouane}`);
  
  if (level1Articles.length <= 25) {
    return { 
      articles: level1Articles, 
      level: 1, 
      message: "Regroupement de Niveau 1 appliqué (Même Sous-position, Origine, Taux)." 
    };
  }

  // Niveau 2 : Regroupement par Position (4 premiers chiffres), origine, taux
  let level2Articles = mergeArticles(articles, (a) => `${getPosition(a.codeSH)}-${a.origine}-${a.tauxDouane}`);

  if (level2Articles.length <= 25) {
    return { 
      articles: level2Articles, 
      level: 2, 
      message: "Regroupement de Niveau 2 appliqué (Même Chapitre, Origine, Taux)." 
    };
  }

  // Niveau 3 : Regroupement par Chapitre (2 premiers chiffres), origine, taux
  // Note: votre document précise "même chapitre, même origine, même taux" pour le Niveau 3
  let level3Articles = mergeArticles(articles, (a) => `${getChapitre(a.codeSH)}-${a.origine}-${a.tauxDouane}`);

  if (level3Articles.length <= 25) {
    return { 
      articles: level3Articles, 
      level: 3, 
      message: "Regroupement de Niveau 3 appliqué (Même Chapitre, Origine, Taux)." 
    };
  }

  // Niveau 4 (Dernier recours) : Regroupement par Chapitre et Taux (On IGNORE l'origine)
  let level4Articles = mergeArticles(articles, (a) => `${getChapitre(a.codeSH)}-IGNORE_ORIGIN-${a.tauxDouane}`);
  
  // Pour le niveau 4, puisqu'on ignore l'origine pour fusionner, on marque l'origine affichée
  // comme "Multiples" si la fusion a réellement mixé des origines, ou on garde celle du plus grand code SH.
  level4Articles = level4Articles.map(group => {
    if (group.originalIds && group.originalIds.length > 1) {
      const origines = [...new Set(group.originalArticles?.map(a => a.origine) || [])].filter(Boolean);
      if (origines.length > 1) {
        group.origine = "Multiples"; // Indiquer que plusieurs origines ont été mixées
      }
    }
    return group;
  });

  return { 
    articles: level4Articles, 
    level: 4, 
    message: "Regroupement de Niveau 4 appliqué (Même Chapitre, Taux - Origine ignorée)." 
  };
};
