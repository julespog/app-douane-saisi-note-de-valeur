import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, Plus, Trash2, Save, Download, 
  Printer, BookOpen, FileText, CheckCircle, Package, CreditCard, AlertCircle, Folder, Lock, Copy, Bot, GraduationCap, RefreshCw, ClipboardCopy
} from 'lucide-react';
import { applyGroupingLogic } from '../utils/groupingLogic';
import { COUNTRIES } from '../utils/countries';
import { useNavigate, useLocation } from 'react-router-dom';
import NoteDocument from '../components/NoteDocument';
import { DatabaseContext } from '../context/DatabaseContext';
import { UserContext } from '../context/UserContext';
import { supabase, customFetch } from '../supabaseClient';
import CustomPDFViewer from '../components/CustomPDFViewer';
import CodeAdditionnelSelect from '../components/CodeAdditionnelSelect';
import CodeListSelect from '../components/CodeListSelect';
import REGIMES_ETENDUS from '../data/regimesEtendus.json';
import MODELES_DECLARATION from '../data/modelesDeclaration.json';
import CODES_ADDITIONNELS from '../data/codesAdditionnels.json';

const MODELE_OPTIONS = MODELES_DECLARATION.map(m => ({ code: m.code, libelle: m.libelle, detail: m.series ? `Séries ${m.series}` : '' }));
const REGIME_OPTIONS = REGIMES_ETENDUS.map(r => ({ code: r.code, libelle: r.libelle }));
const CODE_ADD_OPTIONS = CODES_ADDITIONNELS.map(c => ({ code: c.code, libelle: c.libelle, detail: c.baseLegale }));
const CODES_ADD_CONNUS = new Set(CODES_ADDITIONNELS.map(c => c.code));
// Code Add d'en-tête valide : 1 à 4 codes officiels séparés par « - » (ex. 605-603).
const isCodeAddEnteteValide = (v) => {
  const parts = String(v || '').split('-').map(s => s.trim().toUpperCase()).filter(Boolean);
  return parts.length > 0 && parts.length <= MAX_CODES_ADD_ENTETE && parts.every(p => CODES_ADD_CONNUS.has(p));
};
import { distributeTotals } from '../utils/weightDistribution';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';

const INITIAL_INFOS = {
  noDossier: '', noOT: '', noCDEMarque: '', noRepertoire: '',
  noSTRedevable: '', noSTDestination: '',
  typeLTA_CNT: 'No LTA', valLTA_CNT: '',
  typeLieu: 'Provenance', provenance: 'Afghanistan', nombreNatureColis: '', poidsBrut: '', poidsNet: '', noVolOuVol: '',
  devise: 'EUR', tauxDevise: '655.957', modeReglement: '01',
  typeOperation: 'IM4', modeTaxation: '4000 / 000', modeTransport: 'MER', incoterm: 'FOB',
  // « Mode de Taxation » = Régime étendu + Code Add de l'en-tête (recomposé automatiquement,
  // conservé pour la note imprimée et les archives). codeAddManuel : l'utilisateur a saisi
  // lui-même le Code Add ; sinon il est déduit des codes additionnels des marchandises.
  regimeEtendu: '4000', codeAddEntete: '000', codeAddManuel: false,
  autoColis: true, modePoids: 'auto'
};

// Nombre maximum de codes additionnels affichables dans le Code Add de l'en-tête.
const MAX_CODES_ADD_ENTETE = 4;

// Codes additionnels distincts utilisés par les marchandises, dans l'ordre d'apparition.
const getCodesAddUtilises = (articles) => {
  const seen = [];
  (articles || []).forEach(a => {
    const c = String(a?.codeAdditionnel ?? '').trim().toUpperCase() || '000';
    if (!seen.includes(c)) seen.push(c);
  });
  return seen;
};

// Complète un en-tête chargé (brouillon, archive) : les anciennes notes n'ont que
// « modeTaxation » (ex. "4000 / 605-603") ; on le découpe en Régime étendu + Code Add,
// en gardant le Code Add tel qu'il avait été saisi (mode manuel).
const normalizeInfos = (dInfos) => {
  const merged = { ...INITIAL_INFOS, ...dInfos };
  if (dInfos && dInfos.regimeEtendu === undefined) {
    const [reg, add] = String(dInfos.modeTaxation || '').split('/').map(s => s.trim());
    merged.regimeEtendu = reg || INITIAL_INFOS.regimeEtendu;
    merged.codeAddEntete = add || '000';
    merged.codeAddManuel = Boolean(add);
  }
  return merged;
};

const INITIAL_VALEURS = {
  vFacture: '', vFactureCalculee: '', vFret: '', vAssurance: '',
  vFretDevise: 'EUR', vFretTaux: '655.957',
  vFraisDevise: 'EUR', vFraisTaux: '655.957',
  tauxAssurance: '0.05', vCommission: '', vTauxAjust: '', vFraisDivers: '',
  cafDevise: '', cafCFA: '', modeAssurance: 'auto'
};

