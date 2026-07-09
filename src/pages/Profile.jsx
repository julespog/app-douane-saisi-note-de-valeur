import React, { useState, useContext, useEffect } from 'react';
import { CreditCard, Lock, Upload, FileText, Database, CheckCircle } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { DatabaseContext } from '../context/DatabaseContext';

const Profile = () => {
  const { user, profileLogo, changePassword } = useContext(UserContext);
  const { documents, uploadDocument } = useContext(DatabaseContext);
  const [activeTab, setActiveTab] = useState('documents');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Excel Mapping State
  const [mapping, setMapping] = useState({
    codeSH: 'Code SH',
    taux: 'Taux DD',
    description: 'Désignation',
    unite: 'Unité'
  });

  useEffect(() => {
    if (user?.role === 'superadmin') {
      setActiveTab('securite');
    } else {
      setActiveTab('abonnement');
    }
  }, [user]);

  const handleFileUpload = async (key, e) => {
    if (e.target.files && e.target.files[0]) {
      try {
        await uploadDocument(key, e.target.files[0]);
        alert(`Document ${key} importé avec succès !`);
      } catch (err) {
        alert("Erreur lors de l'importation.");
      }
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    try {
      await changePassword(user.id, oldPassword, newPassword);
      alert("Mot de passe modifié avec succès !");
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      alert(err.message);
    }
  };

  const adminTabs = [
    { id: 'securite', label: 'Sécurité & Mot de passe', icon: <Lock size={18} /> }
  ];

  const declarantTabs = [
    { id: 'abonnement', label: 'Mon Abonnement', icon: <CreditCard size={18} /> },
    { id: 'securite', label: 'Sécurité & Mot de passe', icon: <Lock size={18} /> }
  ];

  const tabs = (user?.role === 'superadmin') ? adminTabs : declarantTabs;

  const cardStyle = {
    backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem', boxShadow: 'var(--shadow-sm)', animation: 'fadeIn 0.3s ease-out'
  };
  const inputStyle = {
    width: '100%', padding: '0.6rem 0.8rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', color: 'var(--text-primary)'
  };
  const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' };

  return (
    <div className="fade-in" style={{ padding: '2rem 0', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '2rem' }}>Mon Profil</h1>
      
      <div className="flex-stack-mobile" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        {/* Sidebar Tabs */}
        <div className="w-100-mobile" style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tabs.map(t => (
            <button 
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', width: '100%', textAlign: 'left',
                backgroundColor: activeTab === t.id ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === t.id ? 'white' : 'var(--text-secondary)',
                border: activeTab === t.id ? 'none' : '1px solid transparent',
                borderRadius: '8px', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s'
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="w-100-mobile" style={{ flex: 1 }}>
          
          {/* --- ADMIN VIEWS (Removed obsolete ones) --- */}

          {/* --- DECLARANT VIEWS --- */}
          {activeTab === 'abonnement' && user?.role === 'declarant' && (
             <div style={cardStyle}>
               <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Abonnement de l'Entreprise</h2>
               <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                   <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Plan d'accès</h3>
                   <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                     Valable jusqu'au {new Date(user.company?.subscription?.endDate || Date.now()).toLocaleDateString('fr-FR')}
                   </p>
                   {(() => {
                     const end = new Date(user.company?.subscription?.endDate || Date.now());
                     const now = new Date();
                     const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
                     if (diff > 0) {
                       return (
                         <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', fontWeight: 600, color: diff <= 14 ? '#b45309' : 'var(--accent-primary)' }}>
                           Il vous reste {diff} jour(s) d'accès
                         </div>
                       );
                     } else {
                       return (
                         <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--danger)' }}>
                           Expiré depuis {Math.abs(diff)} jour(s)
                         </div>
                       );
                     }
                   })()}
                 </div>
                 {new Date() > new Date(user.company?.subscription?.endDate) ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 600, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem 1rem', borderRadius: '20px' }}>
                     <Lock size={16} /> Expiré
                   </div>
                 ) : (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem 1rem', borderRadius: '20px' }}>
                     <CheckCircle size={16} /> Actif
                   </div>
                 )}
               </div>
               <div style={{ marginTop: '2rem' }}>
                 <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                   * L'abonnement est géré au niveau de votre entreprise et partagé avec tous vos agents. Pour renouveler votre abonnement, veuillez contacter directement le support administrateur.
                 </p>
               </div>
             </div>
          )}

          {/* --- COMMON VIEWS --- */}
          {activeTab === 'securite' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Modifier le mot de passe</h2>
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
                <div><label style={labelStyle}>Mot de passe actuel</label><input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Nouveau mot de passe</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Confirmer le nouveau mot de passe</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required /></div>
                <button type="submit" style={{ padding: '0.75rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}>Sauvegarder le mot de passe</button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Profile;
