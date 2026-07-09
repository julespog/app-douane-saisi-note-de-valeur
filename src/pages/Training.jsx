import React, { useState } from 'react';
import { PlayCircle, CheckCircle, GraduationCap } from 'lucide-react';

const VIDEOS = [
  {
    id: 1,
    title: "Présentation et Connexion",
    description: "Découvrez GNAMATECH 1.0 et apprenez à vous connecter.",
    youtubeId: "rMWuK323hKw",
    duration: "~1 min"
  },
  {
    id: 2,
    title: "Les Informations Générales",
    description: "Remplissez l'en-tête : numéro de dossier, LTA, provenance, devise.",
    youtubeId: "qdOIv4yZtyU",
    duration: "~1 min 30"
  },
  {
    id: 3,
    title: "Saisir et Gérer les Articles",
    description: "Préparez vos valeurs financières et ajoutez vos marchandises.",
    youtubeId: "KJ4gLQzcqKY",
    duration: "~2 min 30"
  },
  {
    id: 4,
    title: "Générer la Note et le PDF",
    description: "Finalisez et produisez le document officiel.",
    youtubeId: "sSyT9s9rSVc",
    duration: "~1 min 30"
  },
  {
    id: 5,
    title: "La Documentation",
    description: "Accédez aux fiches tarifaires et au Code des Douanes intégré.",
    youtubeId: "NfdBC8hc5d8",
    duration: "~2 min"
  },
  {
    id: 6,
    title: "Les Archives et Brouillons",
    description: "Retrouvez vos notes grâce à la sauvegarde automatique.",
    youtubeId: "Fi85kexnELQ",
    duration: "~2 min"
  }
];

const Training = () => {
  const [activeVideo, setActiveVideo] = useState(VIDEOS[0]);
  const [watched, setWatched] = useState(new Set([1]));

  const handleSelect = (video) => {
    setActiveVideo(video);
    setWatched(prev => new Set([...prev, video.id]));
  };

  const progress = Math.round((watched.size / VIDEOS.length) * 100);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 65px)',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-primary)',
      padding: '1rem',
      gap: '0.75rem',
      boxSizing: 'border-box'
    }}>

      {/* Header compact */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <GraduationCap size={24} color="var(--accent-primary)" />
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
              Centre de Formation — GNAMATECH 1.0
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Maîtrisez le logiciel à votre rythme
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--accent-primary)', borderRadius: '99px', transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
            {watched.size}/{VIDEOS.length} vues
          </span>
        </div>
      </div>

      {/* Corps principal : Sidebar gauche + Lecteur droit */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* SIDEBAR GAUCHE */}
        <div style={{
          flex: '0 0 300px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          overflowY: 'auto'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem', flexShrink: 0 }}>
            Au programme
          </div>
          {VIDEOS.map(video => {
            const isActive = video.id === activeVideo.id;
            const isWatched = watched.has(video.id);
            return (
              <div
                key={video.id}
                onClick={() => handleSelect(video)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.7rem',
                  padding: '0.7rem 0.85rem',
                  borderRadius: '10px',
                  border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  backgroundColor: isActive ? 'rgba(225, 29, 72, 0.07)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                  flexShrink: 0,
                  boxShadow: isActive ? '0 2px 10px rgba(225,29,72,0.12)' : 'none'
                }}
              >
                <div style={{ marginTop: '0.15rem', flexShrink: 0 }}>
                  {isWatched
                    ? <CheckCircle size={18} color="#16a34a" />
                    : <PlayCircle size={18} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                  }
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.15rem' }}>
                    Vidéo {video.id} · {video.duration}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.3' }}>
                    {video.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: '1.35' }}>
                    {video.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* LECTEUR DROIT */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          gap: '0.6rem'
        }}>
          {/* Conteneur vidéo avec ratio 16:9 strict */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            <div style={{
              width: '100%',
              maxHeight: '100%',
              aspectRatio: '16 / 9',
              backgroundColor: '#000',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
            }}>
              <iframe
                key={activeVideo.youtubeId}
                src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            </div>
          </div>

          {/* Infos + Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '10px',
            padding: '0.65rem 1.1rem',
            border: '1px solid var(--border-color)',
            flexShrink: 0,
            gap: '1rem'
          }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ backgroundColor: 'var(--accent-primary)', color: 'white', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, marginRight: '0.6rem' }}>
                Vidéo {activeVideo.id}/{VIDEOS.length}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {activeVideo.title}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {activeVideo.id > 1 && (
                <button
                  onClick={() => handleSelect(VIDEOS[activeVideo.id - 2])}
                  style={{ padding: '0.45rem 1rem', borderRadius: '7px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  ← Précédente
                </button>
              )}
              {activeVideo.id < VIDEOS.length ? (
                <button
                  onClick={() => handleSelect(VIDEOS[activeVideo.id])}
                  className="premium-btn"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                >
                  Suivante →
                </button>
              ) : (
                <div style={{ padding: '0.45rem 1rem', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '7px', fontWeight: 700, fontSize: '0.85rem' }}>
                  🎉 Formation complète !
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Training;
