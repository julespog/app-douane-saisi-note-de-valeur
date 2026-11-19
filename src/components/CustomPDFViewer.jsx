import React from 'react';
import { AlertCircle, Download } from 'lucide-react';

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

// Normalise l'URL pour PDF.js (évite tout double-encodage type %2520)
export const getCleanPdfTarget = (rawUrl) => {
  if (!rawUrl) return '';
  let target = rawUrl;
  try {
    target = decodeURI(rawUrl);
  } catch (e) {
    target = rawUrl;
  }
  return target;
};

const CustomPDFViewer = ({ url, file, search }) => {
  const rawUrl = url || file || '';
  const [baseUrl, urlHash] = rawUrl.split('#');

  let activeSearch = search;
  if (!activeSearch && urlHash && urlHash.startsWith('search=')) {
    activeSearch = decodeURIComponent(urlHash.replace('search=', ''));
  }

  const cleanTarget = getCleanPdfTarget(baseUrl);
  let viewerSrc = '';
  if (cleanTarget) {
    viewerSrc = `/pdfjs/web/viewer.html?file=${encodeURIComponent(cleanTarget)}`;
    if (activeSearch) {
      viewerSrc += `#search=${encodeURIComponent(activeSearch)}`;
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', position: 'relative' }}>
      {!cleanTarget ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>Sélectionnez un document pour l'afficher</p>
        </div>
      ) : (
        <iframe
          key={viewerSrc}
          src={viewerSrc}
          style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
          title="PDF Viewer"
        />
      )}
    </div>
  );
};

export default CustomPDFViewer;
