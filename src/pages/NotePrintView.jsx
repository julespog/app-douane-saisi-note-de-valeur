import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import NoteDocument from '../components/NoteDocument';
import { UserContext } from '../context/UserContext';
import { supabase } from '../supabaseClient';
import { distributeTotals } from '../utils/weightDistribution';

const NotePrintView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [includeRawTable, setIncludeRawTable] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const { articles: originalArticles, rawArticles: originalRawArticles, infos, valeurs, level, company: stateCompany } = location.state || { articles: [], rawArticles: [], infos: {}, valeurs: {} };
  const articles = distributeTotals(originalArticles, infos, valeurs);
  const rawArticles = distributeTotals(originalRawArticles, infos, valeurs);
  const { user } = React.useContext(UserContext);
  const company = stateCompany || user?.company;
  const [liveFooter, setLiveFooter] = React.useState('');

  React.useEffect(() => {
    // Force fetch latest footer text directly from DB to prevent caching issues
    const fetchLiveFooter = async () => {
      const compId = company?.id || user?.companyId;
      if (compId) {
        try {
          const { data } = await supabase.from('companies').select('legal_info').eq('id', compId).single();
          if (data && data.legal_info && data.legal_info.footer_text) {
            setLiveFooter(data.legal_info.footer_text);
          } else if (company?.footer_text) {
            setLiveFooter(company.footer_text);
          }
        } catch (e) {
          if (company?.footer_text) setLiveFooter(company.footer_text);
        }
      } else if (company?.footer_text) {
        setLiveFooter(company.footer_text);
      }
    };
    fetchLiveFooter();
  }, [company, user]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    
    // Temporarily adjust styling for better PDF capture
    const element = document.getElementById('pdf-content');
    const originalMaxWidth = element.style.maxWidth;
    const originalMargin = element.style.margin;
    const originalBoxShadow = element.style.boxShadow;
    const originalMinHeight = element.style.minHeight;
    element.style.maxWidth = 'none';
    element.style.margin = '0';
    element.style.boxShadow = 'none';
    element.style.minHeight = 'auto'; // Prevent blank pages caused by viewport height
    element.style.overflow = 'hidden'; // Prevent sub-pixel overflow

    // FIX ULTIME : Le navigateur crée un énorme espace vide physique quand il voit `page-break-before: always`.
    // Cela corrompt la capture de html2canvas. On désactive donc temporairement cette classe.
    const pageBreaks = document.querySelectorAll('.force-page-break');
    pageBreaks.forEach(el => {
      el.classList.remove('force-page-break');
      el.classList.add('temp-page-break');
    });

    try {
      // Create PDF
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      
      // Collect all exact page containers (NoteDocument pages + Table Chunks)
      const elementsToPrint = [
        ...document.querySelectorAll('.print-padding'),
        ...document.querySelectorAll('.pdf-chunk')
      ];

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 10;
      const topMargin = 15; // Increased from 5 to 15 to unglue content from the top of the page
      const bottomMargin = 25;
      const maxImgWidth = pdfWidth - (margin * 2);
      const maxImgHeight = pdfHeight - topMargin - bottomMargin;

      const activeFooter = liveFooter || (company && company.footer_text) || '';
      const generationText = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} ${user ? `par ${user.email}` : ''}`;

      for (let i = 0; i < elementsToPrint.length; i++) {
        if (i > 0) pdf.addPage();
        
        const el = elementsToPrint[i];
        
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 1200,
          onclone: (clonedDoc) => {
            const hideElements = clonedDoc.querySelectorAll('.no-html2pdf, .only-print');
            hideElements.forEach(hideEl => {
              hideEl.style.setProperty('display', 'none', 'important');
            });
          }
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const imgProps = pdf.getImageProperties(imgData);
        
        let imgWidth = maxImgWidth;
        let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        
        // Auto-scale to fit page if the content is unexpectedly tall
        if (imgHeight > maxImgHeight) {
          imgHeight = maxImgHeight;
          imgWidth = (imgProps.width * imgHeight) / imgProps.height;
        }
        
        const x = (pdfWidth - imgWidth) / 2;
        
        pdf.addImage(imgData, 'JPEG', x, topMargin, imgWidth, imgHeight);

        // --- DRAW NATIVE FOOTER ---
        let footerY = pdfHeight - 16;
        let generationTextY = footerY + 5;

        if (activeFooter) {
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(0, 0, 0); // Black color
          let lines = [activeFooter];
          const words = activeFooter.split(' ');
          if (words.length > 10) {
            const mid = Math.ceil(words.length / 2);
            lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
          }
          pdf.text(lines, pdfWidth / 2, footerY, { align: 'center' });
          
          if (lines.length > 1) {
            generationTextY = footerY + (lines.length * 4.5);
          }
        }

        // Generation info
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139); // Slate 500
        pdf.text(generationText, pdfWidth / 2, generationTextY, { align: 'center' });

        // Page number
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`PAGE ${i + 1} / ${elementsToPrint.length}`, pdfWidth - 10, generationTextY, { align: 'right' });
      }

      pdf.save(`Note_Valeur_${infos?.noDossier || 'Document'}.pdf`);
    } catch (err) {
      console.error("Erreur génération PDF:", err);
      alert("Une erreur est survenue lors de la génération du PDF.");
    } finally {
      // Restore styling
      element.style.maxWidth = originalMaxWidth;
      element.style.margin = originalMargin;
      element.style.boxShadow = originalBoxShadow;
      element.style.minHeight = originalMinHeight;
      element.style.overflow = '';
      
      // Restaurer les sauts de page pour l'impression native
      const tempBreaks = document.querySelectorAll('.temp-page-break');
      tempBreaks.forEach(el => {
        el.classList.remove('temp-page-break');
        el.classList.add('force-page-break');
      });
      setIsGenerating(false);
    }
  };

  const getArticleVStat = (artFOB) => {
    const facture = parseFloat(valeurs.vFacture) || rawArticles.reduce((sum, art) => sum + (parseFloat(art.valeur) || 0), 0);
    const cafCFA = parseFloat(valeurs.cafCFA) || 0;
    if (facture <= 0 || cafCFA <= 0) return 0;
    const coefCAF = facture / cafCFA;
    return (parseFloat(artFOB) / coefCAF).toFixed(0);
  };

  const formatWithDots = (val) => {
    if (val === null || val === undefined || val === '') return '';
    return Number(val).toLocaleString('fr-FR').replace(/\s/g, '.');
  };

  const formatFooterText = (text) => {
    if (!text) return null;
    const words = text.split(' ');
    if (words.length > 10) {
      const mid = Math.ceil(words.length / 2);
      return (
        <span style={{ display: 'block', textAlign: 'center' }}>
          {words.slice(0, mid).join(' ')}<br />
          {words.slice(mid).join(' ')}
        </span>
      );
    }
    return text;
  };

  return (
    <div className="print-wrapper" style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '2rem 0' }}>
      
      {/* Styles pour l'impression */}
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body, html { 
              background-color: white !important; 
              margin: 0; 
              padding: 0; 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
            .print-wrapper {
              min-height: auto !important;
              padding: 0 !important;
              background-color: white !important;
            }
            .print-container { 
              padding: 0 !important; 
              box-shadow: none !important; 
              margin: 0 !important; 
              width: 100% !important; 
              max-width: 100% !important; 
              min-height: auto !important;
            }
            
            /* Anti-blank pages rules */
            * {
              page-break-after: auto;
              page-break-before: auto;
            }
            @page { size: A4 landscape; margin: 15mm 5mm 35mm 5mm; } /* Bottom margin 35mm protects the native footer from overlapping content */
            tr { page-break-inside: avoid; }
          }
          .print-footer {
            display: none; /* Cache par defaut */
          }
          @media screen {
            .print-only { display: none !important; }
          }
          @media print {
            .screen-and-pdf-only { display: none !important; }
            .print-only { display: block !important; }
            .force-page-break {
              page-break-before: always !important;
            }
            .no-print { display: none !important; }
            @page {
              size: A4 landscape;
              margin: 0; /* SUPPRIME LES EN-TÊTES ET PIEDS DE PAGE DU NAVIGATEUR (Date, URL, etc) */
            }
            body {
              padding: 10mm !important; /* Protège le contenu des bords physiques non-imprimables */
            }
            .native-padding-bottom {
              padding-bottom: 30mm !important; /* Force l'espace pour le footer fixe */
            }
            .chunk-spacing {
              padding-top: 10mm !important;
            }
            .native-page-break {
              page-break-before: always !important;
            }
            .no-html2pdf { display: block !important; }
            .only-print { display: block !important; }
            .print-footer {
              display: block !important;
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 0 10mm 5mm 10mm !important;
              background-color: white;
              z-index: 1000;
            }
            .print-container {
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              min-height: auto !important;
            }
          }
        `}
      </style>

      {/* Barre d'actions (masquée à l'impression) */}
      <div className="no-print" data-html2canvas-ignore="true" style={{ 
        position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '1rem', backgroundColor: 'var(--bg-secondary)', padding: '1rem', 
        borderRadius: '8px', boxShadow: 'var(--shadow-md)', zIndex: 1000 
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, marginRight: '1rem', color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={includeRawTable} onChange={(e) => setIncludeRawTable(e.target.checked)} style={{ width: '18px', height: '18px' }} />
          Joindre le tableau de sélection
        </label>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
          <Printer size={16} /> Imprimer
        </button>
        <button onClick={handleDownloadPDF} disabled={isGenerating} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: isGenerating ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isGenerating ? 0.7 : 1 }}>
          {isGenerating ? <Loader2 size={16} className="spin-anim" /> : <Download size={16} />} 
          {isGenerating ? 'Création...' : 'Télécharger PDF'}
        </button>
      </div>

      <div id="pdf-content" className="print-container" style={{ 
        width: '100%', maxWidth: '1000px', margin: '4rem auto 0 auto', backgroundColor: 'white',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', paddingTop: '2rem', paddingLeft: '2rem', paddingRight: '2rem', paddingBottom: '0', minHeight: '80vh' 
      }}>
        <NoteDocument articles={articles} infos={infos} valeurs={valeurs} company={company} level={location.state?.level} />

        {/* --- Version UNIFIÉE : Découpage manuel pour le PDF ET l'impression native --- */}
        {includeRawTable && (rawArticles?.length > 0 || articles?.length > 0) && (
          <>
            {/* VERSION ÉCRAN ET PDF (25 articles par page) */}
            <div className="table-chunks-container screen-and-pdf-only">
              {(() => {
                const data = rawArticles?.length > 0 ? rawArticles : articles;
                const chunkSize = 22; // Réduit à 22 pour éviter le débordement d'une ligne sur une page orpheline
                const chunks = [];
                for (let i = 0; i < data.length; i += chunkSize) {
                  chunks.push(data.slice(i, i + chunkSize));
                }
                return chunks.map((chunk, chunkIndex) => (
                  <React.Fragment key={`pdf-${chunkIndex}`}>
                    <div className="native-padding-bottom print-wrapper force-page-break pdf-chunk chunk-spacing" style={{ 
                      paddingLeft: '10px', 
                      paddingRight: '10px',
                      backgroundColor: 'white',
                      color: 'black'
                    }}>
                      <h2 style={{ textAlign: 'center', textDecoration: 'underline', marginBottom: '10px', fontSize: chunkIndex === 0 ? '16px' : '14px', fontWeight: 'bold', color: '#0c4a6e' }}>
                        DÉTAIL DU TABLEAU DE SÉLECTION ({chunkIndex === 0 ? `${data.length} articles` : `Suite ${chunkIndex + 1}`})
                      </h2>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left', color: 'black' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#0c4a6e', color: 'white', textTransform: 'uppercase' }}>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '7%' }}>CODE SH</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '30%' }}>INTITULÉ</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '8%' }}>ORIGINE</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '6%', textAlign: 'center' }}>QTÉ</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '9%', textAlign: 'center' }}>VALEUR</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '7%', textAlign: 'center' }}>P. BRUT</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '7%', textAlign: 'center' }}>P. NET</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '6%', textAlign: 'center' }}>COLIS</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '9%', textAlign: 'center' }}>V.STAT (CFA)</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '5%', textAlign: 'center' }}>TAUX DD</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '6%', textAlign: 'center' }}>UNITÉ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map((art, i) => (
                          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc', pageBreakInside: 'avoid' }}>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{String(art.codeSH).padEnd(8, '0').substring(0, 8)}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1' }}>{art.intitule}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.origine}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.quantite}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.valeur}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.pBrut}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.pNet}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.colis}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{formatWithDots(getArticleVStat(art.valeur))}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.tauxDD}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.unite}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </React.Fragment>
                ));
              })()}
            </div>

            {/* VERSION IMPRESSION NATIVE SEULEMENT (20 articles par page) */}
            <div className="table-chunks-container print-only">
              {(() => {
                const data = rawArticles?.length > 0 ? rawArticles : articles;
                const chunkSize = 22; // Configuré sur 22 articles par page pour éviter les débordements
                const chunks = [];
                for (let i = 0; i < data.length; i += chunkSize) {
                  chunks.push(data.slice(i, i + chunkSize));
                }
                return chunks.map((chunk, chunkIndex) => (
                  <React.Fragment key={`print-${chunkIndex}`}>
                    <div className="native-padding-bottom print-wrapper force-page-break chunk-spacing" style={{ 
                      paddingLeft: '10px', 
                      paddingRight: '10px',
                      backgroundColor: 'white',
                      color: 'black'
                    }}>
                      <h2 style={{ textAlign: 'center', textDecoration: 'underline', marginBottom: '10px', fontSize: chunkIndex === 0 ? '16px' : '14px', fontWeight: 'bold', color: '#0c4a6e' }}>
                        DÉTAIL DU TABLEAU DE SÉLECTION ({chunkIndex === 0 ? `${data.length} articles` : `Suite ${chunkIndex + 1}`})
                      </h2>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left', color: 'black' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#0c4a6e', color: 'white', textTransform: 'uppercase' }}>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '7%' }}>CODE SH</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '30%' }}>INTITULÉ</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '8%' }}>ORIGINE</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '6%', textAlign: 'center' }}>QTÉ</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '9%', textAlign: 'center' }}>VALEUR</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '7%', textAlign: 'center' }}>P. BRUT</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '7%', textAlign: 'center' }}>P. NET</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '6%', textAlign: 'center' }}>COLIS</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '9%', textAlign: 'center' }}>V.STAT (CFA)</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '5%', textAlign: 'center' }}>TAUX DD</th>
                        <th style={{ backgroundColor: '#0c4a6e', color: 'white', padding: '3px 2px', border: '1px solid #cbd5e1', width: '6%', textAlign: 'center' }}>UNITÉ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map((art, i) => (
                          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc', pageBreakInside: 'avoid' }}>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{String(art.codeSH).padEnd(8, '0').substring(0, 8)}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1' }}>{art.intitule}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.origine}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.quantite}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.valeur}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.pBrut}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.pNet}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.colis}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{formatWithDots(getArticleVStat(art.valeur))}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.tauxDD}</td>
                            <td style={{ padding: '3px 2px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{art.unite}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </React.Fragment>
                ));
              })()}
            </div>
          </>
        )}

        {/* Pied de page natif restauré */}
        <div className="print-footer no-html2pdf" data-html2canvas-ignore="true">
          { (liveFooter || (company && company.footer_text)) && (
            <div style={{ color: 'black', fontWeight: 'bold', fontSize: '10pt', whiteSpace: 'pre-wrap', marginBottom: '2mm', lineHeight: '1.4' }}>
              {formatFooterText(liveFooter || company.footer_text)}
            </div>
          )}
          <div style={{ textAlign: 'center', borderTop: '1px solid transparent', paddingTop: '5px' }}>
            <div style={{ color: '#64748b', fontSize: '8pt' }}>
              Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')} 
              {user ? ` par ${user.email}` : ''}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default NotePrintView;
