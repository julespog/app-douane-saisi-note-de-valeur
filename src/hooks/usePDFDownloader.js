import { useState, useEffect } from 'react';

// Global state outside the hook to persist across navigation
let globalIsDownloading = false;
let globalProgress = 0;
let globalTotalFiles = 0;
let globalCurrentFile = 0;
const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach(listener => listener({ 
    globalIsDownloading, 
    globalProgress, 
    globalTotalFiles, 
    globalCurrentFile 
  }));
};

export const usePDFDownloader = () => {
  const [state, setState] = useState({ 
    globalIsDownloading, 
    globalProgress, 
    globalTotalFiles, 
    globalCurrentFile 
  });

  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);

  const downloadPDFs = async () => {
    if (globalIsDownloading) return;
    
    globalIsDownloading = true;
    globalProgress = 0;
    globalCurrentFile = 0;
    notifyListeners();

    try {
      // 1. Fetch manifest_docs.json
      const response = await fetch('/manifest_docs.json');
      if (!response.ok) throw new Error("Failed to fetch manifest");
      const tree = await response.json();

      // 2. Extract all PDF URLs
      const pdfUrls = [];
      const extractUrls = (nodes) => {
        for (const node of nodes) {
          if (node.type === 'directory') {
            extractUrls(node.children);
          } else if (node.type === 'file' && node.name.toLowerCase().endsWith('.pdf')) {
            pdfUrls.push(encodeURI(node.url));
          }
        }
      };
      extractUrls(tree);

      globalTotalFiles = pdfUrls.length;
      notifyListeners();

      // 3. Open Cache Storage
      const cache = await caches.open('offline-pdfs-v1');

      // 4. Download files sequentially
      let errorCount = 0;
      let quotaExceeded = false;
      
      for (let i = 0; i < pdfUrls.length; i++) {
        if (quotaExceeded || errorCount > 20) break;
        
        const url = pdfUrls[i];
        try {
          // Check if already in cache
          const cachedResponse = await cache.match(url);
          if (!cachedResponse) {
             const res = await fetch(url);
             if (res.ok) {
               await cache.put(url, res.clone());
             } else {
               console.warn(`HTTP Error ${res.status} for ${url}`);
               errorCount++;
             }
          }
        } catch (e) {
          console.warn(`Failed to cache ${url}`, e);
          if (e.name === 'QuotaExceededError') {
             quotaExceeded = true;
             alert("⚠️ L'espace de stockage alloué à votre navigateur est plein. Impossible de sauvegarder plus de documents hors-ligne. Vous pouvez libérer de l'espace sur votre appareil.");
          } else {
             errorCount++;
          }
        }
        
        globalCurrentFile = i + 1;
        globalProgress = Math.round(((i + 1) / pdfUrls.length) * 100);
        notifyListeners();
      }
      
      if (errorCount > 20 && !quotaExceeded) {
        alert("⚠️ Plusieurs fichiers n'ont pas pu être téléchargés. Cela peut être dû à une limite de sécurité du serveur (trop de requêtes). Veuillez patienter quelques minutes et relancer la synchronisation.");
      }
    } catch (err) {
      console.error("Erreur lors du téléchargement des PDF", err);
    } finally {
      // Keep showing 100% for 3 seconds before hiding
      setTimeout(() => {
        globalIsDownloading = false;
        notifyListeners();
      }, 3000);
    }
  };

  const getOfflineStats = async () => {
    try {
      const response = await fetch('/manifest_docs.json');
      const tree = await response.json();
      
      let totalPdfs = 0;
      const countPdfs = (nodes) => {
        for (const node of nodes) {
          if (node.type === 'directory') countPdfs(node.children);
          else if (node.type === 'file' && node.name.toLowerCase().endsWith('.pdf')) totalPdfs++;
        }
      };
      countPdfs(tree);

      const cache = await caches.open('offline-pdfs-v1');
      const keys = await cache.keys();
      // On filtre pour ne compter que les .pdf
      const cachedCount = keys.filter(req => req.url.toLowerCase().endsWith('.pdf')).length;

      return { cachedCount, totalFiles: totalPdfs };
    } catch (e) {
      console.error(e);
      return { cachedCount: 0, totalFiles: 0 };
    }
  };

  return { 
    downloadPDFs, 
    getOfflineStats,
    isDownloading: state.globalIsDownloading, 
    progress: state.globalProgress, 
    totalFiles: state.globalTotalFiles, 
    currentFile: state.globalCurrentFile 
  };
};