const CURRENCY_RATES = {
  XAF: 1, XOF: 1, EUR: 0.001524, USD: 0.00166,
  GBP: 0.00131, JPY: 0.248, CNY: 0.0120, CAD: 0.00228,
  CHF: 0.00148, ZAR: 0.0308, AED: 0.00610, MAD: 0.0165,
  AUD: 0.00255, SGD: 0.00223, INR: 0.138, BRL: 0.00830,
  RUB: 0.152, NGN: 2.52, KES: 0.214, GHS: 0.0255
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
      if (dInfos) setInfos(normalizeInfos(dInfos));
      if (dVal) setValeurs({...INITIAL_VALEURS, ...dVal});
      if (dArt) setArticles(dArt);
    } else if (location.state?.archiveData) {
      const { infos: dInfos, valeurs: dVal } = location.state.archiveData;
      const dArt = location.state.archiveData.rawArticles || location.state.archiveData.articles;
      if (dInfos) setInfos(normalizeInfos(dInfos));
      if (dVal) setValeurs({...INITIAL_VALEURS, ...dVal});
      if (dArt) setArticles(dArt);
    } else {
      // Sinon, on tente de récupérer le brouillon local de l'entreprise
      const savedDraft = localStorage.getItem(`noteDraft_${user?.companyId || 'default'}`);
      if (savedDraft) {
        const { infos: dInfos, valeurs: dVal, articles: dArt } = JSON.parse(savedDraft);
        if (dInfos) setInfos(normalizeInfos(dInfos));
        if (dVal) setValeurs({...INITIAL_VALEURS, ...dVal});
        if (dArt) setArticles(dArt);
      }
    }
  }, [location.state, user]);

  // Code Add de l'en-tête : récapitulatif automatique des codes additionnels des
  // marchandises (chaque code une seule fois, 4 au maximum, séparés par « - »),
  // sauf si l'utilisateur l'a saisi manuellement. « Mode de Taxation » est recomposé
  // à partir du Régime étendu et du Code Add (utilisé par la note imprimée et les archives).
  const codesAddUtilises = useMemo(() => getCodesAddUtilises(articles), [articles]);
  const codesAddHorsEntete = codesAddUtilises.slice(MAX_CODES_ADD_ENTETE);

  // Régime étendu : son 1er chiffre correspond au numéro du modèle (EX1 → 1xxx, IM4 → 4xxx…).
  // Les régimes du modèle choisi sont proposés en premier ; les autres restent possibles.
  const modeDigit = (String(infos.typeOperation || '').match(/(\d)\s*$/) || [])[1] ?? '';
  const regimeGroup = useCallback((o) => (modeDigit !== '' && o.code[0] === modeDigit ? 0 : 1), [modeDigit]);
  const regimeWarning = modeDigit !== '' && /^\d{4}$/.test(String(infos.regimeEtendu || '')) && infos.regimeEtendu[0] !== modeDigit
    ? `Régime inhabituel pour le modèle ${infos.typeOperation} (attendu : ${modeDigit}xxx)`
    : '';
  useEffect(() => {
    setInfos(prev => {
      const codeAdd = prev.codeAddManuel
        ? prev.codeAddEntete
        : (codesAddUtilises.length ? codesAddUtilises.slice(0, MAX_CODES_ADD_ENTETE).join('-') : '000');
      const modeTaxation = `${prev.regimeEtendu || ''} / ${codeAdd || '000'}`;
      if (codeAdd === prev.codeAddEntete && modeTaxation === prev.modeTaxation) return prev;
      return { ...prev, codeAddEntete: codeAdd, modeTaxation };
    });
  }, [codesAddUtilises, infos.codeAddManuel, infos.regimeEtendu, infos.codeAddEntete]);

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // AI product search state
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState({ code: '', libelle: '', explanation: '', taux: '', imageUrl: '', model: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImageZoomed, setAiImageZoomed] = useState(false);


  // Nouveau state pour l'article en cours d'ajout
  const [newArticle, setNewArticle] = useState(null);

  // Découpe l'explication Markdown de l'IA en sections (titres ###) :
  // - description : texte avant le 1er titre + section « Description détaillée »
  // - regles      : section « Règles de classification »
  // - sections    : autres sections autorisées (Niveau de certitude, Recommandation…)
  const splitClassificationRules = (markdown) => {
    const text = String(markdown || '');
    const headingRe = /^[ \t]*#{1,6}[ \t]*(?:\d+[.)][ \t]*)?\**[ \t]*([^\n#*][^\n]*?)\**[ \t]*$/gm;
    const isDescription = (t) => /^description/i.test(t);
    const isRegles = (t) => /^r[èeé]gles?\s+(?:g[ée]n[ée]rales\s+)?(?:de\s+classification|de\s+classement|interpr[ée]tatives)|^justification/i.test(t);
    const isExcludedSection = (t) => /(position[s]?\s*[ée]cart[ée]e|point[s]?\s*de\s*vigilance|vigilance|information[s]?\s*manquante[s]?|manquant)/i.test(t);
    const matches = [...text.matchAll(headingRe)];
    if (matches.length === 0) return { description: text.trim(), regles: '', sections: [] };

    let description = text.slice(0, matches[0].index).trim();
    let regles = '';
    const sections = [];
    matches.forEach((m, i) => {
      const title = m[1].replace(/[:：]\s*$/, '').trim();
      const body = text.slice(m.index + m[0].length, i + 1 < matches.length ? matches[i + 1].index : text.length).trim();
      if (!body) return;
      if (isDescription(title)) description = [description, body].filter(Boolean).join('\n\n');
      else if (isRegles(title)) regles = [regles, body].filter(Boolean).join('\n\n');
      else if (isExcludedSection(title)) return;
      else sections.push({ title, body });
    });
    return { description, regles, sections };
  };

  // Couleur du bloc selon le titre de section (certitude, recommandation…)
  const aiSectionAccent = (title, body) => {
    if (/certitude/i.test(title)) {
      const lvl = String(body).replace(/[*_\s]/g, '').toLowerCase();
      if (lvl.startsWith('élevé') || lvl.startsWith('eleve')) return '#059669';
      if (lvl.startsWith('moyen')) return '#d97706';
      if (lvl.startsWith('faible')) return '#dc2626';
    }
    return '#2563eb';
  };

  // Récupère code/libellé/taux/explication même si le JSON de l'IA est coupé
  // (réponse tronquée par la limite de tokens du modèle).
  const salvageTruncatedAiJson = (text) => {
    const field = (k) => {
      const m = text.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (!m) return '';
      try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; }
    };
    let explanation = '';
    const start = text.match(/"explanation"\s*:\s*"/);
    if (start) {
      let raw = text.slice(start.index + start[0].length);
      raw = raw.replace(/"\s*\}?\s*(?:```)?\s*$/, '').replace(/\\$/, '');
      try { explanation = JSON.parse(`"${raw}"`); }
      catch { explanation = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
    }
    return { code: field('code'), libelle: field('libelle'), taux: field('taux'), explanation };
  };

  const handlePrintAiResult = () => {
    if (!aiResult.code && !aiResult.explanation) return;
    document.body.classList.add('printing-ai-result');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-ai-result');
    }, 1000);
  };

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
    
    const tauxDev = parseNumber(infos.tauxDevise) || 1;
    const fretTaux = parseNumber(valeurs.vFretTaux) || 1;
    const fraisTaux = parseNumber(valeurs.vFraisTaux) || 1;
    const tauxAss = parseNumber(valeurs.tauxAssurance);
    const commission = parseNumber(valeurs.vCommission);
    const fraisDivers = parseNumber(valeurs.vFraisDivers);
    const ajustement = parseNumber(valeurs.vTauxAjust);

    // Chaque composant est converti dans sa propre devise vers le FCFA
    const factureCFA = facture * tauxDev;
    const fretCFA = parseNumber(valeurs.vFret) * fretTaux;
    const fraisCFA = fraisDivers * fraisTaux;
    const commissionCFA = commission * tauxDev;
    const ajustementCFA = ajustement * tauxDev;

    // L'assurance est toujours en FCFA (aucun taux de conversion)
    let assuranceCFA = 0;
    if (valeurs.modeAssurance === 'manuel') {
      assuranceCFA = parseNumber(valeurs.vAssurance);
    } else {
      assuranceCFA = (factureCFA + fretCFA + fraisCFA) * (tauxAss / 100);
    }

    // CAF total en FCFA (addition directe des montants convertis, plus de conversion globale)
    const cafC = factureCFA + fretCFA + fraisCFA + assuranceCFA + commissionCFA - ajustementCFA;

    // CAF en devise : affiché uniquement si TOUS les éléments partagent la même devise.
    // L'assurance étant fixe en FCFA, la devise commune doit être le FCFA (XAF/XOF).
    const allSameCurrency = (valeurs.vFretDevise || infos.devise) === infos.devise
      && (valeurs.vFraisDevise || infos.devise) === infos.devise
      && (infos.devise === 'XAF' || infos.devise === 'XOF');
    const cafDevise = allSameCurrency ? cafC.toFixed(2) : '';

    setValeurs(prev => {
      const newState = {
        ...prev,
        vFactureCalculee: totalFOBArticles.toFixed(2),
        cafDevise,
        cafCFA: cafC.toFixed(0)
      };
      if (prev.modeAssurance !== 'manuel') {
        newState.vAssurance = assuranceCFA.toFixed(2);
      }
      return newState;
    });
  }, [valeurs.vFacture, valeurs.vFret, valeurs.vFretTaux, valeurs.vFretDevise, valeurs.vFraisDivers, valeurs.vFraisTaux, valeurs.vFraisDevise, valeurs.tauxAssurance, valeurs.vCommission, valeurs.vTauxAjust, valeurs.modeAssurance, valeurs.vAssurance, infos.tauxDevise, infos.devise, articles]);

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
        
        <button className="premium-btn-secondary" style={{ marginLeft: '1rem' }} onClick={() => setPdfViewerDoc('/DOCUMENTATION S DOUANE/Code des Douanes Gabonais/Code_des_Douanes.pdf')}>
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
              <div>
                <label style={labelStyle}>Mode d'opération</label>
                <CodeListSelect
                  options={MODELE_OPTIONS} noun="modèles de déclaration" placeholder="IM4"
                  style={inputStyle} showLabel
                  value={infos.typeOperation}
                  onChange={(v) => setInfos(prev => ({ ...prev, typeOperation: v.replace(/\s+/g, '') }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Régime étendu</label>
                <CodeListSelect
                  options={REGIME_OPTIONS} noun="régimes étendus" placeholder="4000"
                  style={inputStyle} showLabel
                  value={infos.regimeEtendu}
                  onChange={(v) => setInfos(prev => ({ ...prev, regimeEtendu: v }))}
                  group={regimeGroup}
                  firstGroupLabel={modeDigit !== '' ? `Régimes du modèle ${infos.typeOperation}` : undefined}
                  otherGroupLabel={modeDigit !== '' ? 'Autres régimes' : undefined}
                  warning={regimeWarning}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Code Add</span>
                  {infos.codeAddManuel ? (
                    <button
                      type="button"
                      onClick={() => setInfos(prev => ({ ...prev, codeAddManuel: false }))}
                      title="Revenir au calcul automatique à partir des codes additionnels des marchandises"
                      style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0 6px', fontSize: '0.68rem', color: 'var(--accent-primary)', cursor: 'pointer', textTransform: 'none' }}
                    >↺ Auto</button>
                  ) : (
                    <span style={{ fontSize: '0.66rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'none' }}>auto</span>
                  )}
                </label>
                <CodeListSelect
                  options={CODE_ADD_OPTIONS} noun="codes additionnels" placeholder="000"
                  style={inputStyle}
                  value={infos.codeAddEntete}
                  onChange={(v) => setInfos(prev => ({ ...prev, codeAddEntete: v, codeAddManuel: true }))}
                  isKnown={isCodeAddEnteteValide}
                  warning={codesAddHorsEntete.length && !infos.codeAddManuel
                    ? `${codesAddUtilises.length} codes utilisés : seuls les ${MAX_CODES_ADD_ENTETE} premiers sont repris (non repris : ${codesAddHorsEntete.join(', ')})`
                    : ''}
                  showLabel
                />
              </div>
              <div>
                <label style={labelStyle}>Mode Transport</label>
                <select style={inputStyle} name="modeTransport" value={infos.modeTransport} onChange={handleInfosChange}>
                  <option value="MER">MER</option>
                  <option value="AIR">AIR</option>
                </select>
              </div>
            </div>
          </div>

          {/* RECHERCHE IA */}
          <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
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
                  setAiResult({ code: '', libelle: '', explanation: '', taux: '', imageUrl: '' });
                  const prompt = `RÔLE
Tu es un expert en nomenclature douanière avec plus de 20 ans d'expérience dans le classement tarifaire selon le Système Harmonisé (SH) de l'Organisation Mondiale des Douanes et le Tarif Extérieur Commun (TEC) de la CEMAC (application au Gabon). Tu maîtrises les Règles Générales Interprétatives (RGI), les Notes de Sections et de Chapitres, les Notes explicatives du SH et les avis de classement de l'OMD.

MISSION
Détermine le code tarifaire exact du produit décrit ci-dessous. Justifie chaque étape de ton raisonnement avec la rigueur d'un dossier de contentieux douanier.

PRODUIT À CLASSER (description saisie par le déclarant) :
"${aiQuery}"
Les éléments non fournis (composition, usage, présentation, origine…) sont à considérer comme NON PRÉCISÉS.

MÉTHODE
1. Analyse la nature, la matière constitutive, la fonction et le degré d'élaboration du produit.
2. Identifie la Section et le Chapitre, en citant les Notes applicables et leurs exclusions.
3. Applique les RGI dans l'ordre, de la RGI 1 à la RGI 6, et indique à quelle règle le classement est arrêté et pourquoi.
4. Cite les Notes explicatives, avis de classement OMD ou décisions pertinents. Signale toute référence dont tu n'es pas certain.
5. Si une information déterminante manque, propose le classement le plus probable SOUS RÉSERVE et abaisse le niveau de certitude en conséquence.

RÈGLES
- Utilise la nomenclature SH édition 2022 et le TEC CEMAC ; précise l'édition utilisée. Ne cite AUCUNE autre législation (UE, Canada, etc.).
- Classe toujours d'après la nature objective du produit, jamais d'après sa seule désignation commerciale.
- Distingue clairement ce qui est certain de ce qui relève de l'interprétation.
- Réponds en français, avec la terminologie douanière officielle.
- Le libellé doit être le VRAI libellé tarifaire officiel CEMAC tel qu'il figure sur la déclaration en douane : ne reprends JAMAIS textuellement les mots saisis par le déclarant.
- Le taux de Droit de Douane (DD) suit les 4 catégories CEMAC (Cat. 1 : 5 %, Cat. 2 : 10 %, Cat. 3 : 20 %, Cat. 4 : 30 %).
- Sois CONCIS : 2 à 5 puces courtes par section. La réponse complète doit rester courte.

FORMAT DE RÉPONSE
Réponds UNIQUEMENT avec un objet JSON valide contenant exactement ces 4 clés :
"code" : sous-position TEC CEMAC complète à 8 chiffres (ex : "87032110")
"libelle" : libellé tarifaire officiel CEMAC de cette sous-position
"taux" : taux DD (ex : "30%")
"explanation" : texte Markdown contenant UNIQUEMENT les sections suivantes, dans cet ordre et avec EXACTEMENT ces titres :
### Description détaillée
(nature, matière, fonction, degré d'élaboration ; Section et Chapitre avec leurs Notes et exclusions ; code SH 6 chiffres et son libellé officiel ; sous-position TEC CEMAC complète et son libellé ; édition SH utilisée)
### Règles de classification
(RGI appliquées dans l'ordre de 1 à 6 en indiquant celle où le classement est arrêté et pourquoi ; Notes explicatives et avis OMD pertinents, en signalant toute référence incertaine)
### Niveau de certitude
(commence par « Élevé », « Moyen » ou « Faible », puis explique ; distingue le certain de l'interprétation)
### Recommandation
(si la certitude n'est pas élevée, conseille une demande de renseignement tarifaire préalable auprès de la douane)`;
                  const apiBase = (typeof window !== 'undefined' && !window.location.origin.includes('gnamatech.com')) ? 'https://gnamatech.com' : '';
                  customFetch(`${apiBase}/api/ai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: prompt, query: aiQuery })
                  })
                  .then(async r => {
                    if (r.status === 429) { const errBody = await r.text(); setAiResult({ code: '', libelle: '', explanation: `❌ Quota dépassé (429): ${errBody.substring(0, 100)}`, imageUrl: '' }); return; }
                    if (!r.ok) { const errBody = await r.text(); setAiResult({ code: '', libelle: '', explanation: `❌ Erreur ${r.status}: ${errBody.substring(0, 200)}`, imageUrl: '' }); return; }
                    const data = await r.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const rawImage = data?.imageUrl || '';
                    const foundImage = rawImage && !rawImage.startsWith('http') ? `${apiBase}${rawImage}` : rawImage;
                    const usedModel = data?.model || '';
                    supabase.from('ai_queries').insert({ company_id: user?.companyId || user?.company_id, user_id: user?.id, query: aiQuery, response: text }).then(({ error }) => { if (error) console.error('AI log error:', error); }).catch(err => console.error('AI log catch:', err));
                    if (!text) { setAiResult({ code: '', libelle: '', explanation: '❌ Réponse vide de l\'API Claude (Anthropic)', imageUrl: '', model: '' }); return; }

                    let parsedCode = '';
                    let parsedLibelle = '';
                    let parsedTaux = '';
                    let parsedExplanation = text;
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    let jsonOk = false;
                    if (jsonMatch) {
                      try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        parsedCode = parsed.code || '';
                        parsedLibelle = parsed.libelle || '';
                        parsedTaux = parsed.taux || '';
                        parsedExplanation = parsed.explanation || text;
                        jsonOk = true;
                      } catch { /* JSON invalide : tentative de récupération ci-dessous */ }
                    }
                    if (!jsonOk && /"explanation"\s*:/.test(text)) {
                      const s = salvageTruncatedAiJson(text);
                      if (s.code || s.explanation) {
                        parsedCode = s.code; parsedLibelle = s.libelle; parsedTaux = s.taux;
                        parsedExplanation = (s.explanation || '') + '\n\n> ⚠️ Réponse de l\'IA incomplète (coupée). Relancez la recherche si une section manque.';
                      }
                    }

                    if (parsedCode && typeof tariffs !== 'undefined' && tariffs.length > 0) {
                      const keys = getTariffDisplay(tariffs[0]);
                      const cleanCode = parsedCode.replace(/[\s.]/g, '');
                      let match = tariffs.find(t => {
                        const code = String(t[keys.codeSHKey] || '').replace(/[\s.]/g, '');
                        const cemac = keys.cemacKey ? String(t[keys.cemacKey] || '').replace(/[\s.]/g, '') : '';
                        return (code + cemac).padEnd(8, '0').substring(0, 8) === cleanCode;
                      });
                      if (!match && cleanCode.length >= 6) {
                        const clean6 = cleanCode.substring(0, 6);
                        match = tariffs.find(t => {
                          const code = String(t[keys.codeSHKey] || '').replace(/[\s.]/g, '');
                          return code.substring(0, 6) === clean6;
                        });
                      }
                      if (match) {
                        const rawCodeSH = String(match[keys.codeSHKey] || '').replace(/[\s.]/g, '');
                        const rawCemac = keys.cemacKey ? String(match[keys.cemacKey] || '').replace(/[\s.]/g, '') : '';
                        const realCode = (rawCodeSH + rawCemac).padEnd(8, '0').substring(0, 8);
                        if (parsedCode && parsedCode !== realCode) {
                          parsedExplanation = parsedExplanation.replace(new RegExp(parsedCode, 'g'), realCode);
                        }
                        parsedCode = realCode;
                        if (keys.descKey && match[keys.descKey]) {
                          parsedLibelle = String(match[keys.descKey]).trim() || parsedLibelle;
                        }
                        if (keys.tauxKey && match[keys.tauxKey] !== undefined) {
                          const rawT = String(match[keys.tauxKey]).replace(/[^0-9.]/g, '');
                          if (rawT) parsedTaux = `${rawT}%`;
                        }
                      }
                    }

                    const { description, regles, sections } = splitClassificationRules(parsedExplanation);
                    setAiResult({ code: parsedCode, libelle: parsedLibelle, taux: parsedTaux, explanation: description, regles, sections, imageUrl: foundImage, model: usedModel });
                  })
                  .catch((err) => setAiResult({ code: '', libelle: '', explanation: `Erreur réseau : ${err.message}`, imageUrl: '', model: '' }))
                  .finally(() => setAiLoading(false));
                }}
                disabled={aiLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '48px', padding: '0 28px', backgroundColor: aiLoading ? '#9CA3AF' : '#E51E4D', color: '#FFFFFF', border: 'none', borderRadius: '10px', cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'background 0.15s' }}
              >
                {aiLoading ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={18} />}
                {aiLoading ? 'Recherche en cours…' : 'Trouver le code SH'}
              </button>
              <button
                onClick={() => { setAiQuery(''); setAiResult({ code: '', libelle: '', explanation: '', taux: '', imageUrl: '', model: '' }); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '48px', padding: '0 20px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap' }}
              >
                Effacer
              </button>
            </div>

            {(aiResult.code || aiResult.explanation) && !aiLoading && (
              <div style={{ marginTop: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem' }}>
                {/* Ligne du haut : Code SH, Taux DD et Image */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '0.35rem' }}>Code SH proposé</div>
                    <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--accent-primary)', fontFamily: 'monospace', letterSpacing: '1.5px' }}>{aiResult.code || '—'}</div>
                  </div>
                  {aiResult.taux && (
                    <div style={{ flexShrink: 0, paddingLeft: '1.25rem', borderLeft: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '0.35rem' }}>Droit de Douane (DD)</div>
                      <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#10B981', fontFamily: 'monospace', letterSpacing: '1px' }}>
                        {aiResult.taux.includes('%') ? aiResult.taux : `${aiResult.taux}%`}
                      </div>
                    </div>
                  )}
                  {aiResult.imageUrl && (
                    <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <div
                        onClick={() => setAiImageZoomed(true)}
                        title="Cliquer pour agrandir"
                        style={{ width: '130px', height: '90px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'zoom-in', position: 'relative' }}
                      >
                        <img
                          src={aiResult.imageUrl}
                          alt={aiQuery || "Produit"}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={(e) => { if (e.currentTarget?.parentElement?.parentElement) e.currentTarget.parentElement.parentElement.style.display = 'none'; }}
                        />
                        <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '2px 5px', fontSize: '0.65rem', color: '#fff', pointerEvents: 'none' }}>🔍 Agrandir</div>
                      </div>
                      {aiImageZoomed && (
                        <div
                          onClick={() => setAiImageZoomed(false)}
                          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                        >
                          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                            <img
                              src={aiResult.imageUrl}
                              alt={aiQuery || "Produit"}
                              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.7)', display: 'block' }}
                            />
                            <div style={{ textAlign: 'center', color: '#fff', marginTop: '10px', fontSize: '0.9rem', opacity: 0.8 }}>{aiQuery || "Produit"}</div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setAiImageZoomed(false); }}
                              style={{ position: 'absolute', top: '-14px', right: '-14px', background: '#E51E4D', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
                            >✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section centrale : Description détaillée sur toute la largeur */}
                {aiResult.explanation && (
                  <div style={{ width: '100%' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Description détaillée</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.6' }} className="markdown-container">
                      <ReactMarkdown>{aiResult.explanation}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Règles de classification appliquées (RGI) */}
                {aiResult.regles && (
                  <div style={{ width: '100%', marginTop: '1rem', padding: '0.9rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Règles de classification</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.6' }} className="markdown-container">
                      <ReactMarkdown>{aiResult.regles}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Autres sections de l'analyse (positions écartées, certitude, vigilance…) */}
                {(aiResult.sections || []).map((s, i) => (
                  <div key={i} style={{ width: '100%', marginTop: '1rem', padding: '0.9rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderLeft: `3px solid ${aiSectionAccent(s.title, s.body)}`, borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '0.5rem' }}>{s.title}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.6' }} className="markdown-container">
                      <ReactMarkdown>{s.body}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        if (!aiResult.code) return;
                        const cleanCode = aiResult.code.replace(/[\s.]/g, '');
                        let match = null;
                        let keys = {};
                        if (typeof tariffs !== 'undefined' && tariffs.length > 0) {
                          keys = getTariffDisplay(tariffs[0]);
                          match = tariffs.find(t => {
                            const code = String(t[keys.codeSHKey] || '').replace(/[\s.]/g, '');
                            const cemac = keys.cemacKey ? String(t[keys.cemacKey] || '').replace(/[\s.]/g, '') : '';
                            return (code + cemac).padEnd(8, '0').substring(0, 8) === cleanCode;
                          });
                          if (!match && cleanCode.length >= 6) {
                            const clean6 = cleanCode.substring(0, 6);
                            match = tariffs.find(t => {
                              const code = String(t[keys.codeSHKey] || '').replace(/[\s.]/g, '');
                              return code.substring(0, 6) === clean6;
                            });
                          }
                        }

                        // Libellé officiel : base tarif, ou libellé IA officiel, JAMAIS les mots-clés aiQuery
                        const finalLibelle = (match && keys.descKey && match[keys.descKey]) || aiResult.libelle || 'Marchandise diverse';
                        const finalTaux = (match && keys.tauxKey && match[keys.tauxKey] !== undefined ? String(match[keys.tauxKey]).replace(/[^0-9.]/g, '') : '') || (aiResult.taux || '0').replace(/[^0-9.]/g, '');
                        const finalUnite = (match && keys.uniteKey && match[keys.uniteKey]) || 'KGM';

                        setNewArticle({
                          id: Date.now(),
                          codeSH: cleanCode,
                          intitule: finalLibelle,
                          tauxDD: finalTaux || '0',
                          unite: finalUnite,
                          origine: infos.provenance || 'NC',
                          quantite: '1',
                          valeur: '',
                          pBrut: '',
                          pNet: '',
                          colis: '1',
                          codeAdditionnel: '000',
                        });

                        setAiResult({ code: '', libelle: '', explanation: '', taux: '', imageUrl: '', model: '' });
                        setAiQuery('');

                        setTimeout(() => {
                          const el = document.getElementById('articles-section') || document.querySelector('[name="valeur"]');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                      disabled={!aiResult.code}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px', padding: '0 22px', backgroundColor: '#E51E4D', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: !aiResult.code ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', opacity: !aiResult.code ? 0.5 : 1 }}
                    >
                      <Plus size={16} />
                      Ajouter la marchandise
                    </button>
                    <button
                      onClick={() => setSearchTerm(aiResult.code)}
                      disabled={!aiResult.code}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px', padding: '0 18px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: !aiResult.code ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', opacity: !aiResult.code ? 0.5 : 1 }}
                    >
                      Rechercher dans le tarif
                    </button>
                    <button
                      onClick={handlePrintAiResult}
                      disabled={!aiResult.code && !aiResult.explanation}
                      title="Imprimer cette fiche d'expertise tarifaire IA"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px', padding: '0 18px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: (!aiResult.code && !aiResult.explanation) ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', opacity: (!aiResult.code && !aiResult.explanation) ? 0.5 : 1 }}
                    >
                      <Printer size={16} />
                      Imprimer l'analyse
                    </button>
                  </div>

                  {aiResult.model && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '4px 10px',
                        borderRadius: '20px'
                      }}
                      title={`Réponse fournie par le modèle ${aiResult.model}`}
                    >
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
                      <span>Modèle d'IA : <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{aiResult.model}</strong></span>
                    </div>
                  )}
                </div>

                {/* FICHE IMPRIMABLE D'EXPERTISE IA (Masquée à l'écran, active lors de l'impression).
                    Rendue directement dans <body> (portail) pour ne pas être coupée par les
                    conteneurs à hauteur fixe / défilement de la page. */}
                {createPortal(
                <div id="ai-printable-sheet" style={{ display: 'none' }}>
                  <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        GNAMATECH — ASSISTANCE TARIF & DOUANE
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Zone Douanière CEMAC • Système Harmonisé 2022
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
                      <div><strong>Date d'édition :</strong> {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <div><strong>Opérateur :</strong> {user?.name || 'Déclarant'} ({user?.company?.name || 'Gnamatech'})</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', margin: '20px 0 24px 0' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      FICHE D'EXPERTISE TARIFAIRE ET CLASSEMENT DOUANIER
                    </h1>
                    {aiQuery && (
                      <div style={{ fontSize: '13px', color: '#334155', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '6px', display: 'inline-block', border: '1px solid #cbd5e1' }}>
                        Marchandise / Requête analysée : <strong>« {aiQuery} »</strong>
                      </div>
                    )}
                  </div>

                  {/* Encadré principal des résultats tarifaires */}
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', marginBottom: '20px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', backgroundColor: '#f8fafc' }}>
                    <div style={{ flex: 1, borderRight: '1px solid #cbd5e1', paddingRight: '20px' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>
                        Code Système Harmonisé (SH) Proposé
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace', letterSpacing: '2px' }}>
                        {aiResult.code || '—'}
                      </div>
                      {aiResult.libelle && (
                        <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', fontWeight: 600 }}>
                          {aiResult.libelle}
                        </div>
                      )}
                    </div>

                    {aiResult.taux && (
                      <div style={{ flex: 1, paddingLeft: '10px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>
                          Droit de Douane Applicable (DD)
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', fontFamily: 'monospace', letterSpacing: '1px' }}>
                          {aiResult.taux.includes('%') ? aiResult.taux : `${aiResult.taux}%`}
                        </div>
                        {aiResult.model && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                            Modèle d'IA : <strong>{aiResult.model}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {aiResult.imageUrl && (
                      <div style={{ width: '120px', height: '90px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                        <img src={aiResult.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>

                  {/* Description détaillée du produit */}
                  {aiResult.explanation && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        Description détaillée
                      </div>
                      <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: '1.7', textAlign: 'justify' }} className="markdown-container">
                        <ReactMarkdown>{aiResult.explanation}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Règles de classification appliquées */}
                  {aiResult.regles && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        Règles de classification
                      </div>
                      <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: '1.7', textAlign: 'justify', borderLeft: '3px solid #2563eb', paddingLeft: '12px' }} className="markdown-container">
                        <ReactMarkdown>{aiResult.regles}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Autres sections : positions écartées, certitude, vigilance, recommandation… */}
                  {(aiResult.sections || []).map((s, i) => (
                    <div key={i} style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginBottom: '10px', letterSpacing: '0.5px', breakAfter: 'avoid' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: '1.7', textAlign: 'justify', borderLeft: `3px solid ${aiSectionAccent(s.title, s.body)}`, paddingLeft: '12px' }} className="markdown-container">
                        <ReactMarkdown>{s.body}</ReactMarkdown>
                      </div>
                    </div>
                  ))}

                  {/* Bas de page officiel */}
                  <div style={{ marginTop: '30px', paddingTop: '12px', borderTop: '1px solid #cbd5e1', fontSize: '10px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      Assistance au classement tarifaire conformément au tarif des douanes harmonisé CEMAC 2022.
                    </div>
                    <div>
                      Généré via la plateforme Gnamatech
                    </div>
                  </div>
                </div>,
                document.body
                )}
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
              
              <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
                <div><label style={labelStyle}>V. FRET</label><input style={inputStyle} name="vFret" type="number" value={valeurs.vFret} onChange={handleValeursChange}/></div>
                <div>
                  <label style={labelStyle}>Devise Fret</label>
                  <select style={inputStyle} name="vFretDevise" value={valeurs.vFretDevise} onChange={handleValeursChange}>
                    {Object.keys(CURRENCY_RATES).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Taux Fret (FCFA)</label>
                  <input style={inputStyle} name="vFretTaux" type="number" value={valeurs.vFretTaux} onChange={handleValeursChange}/>
                </div>
              </div>

              <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{...labelStyle, marginBottom: 0, whiteSpace: 'nowrap'}}>V. ASSURANCE (FCFA)</label>
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
                  <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
                    <div><label style={labelStyle}>V. FRAIS DIVERS</label><input style={inputStyle} name="vFraisDivers" value={valeurs.vFraisDivers} onChange={handleValeursChange}/></div>
                    <div>
                      <label style={labelStyle}>Devise Frais</label>
                      <select style={inputStyle} name="vFraisDevise" value={valeurs.vFraisDevise} onChange={handleValeursChange}>
                        {Object.keys(CURRENCY_RATES).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Taux Frais (FCFA)</label>
                      <input style={inputStyle} name="vFraisTaux" type="number" value={valeurs.vFraisTaux} onChange={handleValeursChange}/>
                    </div>
                  </div>
                </div>
              </details>

              {/* Totaux BLUE BLOCK (Maintenant Dark Theme) */}
              <div style={{ marginTop: '0.5rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                {valeurs.cafDevise !== '' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '1rem' }}>CAF TOTAL</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Total en {infos.devise}</div>
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.25rem' }}>
                      {formatNumberWithDots(valeurs.cafDevise, true) || '0.00'}
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: valeurs.cafDevise !== '' ? '1px solid var(--border-color)' : 'none', paddingTop: valeurs.cafDevise !== '' ? '0.75rem' : 0 }}>
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
                 <CodeAdditionnelSelect
                   style={inputStyle}
                   showLabel
                   value={newArticle.codeAdditionnel ?? '000'}
                   onChange={(code) => handleNewArticleChange({ target: { name: 'codeAdditionnel', value: code } })}
                 />
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
                      <td style={{ padding: '0.4rem 0.2rem' }}><CodeAdditionnelSelect compact value={art.codeAdditionnel ?? '000'} onChange={(code) => updateArticle(art.id, 'codeAdditionnel', code)} style={{...inputStyle, width: '62px', padding: '0.3rem', fontSize: '0.8rem'}} /></td>
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
