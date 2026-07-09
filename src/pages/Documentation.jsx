import React, { useState, useEffect } from 'react';
import { Book, FileText, Search, Folder, ChevronRight, ChevronDown, File, Download } from 'lucide-react';
import CustomPDFViewer from '../components/CustomPDFViewer';
import { usePDFDownloader } from '../hooks/usePDFDownloader';

const FileTreeNode = ({ node, onSelectFile, selectedUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedUrl === node.url;

  if (node.type === 'directory') {
    return (
      <div style={{ marginBottom: '6px' }}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: isOpen ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', transition: 'background-color 0.2s' }}
          onMouseOver={e => !isOpen && (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
          onMouseOut={e => !isOpen && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Folder size={18} color="var(--accent-primary)" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.name}>{node.name}</span>
        </div>
        {isOpen && (
          <div style={{ paddingLeft: '1.5rem', marginTop: '4px', borderLeft: '2px solid var(--border-color)', marginLeft: '0.75rem' }}>
            {node.children.map(child => <FileTreeNode key={child.path} node={child} onSelectFile={onSelectFile} selectedUrl={selectedUrl} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      onClick={() => onSelectFile(node)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent', color: isSelected ? 'white' : 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px', transition: 'all 0.2s' }}
      onMouseOver={e => !isSelected && (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
      onMouseOut={e => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <File size={16} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.name}>{node.name}</span>
    </div>
  );
};

const Documentation = () => {
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // PDF search
  const [globalSearchTerm, setGlobalSearchTerm] = useState(''); // Global explorer search
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('doc'); // 'code', 'reg', 'doc'
  const { downloadPDFs, getOfflineStats, isDownloading, progress } = usePDFDownloader();
  const [offlineStats, setOfflineStats] = useState({ cachedCount: 0, totalFiles: 0 });

  const fetchStats = async () => {
    const stats = await getOfflineStats();
    if (stats) setOfflineStats(stats);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!isDownloading) {
      fetchStats();
    }
  }, [isDownloading]);

  const filterTree = (nodes, term) => {
    if (!term) return nodes;
    const lowerTerm = term.toLowerCase();
    
    return nodes.map(node => {
      if (node.type === 'directory') {
        const filteredChildren = filterTree(node.children, term);
        // Si un enfant matche OU si le nom du dossier matche
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerTerm)) {
          return { ...node, children: filteredChildren };
        }
        return null;
      } else {
        if (node.name.toLowerCase().includes(lowerTerm)) return node;
        return null;
      }
    }).filter(Boolean);
  };

  const displayedTree = filterTree(tree, globalSearchTerm);

  useEffect(() => {
    fetch('/manifest_docs.json')
      .then(res => res.json())
      .then(data => {
        setTree(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Erreur lors du chargement de la documentation :", err);
        setIsLoading(false);
      });
  }, []);

  const openCodeDouane = () => {
    setActiveSection('code');
    setSelectedFile({
      name: "Code des douanes harmonisé_final).pdf",
      url: "/DOCUMENTATION S DOUANE/Code des Douanes Gabonais/Code des douanes harmonisé_final).pdf"
    });
  };

  const openReglementation = () => {
    setActiveSection('reg');
    setSelectedFile({
      name: "REGLEMENTATION DOUANIERE-CEMAC.pdf",
      url: "/DOCUMENTATION S DOUANE/Reglementation Douaniere/REGLEMENTATION DOUANIERE-CEMAC.pdf"
    });
  };

  const openDocumentation = () => {
    setActiveSection('doc');
    setSelectedFile(null);
  };

  const getViewerUrl = () => {
    if (!selectedFile) return null;
    if (selectedFile.name.endsWith('.pdf')) {
      return searchTerm ? `${selectedFile.url}#search=${encodeURIComponent(searchTerm)}` : selectedFile.url;
    }
    return selectedFile.url;
  };

  return (
    <div className="fade-in" style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: '1.5rem' }}>
      {/* Sidebar - Menu & Explorateur */}
      <div className="glass-panel" style={{ width: '350px', display: 'flex', flexDirection: 'column', padding: '1rem', overflowY: 'hidden' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', paddingLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Book size={20} color="var(--accent-primary)" /> Ressources
        </h2>
        
        {/* Boutons Rapides */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={openCodeDouane}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: activeSection === 'code' ? 'var(--accent-primary)' : 'var(--bg-primary)', color: activeSection === 'code' ? 'white' : 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontWeight: activeSection === 'code' ? 600 : 500, transition: 'all 0.2s', boxShadow: activeSection === 'code' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none' }}
          >
            <Book size={18} /> Code des Douanes
          </button>
          
          <button 
            onClick={openReglementation}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: activeSection === 'reg' ? 'var(--accent-primary)' : 'var(--bg-primary)', color: activeSection === 'reg' ? 'white' : 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontWeight: activeSection === 'reg' ? 600 : 500, transition: 'all 0.2s', boxShadow: activeSection === 'reg' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none' }}
          >
            <FileText size={18} /> Réglementation
          </button>

          <button 
            onClick={openDocumentation}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: activeSection === 'doc' ? 'var(--accent-primary)' : 'var(--bg-primary)', color: activeSection === 'doc' ? 'white' : 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontWeight: activeSection === 'doc' ? 600 : 500, transition: 'all 0.2s', boxShadow: activeSection === 'doc' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none' }}
          >
            <Folder size={18} /> Explorateur
          </button>
          
          <button 
            onClick={downloadPDFs}
            disabled={isDownloading}
            title="Télécharger tous les documents pour un accès sans internet"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-primary)', backgroundColor: isDownloading ? '#eff6ff' : 'transparent', color: 'var(--accent-primary)', cursor: isDownloading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}
          >
            {isDownloading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                Téléchargement... {progress}%
              </span>
            ) : (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={14} /> Synchroniser (Hors-ligne)
                </span>
                {offlineStats.totalFiles > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 'normal' }}>
                    {offlineStats.cachedCount} / {offlineStats.totalFiles} documents disponibles
                  </span>
                )}
                <span 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm("Réinitialiser la mémoire ? Vous devrez retélécharger les documents.")) {
                      await caches.delete('offline-pdfs-v1');
                      const regs = await navigator.serviceWorker.getRegistrations();
                      for (let r of regs) await r.unregister();
                      window.location.reload(true);
                    }
                  }}
                  style={{ fontSize: '0.65rem', color: 'var(--error-color)', textDecoration: 'underline', marginTop: '0.4rem', cursor: 'pointer' }}
                >
                  Réinitialiser en cas de blocage
                </span>
              </>
            )}
          </button>
        </div>

        {/* Explorateur (Visible seulement si 'doc' est actif) */}
        {activeSection === 'doc' && (
          <>
            <div style={{ height: '1px', backgroundColor: 'var(--border-color)', marginBottom: '1rem' }}></div>
            
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Rechercher un document..."
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
                className="premium-input"
                style={{ paddingLeft: '2.2rem', paddingRight: '0.8rem', paddingBottom: '0.5rem', paddingTop: '0.5rem', borderRadius: 'var(--radius-md)' }}
              />
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chargement des archives...</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                {displayedTree.map(node => (
                  <FileTreeNode key={node.path} node={node} onSelectFile={setSelectedFile} selectedUrl={selectedFile?.url} />
                ))}
                {displayedTree.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>Aucun document ne correspond à "{globalSearchTerm}".</p>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Content Viewer */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedFile ? selectedFile.name : 'Sélectionnez un document pour l\'afficher'}
          </h3>
          
          {selectedFile && selectedFile.name.endsWith('.pdf') && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '250px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Chercher dans ce PDF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="premium-input"
                  style={{ paddingLeft: '2.5rem', borderRadius: 'var(--radius-md)' }}
                />
              </div>
              <a 
                href={encodeURI(selectedFile.url)} 
                target="_blank" 
                rel="noopener noreferrer"
                title="Ouvrir dans le navigateur externe"
                style={{ padding: '0.5rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                <FileText size={18} />
              </a>
            </div>
          )}
        </div>

        {/* Viewer Area */}
        <div style={{ flex: 1, backgroundColor: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
          {selectedFile ? (
            selectedFile.name.endsWith('.pdf') ? (
              <CustomPDFViewer file={getViewerUrl()} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' }}>
                <FileText size={64} style={{ opacity: 0.8, marginBottom: '1.5rem', color: 'var(--accent-primary)' }} />
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.25rem', fontWeight: 600 }}>{selectedFile.name}</h3>
                <p style={{ marginBottom: '2rem', fontSize: '0.95rem' }}>Ce format de fichier ({selectedFile.name.split('.').pop()}) ne peut pas être lu directement dans le navigateur.</p>
                <a 
                  href={selectedFile.url} 
                  download 
                  className="premium-btn"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={18} /> Télécharger le fichier
                </a>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' }}>
              <Book size={72} style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '1.25rem', fontWeight: 600 }}>Espace Documentation</h3>
              <p style={{ fontSize: '0.95rem', maxWidth: '400px', textAlign: 'center' }}>Explorez les dossiers à gauche pour consulter le code des douanes, les notes explicatives ou télécharger des outils.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Documentation;
