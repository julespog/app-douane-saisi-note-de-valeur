import React, { useContext, useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Archive, LogOut, FilePlus, AlertCircle, LayoutDashboard, Cloud, CloudOff, RefreshCw, Download, Eraser, Sun, Moon, GraduationCap } from 'lucide-react';
import fastLogo from '../assets/fast-logo.png';
import { UserContext } from '../context/UserContext';
import { DatabaseContext } from '../context/DatabaseContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { usePDFDownloader } from '../hooks/usePDFDownloader';
import PDFDownloadProgress from '../components/PDFDownloadProgress';

const AppLayout = () => {
  const location = useLocation();
  const { user, logout, profileLogo } = useContext(UserContext);
  const { pendingNotes } = useContext(DatabaseContext);
  const { isInstallable, promptInstall } = usePWAInstall();
  const { downloadPDFs, isDownloading, progress, currentFile, totalFiles } = usePDFDownloader();
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('fast_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fast_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const clearCacheAndReload = () => {
    if (window.confirm("Cela va vider le cache, vous déconnecter et recharger l'application pour corriger d'éventuels bugs d'affichage. Vos archives et brouillons seront conservés. Continuer ?")) {
      // Nettoyer seulement la session
      localStorage.removeItem('fast_session');
      sessionStorage.clear();
      
      // Vider les caches du navigateur (fichiers statiques)
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach(name => caches.delete(name));
        });
      }

      // Désenregistrer le service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            registration.unregister();
          }
        });
      }

      // Recharger en forçant depuis le serveur
      setTimeout(() => {
        window.location.reload(true);
      }, 500);
    }
  };

  useEffect(() => {
    let interval;
    
    const checkTrueOnlineStatus = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 secondes max
        
        const res = await fetch('/ping.txt?t=' + Date.now(), { 
          method: 'GET', 
          cache: 'no-store',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const text = await res.text();
          setIsOnline(text.trim() === 'pong');
        } else {
          setIsOnline(false);
        }
      } catch (e) {
        setIsOnline(false);
      }
    };

    const handleOnline = () => checkTrueOnlineStatus();
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Vérifier immédiatement au chargement
    checkTrueOnlineStatus();
    
    // Vérifier toutes les 15 secondes
    interval = setInterval(checkTrueOnlineStatus, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const isActive = (path) => {
    return location.pathname === path ? 'var(--accent-light)' : 'transparent';
  };

  const isTextActive = (path) => {
    return location.pathname === path ? 'var(--accent-primary)' : 'var(--text-secondary)';
  };

  const isDeclarant = user?.role === 'declarant';
  let daysRemaining = null;
  if (isDeclarant && user?.company?.subscription) {
    const end = new Date(user.company.subscription.endDate);
    const now = new Date();
    const diffTime = end - now;
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="app-container">
      <PDFDownloadProgress isDownloading={isDownloading} progress={progress} currentFile={currentFile} totalFiles={totalFiles} />
      
      {/* Top Navbar */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <img src={fastLogo} alt="Fast International" style={{ height: '36px', objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '0.5px', lineHeight: '1' }}>GNAMATECH 1.0</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>by Fast International</span>
            </div>
          </div>

          <nav className="desktop-only" style={{ display: 'flex', gap: '0.5rem' }}>
            {user?.role === 'superadmin' && (
              <Link 
                to="/dashboard" 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', 
                  borderRadius: 'var(--radius-md)', textDecoration: 'none',
                  backgroundColor: isActive('/dashboard'),
                  color: isTextActive('/dashboard'),
                  transition: 'all 0.2s',
                  fontWeight: 500, fontSize: '0.875rem'
                }}
              >
                <LayoutDashboard size={18} />
                Tableau de Bord
              </Link>
            )}

            {user?.role === 'declarant' && (
              <>
                <Link 
                  to="/note/new" 
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', 
                    borderRadius: 'var(--radius-md)', textDecoration: 'none',
                    backgroundColor: isActive('/note/new'),
                    color: isTextActive('/note/new'),
                    transition: 'all 0.2s',
                    fontWeight: 500, fontSize: '0.875rem'
                  }}
                >
                  <FilePlus size={18} />
                  Saisie de Note
                </Link>
                
                <Link 
                  to="/archives" 
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', 
                    borderRadius: 'var(--radius-md)', textDecoration: 'none',
                    backgroundColor: isActive('/archives'),
                    color: isTextActive('/archives'),
                    transition: 'all 0.2s',
                    fontWeight: 500, fontSize: '0.875rem'
                  }}
                >
                  <Archive size={18} />
                  Mes Archives
                </Link>
              </>
            )}


          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          
          {/* Install Button */}
          {isInstallable && (
            <button 
              onClick={promptInstall}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}
            >
              <Download size={14} /> <span className="desktop-only">Installer</span>
            </button>
          )}

          {/* Indicateur de Réseau */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: '20px', backgroundColor: isOnline ? '#dcfce7' : '#fee2e2', color: isOnline ? '#16a34a' : '#dc2626' }}>
            {isOnline ? <Cloud size={16} /> : <CloudOff size={16} />}
            <span className="desktop-only">{isOnline ? 'En ligne' : 'Hors-ligne'}</span>
            {pendingNotes?.length > 0 && (
              <span style={{ marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#b45309' }}>
                <RefreshCw size={12} className={isOnline ? 'spin-anim' : ''} />
                {pendingNotes.length} en attente
              </span>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              width: '36px', height: '36px', borderRadius: '8px', 
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s'
            }}
            title={theme === 'dark' ? "Passer en mode clair" : "Passer en mode sombre"}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button 
            onClick={clearCacheAndReload}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              width: '36px', height: '36px', borderRadius: '8px', 
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s',
              marginRight: '0.5rem'
            }}
            title="Vider le cache et forcer la mise à jour de l'application"
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
          >
            <Eraser size={18} />
          </button>

          <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', padding: '0.25rem 0.5rem', borderRadius: '8px', transition: 'background-color 0.2s' }} className="hover-bg-light">
            <div className="desktop-only" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{user?.name || "Utilisateur"}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role === 'superadmin' ? 'Super Admin' : 'Déclarant'}</div>
            </div>
            <div style={{ 
              width: '36px', height: '36px', borderRadius: '50%', 
              backgroundColor: 'var(--accent-light)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
              color: 'var(--accent-primary)', border: '2px solid var(--accent-primary)',
              overflow: 'hidden'
            }}>
              {profileLogo ? <img src={profileLogo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.name?.substring(0, 2).toUpperCase() || "US")}
            </div>
          </Link>
          
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>
          
          <button 
            className="desktop-only"
            onClick={logout}
            style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', 
            backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
            fontWeight: 500, transition: 'color 0.2s', fontSize: '0.85rem'
          }}>
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </header>

      {/* Subscription Banners */}
      {daysRemaining !== null && daysRemaining <= 14 && daysRemaining > 0 && (
        <div style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '0.75rem', textAlign: 'center', color: '#b45309', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <strong>Attention :</strong> Votre abonnement expire dans {daysRemaining} jour(s). Veuillez contacter le support administrateur pour le renouveler.
        </div>
      )}
      {daysRemaining !== null && daysRemaining <= 0 && (
        <div style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '0.75rem', textAlign: 'center', color: '#dc2626', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <strong>Abonnement Expiré :</strong> Votre abonnement est arrivé à terme. Vous ne pouvez plus saisir de notes. Veuillez contacter le support.
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        <div className="content-scrollable">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="bottom-nav mobile-only">
        {user?.role === 'superadmin' && (
          <Link to="/dashboard" className={`bottom-nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}>
            <LayoutDashboard size={24} />
            <span>Dashboard</span>
          </Link>
        )}
        {user?.role === 'declarant' && (
          <>
            <Link to="/note/new" className={`bottom-nav-item ${location.pathname === '/note/new' ? 'active' : ''}`}>
              <FilePlus size={24} />
              <span>Note</span>
            </Link>
            <Link to="/archives" className={`bottom-nav-item ${location.pathname === '/archives' ? 'active' : ''}`}>
              <Archive size={24} />
              <span>Archives</span>
            </Link>
          </>
        )}
        <button onClick={logout} className="bottom-nav-item" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <LogOut size={24} />
          <span>Quitter</span>
        </button>
      </nav>
    </div>
  );
};

export default AppLayout;
