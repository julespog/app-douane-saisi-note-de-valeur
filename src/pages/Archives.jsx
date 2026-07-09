import React, { useState, useEffect, useContext } from 'react';
import { Archive, Search, FileText, Edit3, Trash2, ChevronRight, File, Edit, RefreshCw, LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { DatabaseContext } from '../context/DatabaseContext';

const Archives = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const { notesHistory, deleteNote, pendingNotes, syncPendingNotes } = useContext(DatabaseContext);
  const [archives, setArchives] = useState([]);
  const [draft, setDraft] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedArchives, setSelectedArchives] = useState([]);

  useEffect(() => {
    // Les archives viennent désormais du contexte global (Supabase / localforage)
    let filtered = [...notesHistory];
    if (user?.role !== 'superadmin') {
      filtered = filtered.filter(a => a.companyId === user?.companyId);
    }
    // Trier par date décroissante
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    setArchives(filtered);

    // Charger le brouillon de l'entreprise
    const savedDraft = localStorage.getItem(`noteDraft_${user?.companyId || 'default'}`);
    if (savedDraft) {
      setDraft(JSON.parse(savedDraft));
    }
  }, [user, notesHistory]);

  const deleteArchive = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Voulez-vous vraiment supprimer cette note archivée ?")) {
      try {
        await deleteNote(id);
        // Note: setArchives will automatically update when notesHistory updates, 
        // but it's handled in the useEffect.
      } catch (err) {
        alert("Erreur lors de la suppression de la note.");
      }
    }
  };

  const deleteDraft = (e) => {
    e.stopPropagation();
    if (window.confirm("Voulez-vous vraiment supprimer votre brouillon en cours ?")) {
      localStorage.removeItem(`noteDraft_${user?.companyId || 'default'}`);
      setDraft(null);
    }
  };

  const filteredArchives = archives.filter(arch => 
    (arch.infos?.noDossier || arch.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (arch.infos?.provenance || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteSelectedArchives = async () => {
    if (selectedArchives.length === 0) return;
    if (window.confirm(`Voulez-vous vraiment supprimer ${selectedArchives.length} note(s) archivée(s) ?`)) {
      try {
        for (const id of selectedArchives) {
          await deleteNote(id);
        }
        setSelectedArchives([]);
      } catch (err) {
        alert("Erreur lors de la suppression groupée.");
      }
    }
  };

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    setSelectedArchives(prev => 
      prev.includes(id) ? prev.filter(archId => archId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedArchives.length === filteredArchives.length && filteredArchives.length > 0) {
      setSelectedArchives([]);
    } else {
      setSelectedArchives(filteredArchives.map(a => a.id));
    }
  };

  return (
    <div className="fade-in" style={{ padding: '1rem 0' }}>
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        marginBottom: '2rem', backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', 
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.25rem 0' }}>
            <Archive size={24} /> Mes Archives
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Retrouvez ici toutes vos notes de détails générées et vos brouillons sauvegardés.
          </p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
          {pendingNotes && pendingNotes.length > 0 && navigator.onLine && (
            <button 
              onClick={syncPendingNotes}
              className="btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem', backgroundColor: '#eab308', color: 'white', border: 'none' }}
              title="Cliquer pour forcer l'envoi des notes créées hors-ligne"
            >
              <RefreshCw size={16} /> Envoyer {pendingNotes.length} note(s) en attente
            </button>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Rechercher par N° Dossier..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  padding: '0.6rem 1rem 0.6rem 2.5rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  outline: 'none',
                  width: '280px',
                  fontSize: '0.95rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)'
                }} 
              />
            </div>
            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              <button 
                onClick={() => setViewMode('grid')}
                title="Vue en grille"
                style={{ padding: '0.6rem', background: viewMode === 'grid' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', color: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                title="Vue en liste"
                style={{ padding: '0.6rem', background: viewMode === 'list' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', borderLeft: '1px solid var(--border-color)', color: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION BROUILLON */}
      {draft && !searchTerm && (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Edit3 size={18} color="var(--warning)" /> Brouillon en cours
          </h2>
          <div 
            onClick={() => navigate('/note/new')}
            style={{ 
              backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid var(--warning)', borderRadius: '12px', padding: '1.25rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.15)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
          >
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--warning)', fontSize: '1.1rem' }}>
                Dossier: {draft.infos.noDossier || 'Non défini'}
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', gap: '1rem' }}>
                <span>Articles: <strong style={{ color: 'var(--text-primary)' }}>{draft.articles.length}</strong></span>
                <span>FOB Total: <strong style={{ color: 'var(--text-primary)' }}>{draft.valeurs.vFacture || '0'} CFA</strong></span>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={deleteDraft}
                style={{ padding: '0.5rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.7, transition: 'opacity 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                title="Supprimer le brouillon"
              >
                <Trash2 size={18} />
              </button>
              <button style={{ padding: '0.5rem 1rem', background: 'var(--warning)', color: 'var(--bg-primary)', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                Reprendre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION ARCHIVES */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <FileText size={18} color="var(--accent-primary)" /> Notes Générées
          </h2>
          
          {filteredArchives.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <input 
                  type="checkbox" 
                  checked={selectedArchives.length === filteredArchives.length && filteredArchives.length > 0}
                  onChange={toggleAll}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                />
                Tout sélectionner
              </label>

              {selectedArchives.length > 0 && (
                <button 
                  onClick={deleteSelectedArchives}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'var(--shadow-sm)' }}
                >
                  <Trash2 size={16} /> Supprimer ({selectedArchives.length})
                </button>
              )}
            </div>
          )}
        </div>
        
        {filteredArchives.length > 0 ? (
          viewMode === 'grid' ? (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {filteredArchives.map(arch => (
                <div 
                  key={arch.id} 
                  onClick={() => navigate('/print-note', { state: { articles: arch.articles, rawArticles: arch.rawArticles, infos: arch.infos, valeurs: arch.valeurs, level: arch.level } })}
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', 
                    padding: '1.25rem', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                  onMouseOver={(e) => { 
                    e.currentTarget.style.borderColor = 'var(--accent-primary)'; 
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(225, 29, 72, 0.15)'; 
                    e.currentTarget.querySelector('.arch-icon').style.color = 'var(--accent-primary)';
                    e.currentTarget.querySelector('.arch-checkbox').style.opacity = '1';
                  }}
                  onMouseOut={(e) => { 
                    e.currentTarget.style.borderColor = 'var(--border-color)'; 
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; 
                    e.currentTarget.querySelector('.arch-icon').style.color = 'var(--text-muted)';
                    e.currentTarget.querySelector('.arch-checkbox').style.opacity = selectedArchives.includes(arch.id) ? '1' : '0';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input 
                        type="checkbox" 
                        className="arch-checkbox"
                        checked={selectedArchives.includes(arch.id)}
                        onChange={(e) => toggleSelection(e, arch.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)', opacity: selectedArchives.includes(arch.id) ? '1' : '0', transition: 'opacity 0.2s' }}
                      />
                      <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <File className="arch-icon" size={20} style={{ color: 'var(--text-muted)', transition: 'color 0.2s' }} />
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>{arch.infos?.noDossier || 'Note de détail (Sans Numéro)'}</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(arch.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/note/new', { state: { archiveData: arch } });
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '0.2rem', opacity: 0.8 }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                        onMouseOut={(e) => e.currentTarget.style.opacity = 0.8}
                        title="Éditer l'archive"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={(e) => deleteArchive(e, arch.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Supprimer l'archive"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Articles</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{arch.articles.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Provenance</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{arch.infos.provenance || 'NC'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Action</span>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Voir <ChevronRight size={14}/></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredArchives.map(arch => (
                <div 
                  key={arch.id} 
                  onClick={() => navigate('/print-note', { state: { articles: arch.articles, rawArticles: arch.rawArticles, infos: arch.infos, valeurs: arch.valeurs, level: arch.level } })}
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', 
                    padding: '0.75rem 1.25rem', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                  onMouseOver={(e) => { 
                    e.currentTarget.style.borderColor = 'var(--accent-primary)'; 
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; 
                    e.currentTarget.querySelector('.arch-list-icon').style.color = 'var(--accent-primary)';
                    e.currentTarget.querySelector('.arch-list-checkbox').style.opacity = '1';
                  }}
                  onMouseOut={(e) => { 
                    e.currentTarget.style.borderColor = 'var(--border-color)'; 
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; 
                    e.currentTarget.querySelector('.arch-list-icon').style.color = 'var(--text-muted)';
                    e.currentTarget.querySelector('.arch-list-checkbox').style.opacity = selectedArchives.includes(arch.id) ? '1' : '0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 2 }}>
                    <input 
                      type="checkbox" 
                      className="arch-list-checkbox"
                      checked={selectedArchives.includes(arch.id)}
                      onChange={(e) => toggleSelection(e, arch.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)', opacity: selectedArchives.includes(arch.id) ? '1' : '0', transition: 'opacity 0.2s' }}
                    />
                    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '6px' }}>
                      <File className="arch-list-icon" size={16} style={{ color: 'var(--text-muted)', transition: 'color 0.2s' }} />
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 0.1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>{arch.infos?.noDossier || 'Note de détail (Sans Numéro)'}</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(arch.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', gap: '2rem', fontSize: '0.85rem' }}>
                     <div>
                       <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Articles</span>
                       <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{arch.articles.length}</span>
                     </div>
                     <div>
                       <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Provenance</span>
                       <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{arch.infos.provenance || 'NC'}</span>
                     </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/note/new', { state: { archiveData: arch } });
                      }}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      title="Éditer l'archive"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      onClick={(e) => deleteArchive(e, arch.id)}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                      title="Supprimer l'archive"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div style={{ marginLeft: '0.5rem', display: 'flex', alignItems: 'center', color: 'var(--accent-primary)' }}>
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px dashed var(--border-color)', padding: '4rem 2rem', textAlign: 'center' }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Aucune note archivée</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
              {searchTerm 
                ? "Aucune archive ne correspond à votre recherche." 
                : "Les notes que vous générez apparaîtront automatiquement ici pour que vous puissiez les retrouver ou les réimprimer à tout moment."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Archives;
