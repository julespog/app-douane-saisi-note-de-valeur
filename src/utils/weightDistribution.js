export const distributeTotals = (articlesList, infos, valeurs) => {
  if (!articlesList || articlesList.length === 0) return articlesList;
  if (infos?.modePoids === 'manuel') return articlesList;
  
  const parseLocal = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/\s/g, '').replace(',', '.')) || 0;
  };

  const totalFacture = parseLocal(valeurs?.vFacture) || articlesList.reduce((sum, a) => sum + parseLocal(a.valeur), 0);
  const totalPBrut = Math.round(parseLocal(infos?.poidsBrut));
  const totalPNet = Math.round(parseLocal(infos?.poidsNet));
  
  if (totalFacture <= 0) return articlesList;

  let newArticles = articlesList.map(a => {
    const vFob = parseLocal(a.valeur);
    let pB = Math.max(1, Math.round(vFob * (totalPBrut / totalFacture)));
    let pN = Math.max(1, Math.round(vFob * (totalPNet / totalFacture)));
    return { ...a, pBrut: pB.toString(), pNet: pN.toString() };
  });

  const balanceWeights = (field, targetTotal) => {
    if (targetTotal <= 0) return;
    let currentSum = newArticles.reduce((sum, a) => sum + parseInt(a[field] || '0', 10), 0);
    let diff = targetTotal - currentSum;
    
    if (diff !== 0) {
      const sortedIndices = newArticles
        .map((a, idx) => ({ idx, val: parseLocal(a.valeur) }))
        .sort((a, b) => b.val - a.val)
        .map(item => item.idx);
        
      if (diff > 0) {
        if (sortedIndices.length > 0) {
          const biggestIdx = sortedIndices[0];
          newArticles[biggestIdx][field] = (parseInt(newArticles[biggestIdx][field], 10) + diff).toString();
        }
      } else if (diff < 0) {
        let amountToRemove = Math.abs(diff);
        let i = 0;
        let safetyCounter = 0;
        while (amountToRemove > 0 && safetyCounter < 10000) {
          safetyCounter++;
          const idx = sortedIndices[i % sortedIndices.length];
          if (parseInt(newArticles[idx][field], 10) > 1) {
            newArticles[idx][field] = (parseInt(newArticles[idx][field], 10) - 1).toString();
            amountToRemove--;
          }
          i++;
        }
      }
    }
  };

  const currentFobSum = articlesList.reduce((sum, a) => sum + parseLocal(a.valeur), 0);
  const shouldBalance = Math.abs(currentFobSum - totalFacture) <= 1;

  if (shouldBalance) {
    balanceWeights('pBrut', totalPBrut);
    balanceWeights('pNet', totalPNet);
  }

  return newArticles;
};
