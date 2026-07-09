import React, { useState, useEffect, useContext, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, Plus, Trash2, Save, Download, 
  Printer, BookOpen, FileText, CheckCircle, Calculator, Package, CreditCard, AlertCircle, Folder, Lock, Copy, Bot, GraduationCap, RefreshCw, ClipboardCopy
} from 'lucide-react';
import { applyGroupingLogic } from '../utils/groupingLogic';
import { COUNTRIES } from '../utils/countries';
import { useNavigate, useLocation } from 'react-router-dom';
import NoteDocument from '../components/NoteDocument';
import { DatabaseContext } from '../context/DatabaseContext';
import { UserContext } from '../context/UserContext';
import { supabase } from '../supabaseClient';
import CustomPDFViewer from '../components/CustomPDFViewer';
import { distributeTotals } from '../utils/weightDistribution';

const INITIAL_INFOS = {
  noDossier: '', noOT: '', noCDEMarque: '', noRepertoire: '',
  noSTRedevable: '', noSTDestination: '',
  typeLTA_CNT: 'No LTA', valLTA_CNT: '',
  typeLieu: 'Provenance', provenance: 'Afghanistan', nombreNatureColis: '', poidsBrut: '', poidsNet: '', noVolOuVol: '',
  devise: 'EUR', tauxDevise: '655.957', modeReglement: '01',
  typeOperation: 'IM4', modeTaxation: '4000 / 000', modeTransport: 'MER', incoterm: 'FOB',
  autoColis: true, modePoids: 'auto'
};

const INITIAL_VALEURS = {
  vFacture: '', vFactureCalculee: '', vFret: '', vAssurance: '',
  tauxAssurance: '0.05', vCommission: '', vTauxAjust: '', vFraisDivers: '',
  cafDevise: '', cafCFA: '', modeAssurance: 'auto'
};

const NoteForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tariffs, saveNote } = useContext(DatabaseContext);
  const { user } = useContext(UserContext);

  // 1. Informations
  const [infos, setInfos] = useState(INITIAL_INFOS);

  // 2. Note de Valeurs
  const [valeurs, setValeurs] = useState(INITIAL_VALEURS);

  // 3. Articles & Search
  const [articles, setArticles] = useState([]);

  // Récupérer les données à éditer depuis les Archives
  useEffect(() => {
    // Si on a les données d'un document cliqué (Brouillon ou Archive), on les charge
    if (location.state?.draftData) {
      const { infos: dInfos, valeurs: dVal, articles: dArt } = location.state.draftData;
      if (dInfos) setInfos({...INITIAL_INFOS, ...dInfos});
      if (dVal) setValeurs({...INITIAL_VALEURS, ...dVal});
      if (dArt) setArticles(dArt);
    } else if (location.state?.archiveData) {
      const { infos: dInfos, valeurs: dVal } = location.state.archiveData;
      const dArt = location.state.archiveData.rawArticles || location.state.archiveData.articles;
      if (dInfos) setInfos({...INITIAL_INFOS, ...dInfos});
      if (dVal) setValeurs({...INITIAL_VALEURS, ...dVal});
      if (dArt) setArticles(dArt);
    } else {
      // Sinon, on tente de récupérer le brouillon local de l'entreprise
      const savedDraft = localStorage.getItem(`noteDraft_${user?.companyId || 'default'}`);
      if (savedDraft) {
        const { infos: dInfos, valeurs: dVal, articles: dArt } = JSON.parse(savedDraft);
        if (dInfos) setInfos({...INITIAL_INFOS, ...dInfos});
        if (dVal) setValeurs({...INITIAL_VALEURS, ...dVal});
        if (dArt) setArticles(dArt);
      }
    }
  }, [location.state, user]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // AI product search state
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState({ code: '', explanation: '' });
  const [aiLoading, setAiLoading] = useState(false);

  // Nouveau state pour l'article en cours d'ajout
  const [newArticle, setNewArticle] = useState(null);

  // Lecteur PDF rapide (Code Douane / Reglementation)
  const [pdfViewerDoc, setPdfViewerDoc] = useState(null);

  // Pop-up personnalisé
  const [customAlert, setCustomAlert] = useState(null);

  const fileInputRef = useRef(null);

  // Synchronisation de l'état pour l'auto-save
  const stateRef = useRef({ infos, valeurs, articles });
  useEffect(() => {
    stateRef.current = { infos, valeurs, articles };
  }, [infos, valeurs, articles]);

  // Sauvegarde automatique toutes les 15 secondes
  useEffect(() => {
    const intervalId = setInterval(() => {
      const current = stateRef.current;
      // Ne sauvegarde que s'il y a des données pertinentes
      if (current.infos.noDossier || current.articles.length > 0 || current.valeurs.vFacture) {
        localStorage.setItem(`noteDraft_${user?.companyId || 'default'}`, JSON.stringify(current));
      }
    }, 15000);
    return () => clearInterval(intervalId);
  }, [user]);

  const saveDraft = () => {
    localStorage.setItem(`noteDraft_${user?.companyId || 'default'}`, JSON.stringify({ infos, valeurs, articles }));
    setCustomAlert({
      type: 'success',
      title: 'Sauvegardé',
      message: 'Brouillon sauvegardé avec succès ! Vous pourrez le reprendre plus tard.',
      onConfirm: () => setCustomAlert(null)
    });
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const importedArticles = data.map((row, index) => {
          const keys = Object.keys(row);
          // Recherche robuste des colonnes pour éviter de mélanger Code SH et Description
          const codeKey = keys.find(k => k.toLowerCase() === 'code sh' || k.toLowerCase() === 'code') || keys[0];
          const descKey = keys.find(k => k.toLowerCase().includes('des') || k.toLowerCase().includes('intitul') || k.toLowerCase().includes('lib')) || keys[1];
          const valKey = keys.find(k => k.toLowerCase().includes('valeur') || k.toLowerCase().includes('fob') || k.toLowerCase().includes('prix'));
          const qteKey = keys.find(k => k.toLowerCase().includes('qte') || k.toLowerCase().includes('quantit'));
          const origineKey = keys.find(k => k.toLowerCase().includes('origin') || k.toLowerCase().includes('pays'));
          const colisKey = keys.find(k => k.toLowerCase().includes('colis') || k.toLowerCase().includes('nbr'));
          const codeAddKey = keys.find(k => k.toLowerCase().includes('additi') || k.toLowerCase().includes('code add'));
          
          const cemacKey = keys.find(k => k.toLowerCase().includes('cemac') || k.toLowerCase().includes('sous'));
          const rawCodeSH = String(row[codeKey] || '').replace(/[\s.]/g, '');
          const rawCemac = cemacKey ? String(row[cemacKey] || '').replace(/[\s.]/g, '') : '';
          const finalCodeSH = (rawCodeSH + rawCemac).padEnd(8, '0').substring(0, 8);
          
          return {
            id: Date.now() + index,
            codeSH: finalCodeSH,
            intitule: row[descKey] || 'Article importé',
            origine: origineKey ? String(row[origineKey] || '').trim() || infos.provenance : (infos.provenance || 'NC'),
            quantite: qteKey ? String(row[qteKey]) : '1',
            valeur: valKey ? String(row[valKey]) : '0',
            pBrut: qteKey && valKey ? '' : '', // On laisse vide par défaut, l'utilisateur devra répartir
            pNet: '',
            colis: infos.autoColis !== false ? '1' : (colisKey && row[colisKey] ? String(row[colisKey]) : '1'),
            codeAdditionnel: codeAddKey && row[codeAddKey] ? String(row[codeAddKey]) : '000',
            tauxDD: '0', 
            unite: 'KGM'
          };
        });
        
        setArticles(prev => [...prev, ...importedArticles]);
        setCustomAlert({
          type: 'success',
          title: 'Import Réussi',
          message: `${importedArticles.length} articles importés avec succès depuis le fichier Excel ! Pensez à vérifier leurs taux.`,
          onConfirm: () => setCustomAlert(null)
        });
      } catch (err) {
        setCustomAlert({
          type: 'error',
          title: 'Erreur Import',
          message: "Erreur lors de la lecture du fichier Excel. Vérifiez qu'il s'agit bien d'un fichier valide.",
          onConfirm: () => setCustomAlert(null)
        });
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset input
  };

  const handleInfosChange = (e) => setInfos({...infos, [e.target.name]: e.target.value});
  
  const handleValeursChange = (e) => {
    const { name, value } = e.target;
    if (!['cafDevise', 'cafCFA', 'vFactureCalculee'].includes(name)) {
      setValeurs(prev => ({...prev, [name]: value}));
    }
  };

  // Helper pour lire correctement les nombres avec virgules ou espaces (issus d'Excel)
  const parseNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  // Calcul CAF Automatique
  useEffect(() => {
    // Si vFacture est vide, on prend la somme des FOB des articles comme valeur de facture calculée
    const totalFOBArticles = articles.reduce((sum, art) => sum + parseNumber(art.valeur), 0);
    const facture = parseNumber(valeurs.vFacture) || totalFOBArticles;
    
    const fret = parseNumber(valeurs.vFret);
    const tauxAss = parseNumber(valeurs.tauxAssurance);
    const commission = parseNumber(valeurs.vCommission);
    const fraisDivers = parseNumber(valeurs.vFraisDivers);
    const ajustement = parseNumber(valeurs.vTauxAjust);

    // L'assurance dépend du mode
    let assurance = 0;
    if (valeurs.modeAssurance === 'manuel') {
      assurance = parseNumber(valeurs.vAssurance);
    } else {
      assurance = (facture + fret + fraisDivers) * (tauxAss / 100);
    }
    
    const tauxDev = parseNumber(infos.tauxDevise) || 1;

    // Les autres frais s'ajoutent/se soustraient à la valeur CAF en devise
    const cafDev = facture + fret + assurance + commission + fraisDivers - ajustement;
    const cafC = cafDev * tauxDev;

    setValeurs(prev => {
      const newState = {
        ...prev,
        vFactureCalculee: totalFOBArticles.toFixed(2),
        cafDevise: cafDev.toFixed(2),
        cafCFA: cafC.toFixed(0)
      };
      if (prev.modeAssurance !== 'manuel') {
        newState.vAssurance = assurance.toFixed(2);
      }
      return newState;
    });
  }, [valeurs.vFacture, valeurs.vFret, valeurs.tauxAssurance, valeurs.vCommission, valeurs.vFraisDivers, valeurs.vTauxAjust, valeurs.modeAssurance, valeurs.vAssurance, infos.tauxDevise, articles]);

  // L'auto-somme bottom-up (articles -> header) a été désactivée car elle écrasait 
  // les valeurs globales saisies manuellement par l'utilisateur, ce qui cassait
  // le coefficient de répartition des poids pour les articles suivants.

  // Force l'arrondissement mathématique de tous les poids et colis dans le tableau
  useEffect(() => {
    if (articles.length === 0) return;
    let hasDecimals = false;
    const roundedArticles = articles.map(a => {
      let newB = a.pBrut;
      let newN = a.pNet;
      let newCol = a.colis;
      
      const parseLocal = (val) => {
        if (!val) return NaN;
        if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
        return parseFloat(val);
      };

      const pB_val = parseLocal(a.pBrut);
      if (!isNaN(pB_val) && !Number.isInteger(pB_val)) { newB = Math.round(pB_val).toString(); hasDecimals = true; }
      
      const pN_val = parseLocal(a.pNet);
      if (!isNaN(pN_val) && !Number.isInteger(pN_val)) { newN = Math.round(pN_val).toString(); hasDecimals = true; }
      
      const col_val = parseLocal(a.colis);
      if (!isNaN(col_val) && !Number.isInteger(col_val)) { newCol = Math.round(col_val).toString(); hasDecimals = true; }
      
      if (newB !== a.pBrut || newN !== a.pNet || newCol !== a.colis) {
        return { ...a, pBrut: newB, pNet: newN, colis: newCol };
      }
      return a;
    });

    if (hasDecimals) {
      setArticles(roundedArticles);
    }
  }, [articles]);

  const getTariffDisplay = (tariff) => {
    if (!tariff) return {};
    const keys = Object.keys(tariff);
    const codeSHKey = keys.find(k => k.toLowerCase().includes('sh') || k.toLowerCase().includes('code')) || keys[0];
    const descKey = keys.find(k => k.toLowerCase().includes('des') || k.toLowerCase().includes('lib') || k.toLowerCase().includes('intitul')) || keys[1];
    const tauxKey = keys.find(k => k.toLowerCase().includes('taux') || k.toLowerCase().includes('droit') || k.toLowerCase().includes('dd')) || keys[2];
    const uniteKey = keys.find(k => k.toLowerCase().includes('unit') || k.toLowerCase().includes('uom')) || keys[3];
    const cemacKey = keys.find(k => k.toLowerCase().includes('cemac'));
    const natKey = keys.find(k => k.toLowerCase().includes('nationale'));
    return { codeSHKey, descKey, tauxKey, uniteKey, cemacKey, natKey };
  };



  const openNoteExplicative = async (codeSH) => {
    if (!codeSH) return;
    // On extrait les 2 premiers chiffres (le chapitre)
    const chapter = String(codeSH).trim().substring(0, 2);
    try {
      const res = await fetch('/manifest_docs.json');
      const data = await res.json();
      const notesFolder = data.find(d => d.name === "NOTE EXPLICATIVE systeme harmonise 2022");
      if (notesFolder && notesFolder.children) {
        // Le fichier commence par "XX_"
        const targetFile = notesFolder.children.find(f => f.name.startsWith(`${chapter}_`));
        if (targetFile) {
          // On formate le code pour la recherche (souvent les points sont inclus dans le texte du PDF)
          // Parfois "0102.21.00" est écrit "01.02" dans la note. On va chercher les 4 premiers chiffres formatés
          const searchParam = `${chapter}.${String(codeSH).trim().substring(2, 4)}`;
          setPdfViewerDoc(`${targetFile.url}#search=${encodeURIComponent(searchParam)}`);
        } else {
          setCustomAlert({
            type: 'error',
            title: 'Introuvable',
            message: `Note explicative non trouvée pour le chapitre ${chapter}.`,
            onConfirm: () => setCustomAlert(null)
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectTariff = (tariff) => {
    const { codeSHKey, descKey, tauxKey, uniteKey, cemacKey, natKey } = getTariffDisplay(tariff);

    const rawCodeSH = String(tariff[codeSHKey] || '').replace(/[\s.]/g, '');
    const rawCemac = cemacKey ? String(tariff[cemacKey] || '').replace(/[\s.]/g, '') : '';
    const fullCode = (rawCodeSH + rawCemac).padEnd(8, '0').substring(0, 8);

    setNewArticle({
      id: Date.now(),
      codeSH: fullCode,
      intitule: tariff[descKey] || '',
      tauxDD: String(tariff[tauxKey] || '0').replace(/[^0-9.]/g, ''),
      unite: tariff[uniteKey] || 'KGM',
      origine: infos.provenance,
      quantite: '1',
      valeur: '', // Valeur FOB
      pBrut: '',
      pNet: '',
      colis: '1',
      codeAdditionnel: '000'
    });
    setSearchTerm('');
    setSuggestions([]);
  };

  const handleNewArticleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'codeSH') {
      const cleaned = value.replace(/[\s.]/g, '').substring(0, 8);
      setNewArticle({...newArticle, [name]: cleaned});
    } else {
      setNewArticle({...newArticle, [name]: value});
    }
  };

  const addArticle = () => {
    if (!newArticle.valeur || !newArticle.quantite) {
      setCustomAlert({
        type: 'error',
        title: 'Champs manquants',
        message: 'La valeur FOB et la quantité sont obligatoires pour ajouter un article.',
        onConfirm: () => setCustomAlert(null)
      });
      return;
    }
    const finalCodeSH = (newArticle.codeSH || '').padEnd(8, '0').substring(0, 8);
    setArticles(prev => distributeTotals([...prev, { ...newArticle, codeSH: finalCodeSH, id: Date.now() }], infos, valeurs));
    setNewArticle(null);
  };

  const removeArticle = (id) => {
    setArticles(prev => distributeTotals(prev.filter(a => a.id !== id), infos, valeurs));
  };

  const duplicateArticle = (art) => {
    const duplicated = { ...art, id: Date.now() };
    setArticles(prev => distributeTotals([...prev, duplicated], infos, valeurs));
  };

  const updateArticle = (id, field, value) => {
    setArticles(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, [field]: value } : a);
      if (field === 'valeur') {
        return distributeTotals(updated, infos, valeurs);
      }
      return updated;
    });
  };

  // Rééquilibrage automatique si l'en-tête change (uniquement en mode Auto)
  useEffect(() => {
    if (infos.modePoids === 'manuel') return; // ne pas toucher les poids en mode manuel
    if (articles.length === 0) return;
    
    // On utilise les valeurs actuelles du closure pour éviter de désynchroniser
    // les articles chargés avec un vieil état (ex: modePoids: 'auto' du render initial)
    const newArticles = distributeTotals(articles, infos, valeurs);
    
    // Petite vérification pour éviter des re-rendus inutiles
    // si distributeTotals n'a rien changé
    if (JSON.stringify(articles) !== JSON.stringify(newArticles)) {
      setArticles(newArticles);
    }
  }, [infos.poidsBrut, infos.poidsNet, valeurs.vFacture, infos.modePoids]);

  // Calcul automatique du total des colis
  useEffect(() => {
    const totalColis = articles.reduce((sum, art) => sum + parseInt(art.colis || '0', 10), 0);
    if (infos.nombreNatureColis !== totalColis.toString()) {
      setInfos(prev => ({ ...prev, nombreNatureColis: totalColis.toString() }));
    }
  }, [articles]);

  const resetForm = () => {
    setCustomAlert({
      type: 'confirm',
      title: 'Nouvelle note',
      message: 'Êtes-vous sûr de vouloir vider le dossier en cours pour commencer une nouvelle note ? Cette action est irréversible.',
      onConfirm: () => {
        setInfos(INITIAL_INFOS);
        setValeurs(INITIAL_VALEURS);
        setArticles([]);
        setSearchTerm('');
        setSuggestions([]);
        setNewArticle(null);
        localStorage.removeItem(`noteDraft_${user?.companyId || 'default'}`);
        setCustomAlert(null);
      },
      onCancel: () => setCustomAlert(null)
    });
  };

  const getCalculatedWeight = (fob, type) => {
    const vFob = parseNumber(fob);
    if (!vFob || vFob <= 0) return '';
    const totalFacture = parseNumber(valeurs?.vFacture) || articles.reduce((sum, a) => sum + parseNumber(a.valeur), 0);
    if (totalFacture <= 0) return '';
    const totalWeight = type === 'brut' ? Math.round(parseNumber(infos?.poidsBrut)) : Math.round(parseNumber(infos?.poidsNet));
    return Math.max(1, Math.round(vFob * (totalWeight / totalFacture))).toString();
  };

  // Calcul dynamique de la Valeur Statistique (Valeur Imposable en CFA)
  // v.facture divisée par la valeur caf en fcfa
  const getArticleVStat = (artFOB) => {
    const facture = parseNumber(valeurs.vFacture) || articles.reduce((sum, art) => sum + parseNumber(art.valeur), 0);
    const cafCFA = parseNumber(valeurs.cafCFA);
    if (facture <= 0 || cafCFA <= 0) return 0;
    const coefCAF = facture / cafCFA;
    return (parseNumber(artFOB) / coefCAF).toFixed(0);
  };

  const formatNumberWithDots = (num, isDecimal = false) => {
    if (num === null || num === undefined || num === '') return '';
    const number = Number(num);
    if (isNaN(number)) return num;
    if (isDecimal) {
      return number.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '.');
    }
    return number.toLocaleString('fr-FR').replace(/\s/g, '.');
  };

  // Regroupement visuel en temps réel
  const visualGroups = React.useMemo(() => {
    if (articles.length === 0) return { map: {} };
    
    // Simuler le traitement pour applyGroupingLogic
    const mappedArticles = articles.map(a => ({
      ...a, 
      description: a.intitule, 
      tauxDouane: parseFloat(a.tauxDD), 
      valeurImposable: parseFloat(getArticleVStat(a.valeur))
    }));
    
    const result = applyGroupingLogic(mappedArticles);
    const map = {};
    
    let groupIndex = 0;
    result.articles.forEach(group => {
      const isMerged = group.originalIds && group.originalIds.length > 1;
      let color = 'transparent';
      let badge = '';
      if (isMerged) {
        if (result.level === 1) color = groupIndex % 2 === 0 ? '#dcfce7' : '#bbf7d0'; // Verts
        else if (result.level === 2) color = groupIndex % 2 === 0 ? '#dbeafe' : '#bfdbfe'; // Bleus
        else if (result.level === 3) color = groupIndex % 2 === 0 ? '#fef9c3' : '#fde047'; // Jaunes
        badge = `Niv.${result.level}`;
        groupIndex++;
      }
      if (group.originalIds) {
        group.originalIds.forEach(id => {
          map[id] = { isMerged, color, badge };
        });
      }
    });
    
    return { map, result };
  }, [articles, infos.tauxDevise, infos.devise, infos.fret, infos.assurance, valeurs]);

  const [modalData, setModalData] = useState(null);

  const generateFinalNote = () => {
    if (articles.length === 0) {
      setModalData({ type: 'error', message: "Veuillez ajouter au moins un article avant de générer la note." });
      return;
    }
    const mappedArticles = articles.map(a => ({
      ...a, 
      description: a.intitule, 
      tauxDouane: parseFloat(a.tauxDD), 
      valeurImposable: parseFloat(getArticleVStat(a.valeur))
    }));
    
    // Utiliser l'algorithme de regroupement
    const result = applyGroupingLogic(mappedArticles);
    
    // Archiver la note finale dans la base de données via le contexte
    const archiveData = {
      id: infos.noDossier || `DOC-${Date.now()}`,
      infos, valeurs, articles: result.articles, rawArticles: articles,
      level: result.level,
      companyId: user?.companyId
    };
    
    saveNote(archiveData).catch(e => {
      console.error("Erreur lors de la sauvegarde de la note", e);
      alert("Une erreur est survenue lors de la sauvegarde de la note en ligne.");
    });
    
    // Supprimer le brouillon local puisqu'il est archivé
    localStorage.removeItem(`noteDraft_${user?.companyId || 'default'}`);

    setModalData({
      type: 'success',
      avant: articles.length,
      apres: result.articles.length,
      message: result.message,
      level: result.level,
      articles: result.articles,
      rawArticles: articles
    });
  };

  const cardStyle = {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-color)',
    marginBottom: '1.5rem'
  };

  const sectionTitleStyle = {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '0.4rem',
    textTransform: 'capitalize'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const isDeclarant = user?.role === 'declarant';
  const isExpired = isDeclarant && user?.company?.subscription && new Date() > new Date(user.company.subscription.endDate);

  const handleGlobalKeyDown = (e) => {
    if (e.key === 'Enter' && ['INPUT', 'SELECT'].includes(e.target.tagName)) {
      if (e.target.placeholder && e.target.placeholder.includes('Rechercher')) return;
      e.preventDefault();
      const focusable = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([style*="display: none"]), select'));
      const index = focusable.indexOf(e.target);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    }
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '4rem', position: 'relative' }} onKeyDown={handleGlobalKeyDown}>
      
      {/* OVERLAY ABONNEMENT EXPIRÉ */}
      {isExpired && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(3px)', zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '10rem'
        }}>
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px', backgroundColor: 'white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <Lock size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.5rem', color: 'var(--danger)', marginBottom: '1rem' }}>Abonnement Expiré</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Votre abonnement est arrivé à terme. Vous ne pouvez plus saisir de nouvelles notes de valeurs. 
              Veuillez contacter le support pour renouveler votre accès.
            </p>
            <button onClick={() => navigate('/archives')} className="premium-btn">
              Consulter mes archives
            </button>
          </div>
        </div>
      )}

      {/* MODAL BEAUTIFUL */}
      {modalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', padding: '2rem', 
            width: modalData.type === 'success' ? '90%' : '450px', 
            maxWidth: modalData.type === 'success' ? '900px' : '450px',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center', animation: 'slideUp 0.3s ease-out',
            maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)'
          }}>
            {modalData.type === 'error' ? (
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertCircle size={32} color="var(--danger)" />
              </div>
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <CheckCircle size={32} color="var(--success)" />
              </div>
            )}
            
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              {modalData.type === 'error' ? 'Attention' : 'Génération Réussie !'}
            </h2>
            
            {modalData.type === 'error' ? (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{modalData.message}</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Lignes saisies :</span> <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{modalData.avant}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Après regroupement :</span> <strong style={{ color: 'var(--accent-primary)', fontSize: '1.25rem' }}>{modalData.apres}</strong></div>
                </div>

                {/* PREVIEW CONTAINER */}
                <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1.5rem', display: 'flex', justifyContent: 'center', maxHeight: '50vh', overflowY: 'auto', overflowX: 'hidden', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ width: '750px' }}>
                      <div style={{ width: '1000px', transform: 'scale(0.75)', transformOrigin: 'top left' }}>
                        <div style={{ backgroundColor: 'white', boxShadow: 'var(--shadow-md)' }}>
                          <NoteDocument articles={modalData.articles} infos={infos} valeurs={valeurs} company={user?.company} isPreview={true} level={modalData.level} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Aperçu généré automatiquement. Vérifiez les informations avant d'imprimer.
                  </div>
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setModalData(null)} 
                style={{ padding: '0.875rem 2rem', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)', transition: 'all 0.2s' }}>
                Fermer / Modifier
              </button>
              {modalData.type === 'success' && (
                <button 
                  onClick={() => {
                    setModalData(null);
                    navigate('/print-note', { state: { articles: modalData.articles, rawArticles: modalData.rawArticles, infos, valeurs, level: modalData.level, company: user?.company } });
                  }} 
                  style={{ padding: '0.875rem 2rem', backgroundColor: 'var(--accent-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'white', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(107, 33, 168, 0.3)' }}>
                  Confirmer et Ouvrir la Note
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BARRE D'OUTILS HORIZONTALE (Actions) */}
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', 
        marginBottom: '1rem', overflowX: 'auto'
      }}>
        <button onClick={generateFinalNote} className="premium-btn">
          <FileText size={18} /> Générer la note
        </button>
        
        <button className="premium-btn-secondary" onClick={saveDraft}>
          <Save size={18}/> Sauvegarder
        </button>
        
        <button className="premium-btn-secondary" style={{ marginLeft: '1rem' }} onClick={() => setPdfViewerDoc('/DOCUMENTATION S DOUANE/Code des Douanes Gabonais/Code des douanes harmonisé_final).pdf')}>
          <BookOpen size={18}/> Code Douanes
        </button>
        <button className="premium-btn-secondary" onClick={() => setPdfViewerDoc('/DOCUMENTATION S DOUANE/Reglementation Douaniere/REGLEMENTATION DOUANIERE-CEMAC.pdf')}>
          <FileText size={18}/> Règlementation
        </button>
        <button className="premium-btn-secondary" onClick={() => navigate('/documentation')}>
          <Folder size={18}/> DOC
        </button>
        <button className="premium-btn-secondary" onClick={() => navigate('/training')}>
          <GraduationCap size={18}/> Formation
        </button>
        
        <div style={{ flex: 1 }}></div>
        <button style={{ backgroundColor: 'transparent', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '0.6rem 1rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }} onClick={resetForm}>
          <Plus size={18}/> Nouvelle note
        </button>
      </div>

      {/* ZONE HAUTE : INFOS & VALEURS (75% / 25%) */}
      <div className="flex-stack-mobile" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        {/* COLONNE GAUCHE (75%) */}
        <div style={{ flex: 3, minWidth: 0, marginBottom: 0 }}>
          
          {/* CARTE 1 : Informations d'en-tête */}
          <div style={cardStyle}>
            <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={sectionTitleStyle}><FileText size={18} color="var(--accent-primary)" /> Informations d'en-tête</h2>
            </div>

            <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div><label className="premium-label">No de Dossier</label><input className="premium-input" name="noDossier" value={infos.noDossier} onChange={handleInfosChange}/></div>
              <div><label style={labelStyle}>No OT</label><input style={inputStyle} name="noOT" value={infos.noOT} onChange={handleInfosChange}/></div>
              <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>No Répertoire</label><input style={inputStyle} name="noRepertoire" value={infos.noRepertoire} onChange={handleInfosChange}/></div>
              
              <div><label style={labelStyle}>CDE ou Marque</label><input style={inputStyle} name="noCDEMarque" value={infos.noCDEMarque} onChange={handleInfosChange}/></div>
              <div><label style={labelStyle}>No ST Redevable</label><input style={inputStyle} name="noSTRedevable" value={infos.noSTRedevable} onChange={handleInfosChange}/></div>
              <div><label style={labelStyle}>No ST Destination</label><input style={inputStyle} name="noSTDestination" value={infos.noSTDestination} onChange={handleInfosChange}/></div>
              <div>
                <label style={labelStyle}>LTA / CNT</label>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <select style={{...inputStyle, width: '45%', padding: '0.45rem 0.2rem'}} name="typeLTA_CNT" value={infos.typeLTA_CNT} onChange={handleInfosChange}>
                    <option>No LTA</option><option>CNT</option>
                  </select>
                  <input style={{...inputStyle, flex: 1}} name="valLTA_CNT" value={infos.valLTA_CNT} onChange={handleInfosChange}/>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <select 
                    style={{ background: 'none', border: 'none', padding: 0, margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', outline: 'none' }}
                    name="typeLieu"
                    value={infos.typeLieu || 'Provenance'}
                    onChange={handleInfosChange}
                  >
                    <option value="Provenance">PROVENANCE</option>
                    <option value="Destination">DESTINATION</option>
                  </select>
                </div>
                <select style={inputStyle} name="provenance" value={infos.provenance} onChange={handleInfosChange}>
                  {COUNTRIES.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <select 
                    style={{ background: 'none', border: 'none', padding: 0, margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: articles.length > 0 ? 'not-allowed' : 'pointer', outline: 'none' }}
                    name="autoColis"
                    value={infos.autoColis !== false ? 'auto' : 'manuel'}
                    onChange={(e) => setInfos(prev => ({...prev, autoColis: e.target.value === 'auto'}))}
                    disabled={articles.length > 0}
                    title={articles.length > 0 ? "Le mode ne peut pas être changé après avoir ajouté des articles." : "Choisissez comment les colis sont gérés"}
                  >
                    <option value="auto">NBRE COLIS (AUTO)</option>
                    <option value="manuel">NBRE COLIS (SAISIE)</option>
                  </select>
                </div>
                <input style={{...inputStyle, backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'not-allowed'}} name="nombreNatureColis" value={infos.nombreNatureColis} readOnly title="Calculé automatiquement depuis le tableau"/>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label style={labelStyle}>Poids Brut / Net</label>
                  <select
                    value={infos.modePoids || 'auto'}
                    onChange={e => setInfos(prev => ({ ...prev, modePoids: e.target.value }))}
                    style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    <option value="auto">⚙️ Auto</option>
                    <option value="manuel">✏️ Manuel</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <input style={inputStyle} placeholder="Brut" name="poidsBrut" value={infos.poidsBrut} onChange={handleInfosChange}/>
                  <input style={inputStyle} placeholder="Net" name="poidsNet" value={infos.poidsNet} onChange={handleInfosChange}/>
                </div>
                {parseFloat(valeurs.vFacture) > 0 && parseFloat(infos.poidsBrut) > 0 && infos.modePoids !== 'manuel' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Coef Poids: {parseFloat(infos.poidsBrut) / parseFloat(valeurs.vFacture)}
                  </div>
                )}
                {infos.modePoids === 'manuel' && (
                  <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '0.25rem', fontWeight: 600 }}>
                    ✏️ Poids saisis manuellement sur chaque article
                  </div>
                )}
              </div>
              <div><label style={labelStyle}>No vol ou Manifeste</label><input style={inputStyle} name="noVolOuVol" value={infos.noVolOuVol} onChange={handleInfosChange}/></div>
            </div>
          </div>

          {/* CARTE 2 : Devise de règlement */}
          <div style={{...cardStyle, marginBottom: 0}}>
            <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={sectionTitleStyle}><CreditCard size={18} color="var(--accent-primary)" /> Devise de règlement</h2>
            </div>

            <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Devise / Taux</label>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <select style={{...inputStyle, width: '45%', padding: '0.45rem 0.2rem'}} name="devise" value={infos.devise} onChange={handleInfosChange}>
                    {['XAF','EUR','USD','GBP','JPY','CNY','CAD','CHF','ZAR','AED','MAD','XOF','AUD','SGD','INR','BRL','RUB','NGN','KES','GHS'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input style={{...inputStyle, flex: 1}} name="tauxDevise" value={infos.tauxDevise} onChange={handleInfosChange}/>
                </div>
              </div>
              <div><label style={labelStyle}>Mode Règlement</label><input style={inputStyle} name="modeReglement" value={infos.modeReglement} onChange={handleInfosChange}/></div>
              <div><label style={labelStyle}>Mode d'opération</label><input style={inputStyle} name="typeOperation" value={infos.typeOperation} onChange={handleInfosChange} /></div>
              <div><label style={labelStyle}>Mode de Taxation</label><input style={inputStyle} name="modeTaxation" value={infos.modeTaxation} onChange={handleInfosChange} /></div>
              <div>
                <label style={labelStyle}>Mode Transport</label>
                <select style={inputStyle} name="modeTransport" value={infos.modeTransport} onChange={handleInfosChange}>
                  <option value="MER">MER</option>
                  <option value="AIR">AIR</option>
                </select>
              </div>
            </div>
          </div>

          {/* ASSISTANT DE CLASSEMENT DOUANIER (IA) */}
          <div style={{ ...cardStyle, padding: '1.5rem 2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <div style={{ width: 36, height: 36, backgroundColor: '#E51E4D', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} style={{ color: '#FFFFFF' }} />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>Recherche IA</h2>
            </div>
            <p style={{ margin: '0.25rem 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Décrivez votre produit en langage naturel pour obtenir un code SH provisoire.
            </p>

            <textarea
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Ex: Voiture essence 1200cm3 d'occasion année 2019"
              rows={3}
              style={{ width: '100%', resize: 'vertical', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', fontSize: '0.95rem', color: 'var(--text-primary)', outline: 'none', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box', lineHeight: '1.5' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button
                onClick={() => {
                  if (!aiQuery.trim()) return;
                  setAiLoading(true);
                  setAiResult({ code: '', explanation: '' });
                  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
                  if (!apiKey) { setAiResult({ code: '', explanation: '❌ Clé API Groq manquante' }); return; }
                  const prompt = `Tu es un expert en nomenclature douanière du CEMAC/Gabon. Pour ce produit: "${aiQuery}", donne le code SH sur 8 chiffres et une brève explication (chapitre, droits typiques). Réponds avec uniquement ce JSON (sans backticks ni markdown) : {"code":"XXXXXXXX","explanation":"..."}`;
                  fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.1 })
                  })
                  .then(async r => {
                    if (r.status === 429) { const errBody = await r.text(); setAiResult({ code: '', explanation: `❌ Quota dépassé (429): ${errBody.substring(0, 100)}` }); return; }
                    if (!r.ok) { const errBody = await r.text(); setAiResult({ code: '', explanation: `❌ Erreur ${r.status}: ${errBody.substring(0, 200)}` }); return; }
                    const data = await r.json();
                    const text = data?.choices?.[0]?.message?.content || '';
                    supabase.from('ai_queries').insert({ company_id: user?.companyId, user_id: user?.id, query: aiQuery, response: text }).then().catch(() => {});
                    if (!text) { setAiResult({ code: '', explanation: '❌ Réponse vide de l\'API' }); return; }
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      try { const parsed = JSON.parse(jsonMatch[0]); setAiResult({ code: parsed.code || '', explanation: parsed.explanation || text }); return; } catch { /* ignore */ }
                    }
                    setAiResult({ code: '', explanation: text });
                  })
                  .catch((err) => setAiResult({ code: '', explanation: `Erreur réseau : ${err.message}` }))
                  .finally(() => setAiLoading(false));
                }}
                disabled={aiLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '48px', padding: '0 28px', backgroundColor: aiLoading ? '#9CA3AF' : '#E51E4D', color: '#FFFFFF', border: 'none', borderRadius: '10px', cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', fontWeight: 600, fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
              >
                {aiLoading ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={18} />}
                {aiLoading ? 'Recherche en cours…' : 'Trouver le code SH'}
              </button>
              <button
                onClick={() => { setAiQuery(''); setAiResult({ code: '', explanation: '' }); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '48px', padding: '0 20px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}
              >
                Effacer
              </button>
            </div>

            {(aiResult.code || aiResult.explanation) && !aiLoading && (
              <div style={{ marginTop: '1.25rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '0.35rem' }}>Code SH proposé</div>
                    <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--accent-primary)', fontFamily: 'monospace', letterSpacing: '1.5px' }}>{aiResult.code || '—'}</div>
                  </div>
                  {aiResult.explanation && (
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '0.35rem' }}>Description</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>{aiResult.explanation}</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => {
                      if (aiResult.code && tariffs.length > 0) {
                        const keys = getTariffDisplay(tariffs[0]);
                        const cleanCode = aiResult.code.replace(/[\s.]/g, '');
                        const match = tariffs.find(t => {
                          const code = String(t[keys.codeSHKey] || '').replace(/[\s.]/g, '');
                          const cemac = keys.cemacKey ? String(t[keys.cemacKey] || '').replace(/[\s.]/g, '') : '';
                          return (code + cemac).padEnd(8, '0').substring(0, 8) === cleanCode;
                        });
                        if (match) selectTariff(match);
                        else {
                          setNewArticle({
                            id: Date.now(), codeSH: cleanCode, intitule: aiResult.explanation || '',
                            tauxDD: '0', unite: 'KGM', origine: infos.provenance || 'NC',
                            quantite: '1', valeur: '', pBrut: '', pNet: '', colis: '1', codeAdditionnel: '000',
                          });
                        }
                        setAiResult({ code: '', explanation: '' });
                        setAiQuery('');
                      }
                    }}
                    disabled={!aiResult.code}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px', padding: '0 22px', backgroundColor: '#E51E4D', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: !aiResult.code ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap', opacity: !aiResult.code ? 0.5 : 1 }}
                  >
                    <Plus size={16} />
                    Ajouter la marchandise
                  </button>
                  <button
                    onClick={() => setSearchTerm(aiResult.code)}
                    disabled={!aiResult.code}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px', padding: '0 18px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: !aiResult.code ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap', opacity: !aiResult.code ? 0.5 : 1 }}
                  >
                    Rechercher dans le tarif
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLONNE DROITE (25%) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* CARTE 4 : Note de valeurs */}
          <div style={{...cardStyle, marginBottom: 0, height: '100%'}}>
            <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={sectionTitleStyle}><FileText size={18} color="var(--accent-primary)" /> Note de valeurs</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={labelStyle}>INCOTERM</label>
                <select style={{...inputStyle, width: '50%'}} name="incoterm" value={infos.incoterm} onChange={handleInfosChange}>
                  {['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
                <div><label style={labelStyle}>V. FACTURE {infos.incoterm || 'FOB'} (Manuel)</label><input style={inputStyle} name="vFacture" type="number" placeholder="Auto (si vide)" value={valeurs.vFacture} onChange={handleValeursChange}/></div>
                <div><label style={labelStyle}>V. FACTURE CALC.</label><input style={{...inputStyle, backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)'}} readOnly title="Somme des valeurs FOB des articles" value={valeurs.vFactureCalculee} /></div>
              </div>
              
              <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
                <div><label style={labelStyle}>V. FRET</label><input style={inputStyle} name="vFret" type="number" value={valeurs.vFret} onChange={handleValeursChange}/></div>
                <div></div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{...labelStyle, marginBottom: 0, whiteSpace: 'nowrap'}}>V. ASSURANCE</label>
                    <select 
                      style={{ background: 'none', border: 'none', padding: 0, margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer', outline: 'none', textAlign: 'right' }}
                      name="modeAssurance"
                      value={valeurs.modeAssurance || 'auto'}
                      onChange={handleValeursChange}
                    >
                      <option value="auto">Auto (%)</option>
                      <option value="manuel">Manuel</option>
                    </select>
                  </div>
                  <input style={{...inputStyle, backgroundColor: valeurs.modeAssurance === 'manuel' ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: valeurs.modeAssurance === 'manuel' ? 'var(--text-primary)' : 'var(--text-muted)'}} name="vAssurance" type="number" value={valeurs.vAssurance} onChange={handleValeursChange} readOnly={valeurs.modeAssurance !== 'manuel'}/>
                </div>
                <div><label style={{...labelStyle, opacity: valeurs.modeAssurance === 'manuel' ? 0.5 : 1}}>Taux Ass. (%)</label><input style={{...inputStyle, backgroundColor: valeurs.modeAssurance === 'manuel' ? 'var(--bg-primary)' : 'var(--bg-secondary)', color: valeurs.modeAssurance === 'manuel' ? 'var(--text-muted)' : 'var(--text-primary)'}} name="tauxAssurance" type="number" value={valeurs.tauxAssurance} onChange={handleValeursChange} readOnly={valeurs.modeAssurance === 'manuel'}/></div>
              </div>

              <details style={{ cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.5rem' }} open>
                <summary style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Autres frais...</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div><label style={labelStyle}>V. COMISSION</label><input style={inputStyle} name="vCommission" value={valeurs.vCommission} onChange={handleValeursChange}/></div>
                  <div><label style={labelStyle}>V.AJUST</label><input style={inputStyle} name="vTauxAjust" value={valeurs.vTauxAjust} onChange={handleValeursChange}/></div>
                  <div><label style={labelStyle}>V. FRAIS DIVERS</label><input style={inputStyle} name="vFraisDivers" value={valeurs.vFraisDivers} onChange={handleValeursChange}/></div>
                </div>
              </details>

              {/* Totaux BLUE BLOCK (Maintenant Dark Theme) */}
              <div style={{ marginTop: '0.5rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '1rem' }}>CAF TOTAL</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Total en {infos.devise}</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.25rem' }}>
                    {formatNumberWithDots(valeurs.cafDevise, true) || '0.00'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem' }}>Total en CFA</div>
                  <div style={{ color: 'var(--accent-primary)', fontWeight: 800, fontSize: '1.5rem' }}>
                    {formatNumberWithDots(valeurs.cafCFA) || '0'}
                  </div>
                </div>
                {parseFloat(valeurs.cafCFA) > 0 && parseFloat(valeurs.vFacture) > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                    Coef CAF: {parseFloat(valeurs.vFacture) / parseFloat(valeurs.cafCFA)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* OUTILS MARCHANDISES */}
      <div style={{ ...cardStyle, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '14px', boxShadow: 'var(--shadow-sm)', padding: '18px 28px', minHeight: '95px' }}>
          
          {/* Bloc Marchandises */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '30px', flexShrink: 0 }}>
            <Package size={26} style={{ color: '#E51E4D' }} />
            <span style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>Marchandises</span>
          </div>

          {/* Champ de recherche */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                setSearchTerm(val);
                if (val.length >= 2 && tariffs.length > 0) {
                  const keys = getTariffDisplay(tariffs[0]);
                  const cleanSearch = val.toLowerCase().replace(/[\s.]/g, '');
                  const filtered = tariffs.filter(t => {
                    const code = String(t[keys.codeSHKey] || '').replace(/[\s.]/g, '');
                    const desc = String(t[keys.descKey] || '').toLowerCase();
                    return code.includes(cleanSearch) || desc.includes(val.toLowerCase());
                  }).slice(0, 10);
                  setSuggestions(filtered);
                } else {
                  setSuggestions([]);
                }
              }}
              placeholder="Rechercher dans la base (Code SH ou Intitulé)…"
              style={{ width: '100%', height: '58px', backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '10px', padding: '0 22px 0 52px', fontSize: '16px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: 'var(--shadow-lg)', zIndex: 50, maxHeight: '280px', overflowY: 'auto' }}>
                {suggestions.map((t, i) => {
                  const sKeys = getTariffDisplay(t);
                  const sCode = String(t[sKeys.codeSHKey] || '');
                  const sDesc = String(t[sKeys.descKey] || '');
                  const sTaux = String(t[sKeys.tauxKey] || '');
                  const sUnite = t[sKeys.uniteKey] || '';
                  const rawCodeSH = sCode.replace(/[\s.]/g, '');
                  const rawCemac = sKeys.cemacKey ? String(t[sKeys.cemacKey] || '').replace(/[\s.]/g, '') : '';
                  const fullCode = (rawCodeSH + rawCemac).padEnd(8, '0').substring(0, 8);
                  return (
                    <div
                      key={fullCode || i}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div
                        onClick={() => selectTariff(t)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace', whiteSpace: 'nowrap', fontSize: '14px', letterSpacing: '0.5px' }}>{fullCode}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sDesc}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap', marginLeft: 'auto' }}>{sTaux}%</span>
                        {sUnite && <span style={{ color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>{sUnite}</span>}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); openNoteExplicative(fullCode); }}
                        title="Voir la note explicative"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '6px', flexShrink: 0 }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-light)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <BookOpen size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bouton Rechercher */}
          <button
            onClick={() => {
              if (suggestions.length > 0) selectTariff(suggestions[0]);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '58px', padding: '0 32px', backgroundColor: '#E51E4D', color: '#FFFFFF', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 600, fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap', marginLeft: '16px', flexShrink: 0 }}
          >
            <Search size={18} style={{ color: '#FFFFFF' }} />
            Rechercher
          </button>

          {/* Bouton Ajouter manuellement */}
          <button
            onClick={() => {
              setNewArticle({
                id: Date.now(),
                codeSH: '',
                intitule: '',
                tauxDD: '0',
                origine: infos.provenance || 'NC',
                quantite: '1',
                valeur: '',
                pBrut: '',
                pNet: '',
                colis: '1',
                unite: 'KGM',
                codeAdditionnel: '000',
              });
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '58px', padding: '0 28px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 500, fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap', marginLeft: '14px', flexShrink: 0 }}
          >
            <Plus size={18} style={{ color: 'var(--text-primary)' }} />
            Ajouter manuellement
          </button>

        </div>

        {/* Formulaire d'ajout rapide (visible après sélection d'un tarif) */}
         {newArticle && (
           <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.2s ease-out' }}>
             <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Package size={18} /> Ajout d'Article : {newArticle.codeSH}
             </h3>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
               <div style={{ gridColumn: 'span 2' }}>
                 <label style={labelStyle}>Intitulé</label>
                 <input style={inputStyle} name="intitule" value={newArticle.intitule} onChange={handleNewArticleChange} />
               </div>
               <div>
                 <label style={labelStyle}>Taux DD (%)</label>
                 <input style={inputStyle} name="tauxDD" value={newArticle.tauxDD} onChange={handleNewArticleChange} />
               </div>
               <div>
                 <label style={labelStyle}>Origine</label>
                 <select style={inputStyle} name="origine" value={newArticle.origine} onChange={handleNewArticleChange}>
                   {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
               <div>
                 <label style={labelStyle}>Quantité</label>
                 <input style={inputStyle} type="number" name="quantite" value={newArticle.quantite} onChange={handleNewArticleChange} />
               </div>
               <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Valeur article</label>
                  <input style={{...inputStyle, borderColor: '#6b21a8'}} type="number" name="valeur" value={newArticle.valeur} onChange={handleNewArticleChange} placeholder="Ex: 1500" />
               </div>
               <div>
                 <label style={labelStyle}>Poids Brut (kg)</label>
                 <input 
                   style={infos.modePoids === 'manuel' ? inputStyle : {...inputStyle, backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'not-allowed'}} 
                   type="number" 
                   name="pBrut" 
                   value={infos.modePoids === 'manuel' ? (newArticle.pBrut || '') : (newArticle.valeur ? getCalculatedWeight(newArticle.valeur, 'brut') : '')} 
                   onChange={infos.modePoids === 'manuel' ? handleNewArticleChange : undefined}
                   readOnly={infos.modePoids !== 'manuel'} 
                   title={infos.modePoids === 'manuel' ? "Saisir le poids brut" : "Calculé automatiquement au prorata"} 
                 />
               </div>
               <div>
                 <label style={labelStyle}>Poids Net (kg)</label>
                 <input 
                   style={infos.modePoids === 'manuel' ? inputStyle : {...inputStyle, backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'not-allowed'}} 
                   type="number" 
                   name="pNet" 
                   value={infos.modePoids === 'manuel' ? (newArticle.pNet || '') : (newArticle.valeur ? getCalculatedWeight(newArticle.valeur, 'net') : '')} 
                   onChange={infos.modePoids === 'manuel' ? handleNewArticleChange : undefined}
                   readOnly={infos.modePoids !== 'manuel'} 
                   title={infos.modePoids === 'manuel' ? "Saisir le poids net" : "Calculé automatiquement au prorata"} 
                 />
               </div>
               <div>
                 <label style={labelStyle}>Nombre de Colis</label>
                 <input 
                   style={infos.autoColis !== false ? {...inputStyle, backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'not-allowed'} : inputStyle} 
                   type="number" 
                   name="colis" 
                   value={newArticle.colis} 
                   onChange={infos.autoColis !== false ? undefined : handleNewArticleChange}
                   readOnly={infos.autoColis !== false} 
                   title={infos.autoColis !== false ? "Fixé automatiquement à 1" : "Saisissez le nombre de colis"} 
                 />
               </div>
               <div>
                 <label style={labelStyle}>Unité</label>
                 <input style={inputStyle} name="unite" value={newArticle.unite} onChange={handleNewArticleChange} />
               </div>
               <div>
                 <label style={labelStyle}>Code additionnel</label>
                 <input style={inputStyle} name="codeAdditionnel" value={newArticle.codeAdditionnel ?? '000'} onChange={handleNewArticleChange} placeholder="Ex: 000" />
               </div>
               
               {/* Calcul temps réel V.Stat */}
               <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                 <div>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valeur Imposable (CFA) estimée</div>
                   <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatNumberWithDots(getArticleVStat(newArticle.valeur))} CFA</div>
                 </div>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setNewArticle(null)}
                      style={{ background: 'none', color: 'var(--danger)', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                      onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                      onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                      title="Annuler l'ajout"
                    >
                      <Trash2 size={20} />
                    </button>
                   <button 
                     onClick={addArticle}
                     className="premium-btn"
                     style={{ padding: '0.5rem 1rem' }}>
                     <Plus size={16} /> Ajouter à la note
                   </button>
                 </div>
               </div>
             </div>
           </div>
         )}
      </div>

      {/* ZONE BASSE : TABLEAU DES ARTICLES (100% de la largeur) */}
      <div style={{...cardStyle, padding: 0, overflow: 'hidden'}}>
        <div className="table-responsive-wrapper" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-secondary)' }}>
              <tr>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>Code SH</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>Intitulé</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>Origine</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>Qté</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>V.{infos.incoterm || 'FOB'}</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>P.Brut</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>P.Net</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>Colis</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>V.Stat</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>Add.</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>Taux</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>Unité</th>
                <th style={{ padding: '0.5rem 0.2rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)' }}></th>
              </tr>
            </thead>
            <tbody>
              {articles.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <Folder size={64} color="var(--border-color)" style={{ fill: 'var(--bg-tertiary)' }} />
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Aucune marchandise ajoutée</div>
                        <div style={{ color: 'var(--text-muted)' }}>Recherchez un Code SH ou ajoutez une marchandise manuellement pour commencer.</div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                visualGroups.result && visualGroups.result.articles.map((group, groupIdx) => {
                  const isMerged = group.originalIds && group.originalIds.length > 1;

                  const renderEditableRow = (art) => (
                    <tr key={art.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'transparent', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '0.4rem 0.2rem', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.85rem' }}>{String(art.codeSH).padEnd(8, '0').substring(0, 8)}</td>
                      <td style={{ padding: '0.4rem 0.2rem', lineHeight: '1.2', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }} title={art.intitule}>{art.intitule}</td>
                      <td style={{ padding: '0.4rem 0.2rem' }}>
                        <select value={art.origine} onChange={(e) => updateArticle(art.id, 'origine', e.target.value)} style={{...inputStyle, padding: '0.3rem', width: '90px', fontSize: '0.8rem'}}>
                          <option value="">--</option>
                          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '0.4rem 0.2rem' }}><input type="number" value={art.quantite || ''} onChange={(e) => updateArticle(art.id, 'quantite', e.target.value)} style={{...inputStyle, padding: '0.3rem', width: '60px', fontSize: '0.8rem'}} /></td>
                      <td style={{ padding: '0.4rem 0.2rem' }}><input type="number" value={art.valeur || ''} onChange={(e) => updateArticle(art.id, 'valeur', e.target.value)} style={{...inputStyle, padding: '0.3rem', width: '70px', fontSize: '0.8rem'}} /></td>
                      <td style={{ padding: '0.4rem 0.2rem' }}>
                        <input
                          type="number"
                          value={art.pBrut || ''}
                          readOnly={infos.modePoids !== 'manuel'}
                          onChange={infos.modePoids === 'manuel' ? (e) => updateArticle(art.id, 'pBrut', e.target.value) : undefined}
                          title={infos.modePoids === 'manuel' ? 'Saisir le poids brut' : 'Calculé automatiquement'}
                          style={infos.modePoids === 'manuel'
                            ? {...inputStyle, padding: '0.3rem', width: '60px', fontSize: '0.8rem'}
                            : {...inputStyle, padding: '0.3rem', width: '60px', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'not-allowed'}}
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.2rem' }}>
                        <input
                          type="number"
                          value={art.pNet || ''}
                          readOnly={infos.modePoids !== 'manuel'}
                          onChange={infos.modePoids === 'manuel' ? (e) => updateArticle(art.id, 'pNet', e.target.value) : undefined}
                          title={infos.modePoids === 'manuel' ? 'Saisir le poids net' : 'Calculé automatiquement'}
                          style={infos.modePoids === 'manuel'
                            ? {...inputStyle, padding: '0.3rem', width: '60px', fontSize: '0.8rem'}
                            : {...inputStyle, padding: '0.3rem', width: '60px', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'not-allowed'}}
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.2rem' }}>
                        <input 
                          type="number" 
                          value={art.colis || ''} 
                          onChange={infos.autoColis !== false ? undefined : (e) => updateArticle(art.id, 'colis', e.target.value)}
                          readOnly={infos.autoColis !== false} 
                          style={infos.autoColis !== false ? {...inputStyle, padding: '0.3rem', width: '50px', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'not-allowed'} : {...inputStyle, padding: '0.3rem', width: '50px', fontSize: '0.8rem'}} 
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.2rem', fontWeight: 600, color: 'var(--success)', fontSize: '0.85rem' }}>{formatNumberWithDots(getArticleVStat(art.valeur))}</td>
                      <td style={{ padding: '0.4rem 0.2rem' }}><input value={art.codeAdditionnel ?? '000'} onChange={(e) => updateArticle(art.id, 'codeAdditionnel', e.target.value)} style={{...inputStyle, width: '45px', padding: '0.3rem', fontSize: '0.8rem'}} /></td>
                      <td style={{ padding: '0.4rem 0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                          <input type="number" value={String(art.tauxDD).replace('%','')} onChange={(e) => updateArticle(art.id, 'tauxDD', e.target.value)} style={{...inputStyle, width: '40px', padding: '0.3rem', fontSize: '0.8rem'}} />
                          <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>%</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.4rem 0.2rem' }}><input value={art.unite || ''} onChange={(e) => updateArticle(art.id, 'unite', e.target.value)} style={{...inputStyle, width: '50px', padding: '0.3rem', fontSize: '0.8rem'}} /></td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => duplicateArticle(art)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--accent-primary)', cursor: 'pointer', padding: '0.4rem', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--accent-light)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }} title="Dupliquer l'article">
                            <Copy size={16} />
                          </button>
                          <button onClick={() => removeArticle(art.id)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--accent-light)'; e.currentTarget.style.borderColor = 'var(--danger)'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }} title="Supprimer l'article">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );

                  if (!isMerged) {
                    const art = articles.find(a => a.id === (group.originalIds && group.originalIds[0]));
                    return art ? renderEditableRow(art) : null;
                  } else {
                    const originalRows = group.originalIds.map(id => {
                      const art = articles.find(a => a.id === id);
                      return art ? renderEditableRow(art) : null;
                    });

                    let color = 'rgba(255, 255, 255, 0.05)';
                    let badge = '';
                    if (visualGroups.result.level === 1) color = groupIdx % 2 === 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)'; // Dark Vert
                    else if (visualGroups.result.level === 2) color = groupIdx % 2 === 0 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.1)'; // Dark Jaune
                    else if (visualGroups.result.level === 3) color = groupIdx % 2 === 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.15)'; // Dark Rouge
                    else if (visualGroups.result.level === 4) color = groupIdx % 2 === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.2)'; // Dark Rouge
                    badge = `Niv.${visualGroups.result.level}`;

                    const summaryRow = (
                      <tr key={`summary-${groupIdx}`} style={{ backgroundColor: color, borderBottom: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          {String(group.codeSH).padEnd(8, '0').substring(0, 8)} <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Position fusionnée)</div>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 'bold', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={group.intitule}>{group.intitule}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{group.origine}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{group.quantite}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{Number(group.valeur).toFixed(2)}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{group.pBrut}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{group.pNet}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{group.colis}</td>
                        <td style={{ padding: '1rem', color: 'var(--success)', fontWeight: 'bold' }}>{formatNumberWithDots(group.valeurImposable)}</td>
                        <td style={{ padding: '0.4rem' }}></td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{group.tauxDouane}%</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{group.unite}</td>
                        <td style={{ padding: '1rem' }}></td>
                      </tr>
                    );

                    return (
                      <React.Fragment key={`group-${groupIdx}`}>
                        {originalRows}
                        {summaryRow}
                      </React.Fragment>
                    );
                  }
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL LECTEUR PDF RAPIDE */}
      {pdfViewerDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ width: '90%', maxWidth: '1200px', height: '90%', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={18}/> Consultation Rapide</h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b', backgroundColor: '#e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #cbd5e1' }}>
                  <Search size={14} /> Astuce: Utilisez <kbd style={{ fontFamily: 'monospace', backgroundColor: 'white', border: '1px solid #94a3b8', padding: '0.1rem 0.4rem', borderRadius: '4px', color: '#334155', fontWeight: 'bold', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>Ctrl + F</kbd> pour rechercher
                </span>
              </div>
              <button onClick={() => setPdfViewerDoc(null)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem', borderRadius: '50%' }} title="Fermer">
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <div style={{ flex: 1, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
              <CustomPDFViewer file={pdfViewerDoc} />
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT MODAL */}
      {customAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {customAlert.type === 'success' && <div style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '0.75rem', borderRadius: '50%' }}><CheckCircle size={28} /></div>}
              {customAlert.type === 'error' && <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: '50%' }}><AlertCircle size={28} /></div>}
              {customAlert.type === 'confirm' && <div style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '0.75rem', borderRadius: '50%' }}><Save size={28} /></div>}
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 600 }}>{customAlert.title}</h3>
            </div>
            
            <p style={{ margin: 0, color: '#475569', lineHeight: '1.5', fontSize: '0.95rem' }}>{customAlert.message}</p>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              {customAlert.type === 'confirm' && (
                <button 
                  onClick={customAlert.onCancel}
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  Annuler
                </button>
              )}
              <button 
                onClick={customAlert.onConfirm}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: customAlert.type === 'error' ? '#dc2626' : '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              >
                {customAlert.type === 'confirm' ? 'Restaurer' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NoteForm;
