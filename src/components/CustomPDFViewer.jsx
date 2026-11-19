import React, { useState, useEffect } from 'react';
import { AlertCircle, Download, ExternalLink, RefreshCw } from 'lucide-react';

export const safeEncodePath = (pathStr) => {
  if (!pathStr) return '';
  const normalized = String(pathStr).normalize('NFC');
  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('blob:') || normalized.startsWith('data:')) {
    return normalized;
  }
  const hasLeading = normalized.startsWith('/');
  const segments = (hasLeading ? normalized.slice(1) : normalized).split('/');
  const encoded = segments.map(seg => encodeURIComponent(seg)).join('/');
  return hasLeading ? '/' + encoded : encoded;
};

const CustomPDFViewer = ({ url, file, search }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const rawUrl = url || file || '';
  
  // Séparer l'URL de base et le hash éventuel (si passé dans l'URL)
  const [baseUrl, urlHash] = rawUrl.split('#');

  useEffect(() => {
    let objectUrl = null;
    let isCancelled = false;

    const loadPdf = async () => {
      if (!baseUrl) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        const encodedUrl = safeEncodePath(baseUrl);

        // Fetch arrayBuffer pour assurer la compatibilité hors-ligne et éviter les soucis de chemins WebView
        const response = await fetch(encodedUrl);
        if (!response.ok) throw new Error(`Code réponse HTTP : ${response.status}`);
        
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          throw new Error('Fichier introuvable ou réponse invalide');
        }

        const buffer = await response.arrayBuffer();
        if (isCancelled) return;

        const blob = new Blob([buffer], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (err) {
        console.warn("Chargement via Blob impossible, tentative directe :", err);
        if (isCancelled) return;
        // Fallback avec l'URL sûre directe
        setBlobUrl(safeEncodePath(baseUrl));
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [baseUrl]);

  // Construction de l'URL finale pour le visualiseur PDF.js
  let finalFileTarget = blobUrl || safeEncodePath(baseUrl);
  let activeSearch = search;
  if (!activeSearch && urlHash && urlHash.startsWith('search=')) {
    activeSearch = decodeURIComponent(urlHash.replace('search=', ''));
  }

  let viewerSrc = '';
  if (finalFileTarget) {
    viewerSrc = `/pdfjs/web/viewer.html?file=${encodeURIComponent(finalFileTarget)}`;
    if (activeSearch) {
      viewerSrc += `#search=${encodeURIComponent(activeSearch)}`;
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', position: 'relative' }}>
      {loading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#64748b', zIndex: 10 }}>
          <div className="spinner" style={{ width: '28px', height: '28px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Chargement du document en cours...</span>
        </div>
      )}

      {error ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Impossible de prévisualiser ce document</h4>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <a 
              href={safeEncodePath(baseUrl)} 
              download 
              className="premium-btn"
              style={{ textDecoration: 'none' }}
            >
              <Download size={16} /> Télécharger le fichier
            </a>
          </div>
        </div>
      ) : (
        viewerSrc && (
          <iframe
            src={viewerSrc}
            style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
            title="PDF Viewer"
          />
        )
      )}
    </div>
  );
};

export default CustomPDFViewer;
