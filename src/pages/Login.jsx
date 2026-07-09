import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Lock, Mail, Download } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import PDFDownloadProgress from '../components/PDFDownloadProgress';

import bgImage from '../assets/logistics_bg.png';
import fastLogo from '../assets/fast-logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(UserContext);
  const { isInstallable, promptInstall, isDownloading, progress, currentFile, totalFiles } = usePWAInstall();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/note/new');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-wrapper" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      minHeight: '100vh', 
      backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.85)), url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      padding: '1rem'
    }}>
      <PDFDownloadProgress isDownloading={isDownloading} progress={progress} currentFile={currentFile} totalFiles={totalFiles} />
      
      {/* Cercles de décoration en arrière-plan */}
      <div className="bg-circle circle-1"></div>
      
      <div className="glass-panel fade-in" style={{
        width: '100%', maxWidth: '420px', padding: '3rem 2.5rem',
        display: 'flex', flexDirection: 'column', gap: '2rem',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src={fastLogo} alt="FAST Logo" style={{ height: '48px', marginBottom: '0.2rem', objectFit: 'contain' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, margin: '0 0 1.5rem 0', color: 'var(--accent-primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>GNAMATECH 1.0</h2>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Espace Sécurisé</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Connectez-vous pour accéder à vos outils déclaratifs
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="premium-label">Adresse Email</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '1rem', color: 'var(--text-muted)' }}>
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                className="premium-input" 
                placeholder="contact@entreprise.com"
                style={{ paddingLeft: '2.75rem', backgroundColor: 'var(--bg-tertiary)' }}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
              />
            </div>
          </div>

          <div>
            <label className="premium-label">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '1rem', color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                className="premium-input" 
                placeholder="••••••••"
                style={{ paddingLeft: '2.75rem', backgroundColor: 'var(--bg-tertiary)' }}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                required
              />
            </div>
          </div>

          <button type="submit" className="premium-btn" style={{ marginTop: '0.5rem', padding: '0.85rem', fontSize: '1rem' }}>
            Se connecter
          </button>

          {isInstallable && (
            <button 
              type="button" 
              onClick={promptInstall}
              style={{ 
                marginTop: '0.5rem', padding: '0.85rem', fontSize: '1rem', 
                backgroundColor: '#10b981', color: 'white', border: 'none', 
                borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              <Download size={20} /> Installer l'application
            </button>
          )}
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} GNAMATECH 1.0 - Édité par Fast International. Tous droits réservés.
        </div>
      </div>
    </div>
  );
};

export default Login;
