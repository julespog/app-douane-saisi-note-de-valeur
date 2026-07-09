import React, { useState, useEffect } from 'react';

const CustomPDFViewer = ({ url, file, search }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const rawUrl = url || file || '';
  
  // Séparer l'URL de base et le hash éventuel (si passé dans l'URL)
  const [baseUrl, urlHash] = rawUrl.split('#');

  useEffect(() => {
    let objectUrl = null;
    
    const loadPdf = async () => {
      if (!baseUrl) return;
      
      try {
        setLoading(true);
        // On fetch le PDF via baseUrl
        const response = await fetch(encodeURI(baseUrl));
        if (!response.ok) throw new Error('Network response was not ok');
        
        const blob = await response.blob();
        
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (error) {
        console.error("Erreur lors du chargement du PDF:", error);
        setBlobUrl(encodeURI(baseUrl));
      } finally {
        setLoading(false);
      }
    };

    loadPdf();

    // Cleanup: révoquer l'URL pour libérer la mémoire
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [baseUrl]);

  // Construction de l'URL finale pour l'iframe
  let finalSrc = blobUrl || '';
  if (finalSrc) {
    let activeSearch = search;
    if (!activeSearch && urlHash && urlHash.startsWith('search=')) {
      activeSearch = decodeURIComponent(urlHash.replace('search=', ''));
    }
    if (activeSearch) {
      finalSrc = `${finalSrc}#search=${encodeURIComponent(activeSearch)}`;
    }
  }

  return (
    <div style={{ width: '100%', height: '80vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', position: 'relative' }}>
      {loading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#64748b' }}>
          Chargement du document...
        </div>
      )}
      {blobUrl && (
        <iframe
          src={finalSrc}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="PDF Viewer"
        />
      )}
    </div>
  );
};

export default CustomPDFViewer;

