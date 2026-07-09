import React from 'react';
import { DownloadCloud, CheckCircle } from 'lucide-react';

const PDFDownloadProgress = ({ isDownloading, progress, currentFile, totalFiles }) => {
  if (!isDownloading && progress !== 100) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      zIndex: 9999,
      width: '320px',
      border: '1px solid var(--border-color)',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <style>
        {`
          @keyframes slideUp {
            from { transform: translateY(100px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        {progress === 100 ? (
          <CheckCircle size={24} color="var(--success)" />
        ) : (
          <DownloadCloud size={24} color="var(--accent-primary)" className="pulse-anim" />
        )}
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {progress === 100 ? 'Ressources téléchargées' : 'Synchronisation des ressources'}
          </h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {progress === 100 ? 'Mode hors-ligne prêt !' : 'Veuillez patienter...'}
          </p>
        </div>
      </div>

      <div style={{ width: '100%', backgroundColor: 'var(--bg-secondary)', borderRadius: '99px', height: '8px', overflow: 'hidden', marginBottom: '0.5rem' }}>
        <div style={{
          height: '100%',
          backgroundColor: progress === 100 ? 'var(--success)' : 'var(--accent-primary)',
          width: `${progress}%`,
          transition: 'width 0.3s ease'
        }}></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>{progress}%</span>
        <span>{currentFile} / {totalFiles} fichiers</span>
      </div>
    </div>
  );
};

export default PDFDownloadProgress;
