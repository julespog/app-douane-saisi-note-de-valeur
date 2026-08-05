import React from 'react';
import { COUNTRY_CODES } from '../utils/countries';

const formatWithDots = (val) => {
  if (val === null || val === undefined || val === '') return '';
  return Number(val).toLocaleString('fr-FR').replace(/\s/g, '.');
};

const NoteDocument = ({ articles = [], infos = {}, valeurs = {}, company = null, isPreview = false, level = 0 }) => {
  const pages = [];
  if (articles.length > 0) {
    pages.push({ isFirstPage: true, chunk: articles.slice(0, 5) });
    const remaining = articles.slice(5);
    for (let i = 0; i < remaining.length; i += 12) {
      const pageArticles = remaining.slice(i, i + 12);
      const tables = [];
      for (let j = 0; j < pageArticles.length; j += 6) {
        tables.push(pageArticles.slice(j, j + 6));
      }
      pages.push({ isFirstPage: false, tables });
    }
  }

  const currentDate = new Date().toLocaleDateString('fr-FR');
  const docNumber = infos.noDossier || 'XXXXXX';

  if (articles.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Aucun article à afficher</div>;
  }

  const tableBorderStyle = '1px solid #cbd5e1';
  const thStyle = { border: tableBorderStyle, padding: '2px 4px', textAlign: 'center', backgroundColor: '#e0f2fe', color: '#0c4a6e', fontWeight: 'bold' };
  const tdStyle = { border: tableBorderStyle, padding: '2px 4px', textAlign: 'center', color: '#1e293b' };
  const darkThStyle = { border: tableBorderStyle, padding: '2px 4px', backgroundColor: '#0c4a6e', color: 'white', fontWeight: 'bold', textAlign: 'left', textTransform: 'uppercase' };
  const darkTdStyle = { border: tableBorderStyle, padding: '2px 4px', backgroundColor: '#f0f9ff', color: '#0c4a6e', fontWeight: 'bold', textAlign: 'left' };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: 'black',
      backgroundColor: 'white',
      paddingTop: isPreview ? '0' : '20px',
      paddingLeft: isPreview ? '0' : '20px',
      paddingRight: isPreview ? '0' : '20px',
      paddingBottom: '0', // NEVER pad the bottom, to prevent invisible spillovers onto a new page!
      margin: '0 auto',
      width: '100%',
      maxWidth: '1000px', // Largeur Paysage (Landscape)
    }}>
      {pages.map((page, pageIndex) => {
        const chunk = page.chunk; // Uniquement pour la première page
        const isLastPage = pageIndex === pages.length - 1;
        return (
        <React.Fragment key={pageIndex}>
          {pageIndex > 0 && <div className="html2pdf__page-break force-page-break"></div>}
          <div className="print-padding native-padding-bottom" style={{ 
            marginBottom: isLastPage ? '0' : '20px'
          }}>
            {page.isFirstPage ? (
            /* --- PAGE 1: NOUVEAU DESIGN OFFICIEL (BLEU) --- */
            <>
              {/* EN-TÊTE PAGE 1 */}
              <div style={{ textAlign: 'center', marginBottom: '20px', position: 'relative' }}>
                {company && (
                  <div style={{ position: 'absolute', top: '0', left: '0', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '250px' }}>
                    {company.logo && <img src={company.logo} alt="Logo" style={{ height: '45px', objectFit: 'contain' }} />}
                    <div style={{ fontSize: '9px', lineHeight: '1.3', color: '#475569' }}>
                      {!company.logo && <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a', marginBottom: '2px' }}>{company.name}</div>}
                      {company.legalInfo?.nif && <div>NIF: {company.legalInfo.nif}</div>}
                      {company.legalInfo?.rccm && <div>RCCM: {company.legalInfo.rccm}</div>}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  {/* Décoration gauche */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '60px', height: '2px', backgroundColor: '#0c4a6e' }}></div>
                    <div style={{ width: '0', height: '0', borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '8px solid #0c4a6e' }}></div>
                  </div>
                  
                  <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '1px' }}>NOTE DE DETAIL DOUANE</h1>
                  
                  {/* Décoration droite */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '0', height: '0', borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderRight: '8px solid #0c4a6e' }}></div>
                    <div style={{ width: '60px', height: '2px', backgroundColor: '#0c4a6e' }}></div>
                  </div>
                </div>
                {/* Petit losange central en dessous */}
                <div style={{ width: '8px', height: '8px', backgroundColor: '#0c4a6e', transform: 'rotate(45deg)', margin: '5px auto 0' }}></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr', gap: '10px', marginBottom: '15px' }}>
                {/* Colonne 1: Dossier */}
                <div style={{ lineHeight: '1.8', fontWeight: 'bold' }}>
                  <div style={{ display: 'flex' }}><div style={{ width: '130px' }}>No de Dossier:</div> <span style={{ fontWeight: 'normal' }}>{infos.noDossier}</span></div>
                  <div style={{ display: 'flex' }}><div style={{ width: '130px' }}>No CDE:</div> <span style={{ fontWeight: 'normal' }}>{infos.noCDEMarque}</span></div>
                  <div style={{ display: 'flex' }}><div style={{ width: '130px' }}>No ST Regevable:</div> <span style={{ fontWeight: 'normal' }}>{infos.noSTRedevable}</span></div>
                  <div style={{ display: 'flex' }}><div style={{ width: '130px' }}>No ST Destination:</div> <span style={{ fontWeight: 'normal' }}>{infos.noSTDestination}</span></div>
                </div>

                {/* Colonne 2: LTA / Poids */}
                <div style={{ border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', flex: 1 }}>
                    <div style={{ flex: 1, padding: '8px', borderRight: '1px solid #cbd5e1', fontWeight: 'bold' }}>No LTA:<br/><span style={{ fontWeight: 'normal' }}>{infos.valLTA_CNT}</span></div>
                    <div style={{ flex: 2, padding: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{infos.typeLieu || 'Provenance'}: <span style={{ fontWeight: 'normal', marginLeft: '5px' }}>{COUNTRY_CODES[infos.provenance] || (infos.provenance ? infos.provenance.substring(0, 2).toUpperCase() : '')}</span></div>
                  </div>
                  <div style={{ display: 'flex', padding: '6px 8px', fontWeight: 'bold', fontSize: '0.8rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ whiteSpace: 'nowrap' }}>Incoterm. <span style={{ fontWeight: 'normal' }}>{infos.incoterm}</span></div>
                    <div style={{ whiteSpace: 'nowrap' }}>Colis. <span style={{ fontWeight: 'normal' }}>{infos.nombreNatureColis}</span></div>
                    <div style={{ whiteSpace: 'nowrap' }}>Poids brut. <span style={{ fontWeight: 'normal' }}>{infos.poidsBrut}</span></div>
                    <div style={{ whiteSpace: 'nowrap' }}>Poids net. <span style={{ fontWeight: 'normal' }}>{infos.poidsNet}</span></div>
                  </div>
                </div>

                {/* Colonne 3: OT / Repertoire */}
                <div style={{ border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', fontWeight: 'bold', flex: 1 }}>
                    <div style={{ width: '100px' }}>No OT</div><span style={{ fontWeight: 'normal' }}>{infos.noOT}</span>
                  </div>
                  <div style={{ display: 'flex', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', fontWeight: 'bold', flex: 1 }}>
                    <div style={{ width: '100px' }}>No Repertoire:</div><span style={{ fontWeight: 'normal' }}>{infos.noRepertoire}</span>
                  </div>
                  <div style={{ display: 'flex', padding: '4px 8px', fontWeight: 'bold', flex: 1, backgroundColor: '#f1f5f9' }}>
                    <div style={{ width: '100px' }}>Vol</div><span style={{ fontWeight: 'normal' }}>{infos.noVolOuVol}</span>
                  </div>
                </div>
              </div>

              {/* TABLEAU PAGE 1 */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', textAlign: 'center', pageBreakInside: 'avoid' }}>
                <tbody>
                  {/* Ligne 1 */}
                  <tr>
                    <td style={{ ...darkThStyle, width: '20%' }}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Devise de règlement:</span> <span>{infos.devise}</span></div>
                    </td>
                    <td style={{ ...darkThStyle, width: '16%', textAlign: 'center' }}>NOMENCLATURE<br/>TARIFAIRE</td>
                    {[...Array(5)].map((_, i) => (
                      <td key={i} style={{ ...darkThStyle, width: '12.8%', textAlign: 'center' }}>{chunk[i] ? `Article 0${i+1}` : ''}</td>
                    ))}
                  </tr>
                  {/* Ligne 2 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Mode de Règlement:</span> <span>{infos.modeReglement}</span></div>
                    </td>
                    <td style={thStyle}>Code SH</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={{...tdStyle, fontWeight: 'bold'}}>{chunk[i] ? String(chunk[i].codeSH).padEnd(8, '0').substring(0, 8) : ''}</td>)}
                  </tr>
                  {/* Ligne 3 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Type d'opération:</span> <span>{infos.typeOperation}</span></div>
                    </td>
                    <td style={{...thStyle, backgroundColor: '#f0f9ff', color: '#0c4a6e'}}>Code additionnel</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={{...tdStyle, fontWeight: 'bold'}}>{chunk[i] ? (chunk[i].codeAdditionnel || '000') : ''}</td>)}
                  </tr>
                  {/* Ligne 4 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Mode de Taxation:</span> <span>{infos.modeTaxation}</span></div>
                    </td>
                    <td style={thStyle}>Unité Supp</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={{...tdStyle, fontWeight: 'bold'}}>{chunk[i] ? chunk[i].unite : ''}</td>)}
                  </tr>
                  {/* Ligne 5 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Mode de Transport:</span> <span>{infos.modeTransport}</span></div>
                    </td>
                    <td style={thStyle}>Quantité</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={{...tdStyle, fontWeight: 'bold'}}>{chunk[i] ? chunk[i].quantite : ''}</td>)}
                  </tr>
                  {/* Ligne 6 */}
                  <tr>
                    <td style={{ ...darkThStyle }}>NOTE DE VALEURS:</td>
                    <td style={thStyle}>Nombre de colis</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={{...tdStyle, fontWeight: 'bold'}}>{chunk[i] ? chunk[i].colis : ''}</td>)}
                  </tr>
                  {/* Ligne 7 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>V.FACTURE:</span> <span>{formatWithDots(valeurs.vFacture)}</span></div>
                    </td>
                    <td style={thStyle}>{infos.typeLieu || 'Provenance'}</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={{...tdStyle, fontWeight: 'bold'}}>{chunk[i] ? (COUNTRY_CODES[infos.provenance] || infos.provenance.substring(0, 2).toUpperCase()) : ''}</td>)}
                  </tr>
                  {/* Ligne 8 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>V.FRET:</span> <span>{formatWithDots(valeurs.vFret)} {valeurs.vFretDevise || ''}</span></div>
                    </td>
                    <td style={thStyle}>Origine</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={{...tdStyle, fontWeight: 'bold'}}>{chunk[i] ? (COUNTRY_CODES[chunk[i].origine] || (chunk[i].origine ? chunk[i].origine.substring(0, 2).toUpperCase() : '')) : ''}</td>)}
                  </tr>
                  {/* Ligne 9 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>V.ASSURANCE:</span> <span>{formatWithDots(valeurs.vAssurance)} FCFA</span></div>
                    </td>
                    <td style={thStyle}>P. Brut</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={tdStyle}>{chunk[i] ? chunk[i].pBrut : ''}</td>)}
                  </tr>
                  {/* Ligne 10 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>V.COMMISSION:</span> <span>{formatWithDots(valeurs.vCommission)}</span></div>
                    </td>
                    <td style={thStyle}>P. Net</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={tdStyle}>{chunk[i] ? chunk[i].pNet : ''}</td>)}
                  </tr>
                  {/* Ligne 11 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>V.TAUX D'AJUST.:</span> <span>{formatWithDots(valeurs.vTauxAjust)}</span></div>
                    </td>
                    <td style={thStyle}>V. Facture</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={tdStyle}>{chunk[i] ? formatWithDots(chunk[i].valeur) : ''}</td>)}
                  </tr>
                  {/* Ligne 12 */}
                  <tr>
                    <td style={darkTdStyle}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>V.FRAIS DIVERS:</span> <span>{formatWithDots(valeurs.vFraisDivers)} {valeurs.vFraisDevise || ''}</span></div>
                    </td>
                    <td style={thStyle}>V. Statistique</td>
                    {[...Array(5)].map((_, i) => <td key={i} style={{...tdStyle, fontWeight: 'bold', backgroundColor: '#f8fafc'}}>{chunk[i] ? formatWithDots(chunk[i].valeurImposable) : ''}</td>)}
                  </tr>
                  {/* Ligne 13 */}
                  {valeurs.cafDevise !== '' && valeurs.cafDevise !== undefined && (
                    <tr>
                      <td style={{ ...darkTdStyle, backgroundColor: 'white' }}>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}><span>C.A.F (devise):</span> <span>{formatWithDots(valeurs.cafDevise)}</span></div>
                      </td>
                      <td colSpan={6} rowSpan={2} style={{ borderTop: tableBorderStyle, borderLeft: 'none', borderRight: 'none', borderBottom: 'none', backgroundColor: 'white' }}></td>
                    </tr>
                  )}
                  {/* Ligne 14 */}
                  <tr>
                    <td style={{ ...darkTdStyle, backgroundColor: '#f1f5f9' }}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}><span>C.A.F (CFA):</span> <span>{formatWithDots(valeurs.cafCFA)}</span></div>
                    </td>
                  </tr>
                </tbody>
              </table>
              
              {/* Ligne bleue de fin au lieu d'un gros footer */}
              <div style={{ marginTop: '10px', borderTop: '2px solid #0c4a6e' }}></div>
              
              {/* FOOTER NUMÉROTATION PAGE 1 (Uniquement pour native print) */}
              <div className="only-print" style={{ textAlign: 'right', fontSize: '11px', fontWeight: 'bold', marginTop: '10px' }}>
                PAGE {pageIndex + 1} / {pages.length}
              </div>
            </>
          ) : (
            /* --- PAGES SUIVANTES (Ancien design, 3 tableaux max par page) --- */
            <div style={{ padding: '30px 0 0 0', position: 'relative' }}>
              {/* HEADER PAGES SUIVANTES */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
                <div style={{ width: '150px' }}>
                  {company?.logo ? (
                    <img src={company.logo} alt="Logo" style={{ width: '90px', height: 'auto', maxHeight: '50px', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{company?.name || ''}</div>
                  )}
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textDecoration: 'underline', color: '#0c4a6e' }}>
                    NOTE DE DETAIL DR N°{docNumber}
                  </h2>
                </div>
                <div style={{ width: '150px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>
                  DATE :{currentDate}
                </div>
              </div>

              {/* LES 2 TABLEAUX */}
              {page.tables.map((tableChunk, tableIndex) => (
                <table key={tableIndex} style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', textAlign: 'center', marginBottom: '5px', fontSize: '9px', pageBreakInside: 'avoid' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#0c4a6e', color: 'white', textTransform: 'uppercase', width: '16%' }}>Nomenclature Tarifaire</td>
                      {[...Array(6)].map((_, i) => {
                        const globalIndex = 5 + (pageIndex - 1) * 12 + tableIndex * 6 + i;
                        return (
                          <td key={i} style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold', backgroundColor: '#0c4a6e', color: 'white', textTransform: 'uppercase', width: '14%' }}>
                            {tableChunk[i] ? `Article ${String(globalIndex + 1).padStart(2, '0')}` : ''}
                          </td>
                        );
                      })}
                    </tr>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>Code SH</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', fontWeight: 'bold', color: '#0c4a6e' }}>{tableChunk[i] ? String(tableChunk[i].codeSH).padEnd(8, '0').substring(0, 8) : ''}</td>)}
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>Code Additionnel</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? (tableChunk[i].codeAdditionnel || '000') : ''}</td>)}
                    </tr>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>Unité Supp</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? `${tableChunk[i].quantite || ''} ${tableChunk[i].unite || ''}` : ''}</td>)}
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>Quantité</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? tableChunk[i].quantite : ''}</td>)}
                    </tr>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>Nbro. Colis</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? tableChunk[i].colis : ''}</td>)}
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>{infos.typeLieu || 'Provenance'}</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? (COUNTRY_CODES[infos.provenance] || infos.provenance.substring(0, 2).toUpperCase()) : ''}</td>)}
                    </tr>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>Origine</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? (COUNTRY_CODES[tableChunk[i].origine] || (tableChunk[i].origine ? tableChunk[i].origine.substring(0, 2).toUpperCase() : '')) : ''}</td>)}
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>P. Brut</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? tableChunk[i].pBrut : ''}</td>)}
                    </tr>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>P. Net</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? tableChunk[i].pNet : ''}</td>)}
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>V. Facture</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', color: '#1e293b' }}>{tableChunk[i] ? formatWithDots(tableChunk[i].valeur) : ''}</td>)}
                    </tr>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0c4a6e' }}>V. Statistique</td>
                      {[...Array(6)].map((_, i) => <td key={i} style={{ border: '1px solid #cbd5e1', padding: '2px 4px', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#1e293b' }}>{tableChunk[i] ? formatWithDots(tableChunk[i].valeurImposable) : ''}</td>)}
                    </tr>
                  </tbody>
                </table>
              ))}

              {/* FOOTER NUMÉROTATION PAGE (Uniquement pour native print, html2pdf gère le sien) */}
              <div className="only-print" style={{ textAlign: 'right', fontSize: '11px', fontWeight: 'bold', marginTop: '10px' }}>
                PAGE {pageIndex + 1} / {pages.length}
              </div>
            </div>
          )}
        </div>
        </React.Fragment>
      );
    })}
    </div>
  );
};

export default NoteDocument;
