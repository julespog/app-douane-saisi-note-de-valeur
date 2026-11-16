import React, { useState, useContext, useEffect } from 'react';
import { CreditCard, Lock, Upload, FileText, Database, CheckCircle, Building } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { DatabaseContext } from '../context/DatabaseContext';

const Profile = () => {
  const { user, profileLogo, changePassword, updateCompany } = useContext(UserContext);
  const { documents, uploadDocument } = useContext(DatabaseContext);
  const [activeTab, setActiveTab] = useState('documents');

  const [companyLogo, setCompanyLogo] = useState(user?.company?.logo || null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoSuccess, setLogoSuccess] = useState(false);

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
      setActiveTab('entreprise');
    }
    if (user?.company?.logo) {
      setCompanyLogo(user.company.logo);
    }
  }, [user]);

  const handleLogoFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setCompanyLogo(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCompanyLogo = async () => {
    if (!user?.companyId) return;
    setIsSavingLogo(true);
    setLogoSuccess(false);
    try {
      await updateCompany(user.companyId, { logo: companyLogo });
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 4000);
    } catch (err) {
      alert("Erreur lors de l'enregistrement du logo: " + err.message);
    } finally {
      setIsSavingLogo(false);
    }
  };

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
    { id: 'entreprise', label: 'Mon Entreprise & Logo', icon: <Building size={18} /> },
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
          {activeTab === 'entreprise' && user?.role === 'declarant' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>
                Informations & Logo de l'Entreprise
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {user?.company?.name || 'Mon Entreprise'}
                  </div>
                  {user?.company?.legalInfo?.nif && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>NIF : {user.company.legalInfo.nif}</div>
                  )}
                  {user?.company?.legalInfo?.rccm && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>RCCM : {user.company.legalInfo.rccm}</div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Logo officiel pour vos notes de détail</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
                    <div style={{ 
                      width: '120px', height: '80px', borderRadius: '8px', border: '2px dashed var(--border-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff',
                      overflow: 'hidden', padding: '4px'
                    }}>
                      {companyLogo && !companyLogo.includes('cjxramixzefbrsaweuoz') ? (
                        <img src={companyLogo} alt="Logo Entreprise" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                          <Building size={24} style={{ margin: '0 auto 4px auto' }} />
                          Aucun logo
                        </div>
                      )}
                    </div>

                    <div>
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg" 
                        id="logo-upload-input" 
                        style={{ display: 'none' }} 
                        onChange={handleLogoFileChange}
                      />
                      <label 
                        htmlFor="logo-upload-input" 
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.6rem 1rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)'
                        }}
                      >
                        <Upload size={16} /> Choisir une image
                      </label>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                        Format PNG ou JPEG
                      </div>
                    </div>
                  </div>
                </div>

                {logoSuccess && (
                  <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={16} /> Logo enregistré avec succès ! Il apparaîtra sur toutes vos prochaines notes.
                  </div>
                )}

                <button 
                  onClick={handleSaveCompanyLogo}
                  disabled={isSavingLogo}
                  style={{
                    padding: '0.75rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: 'white',
                    border: 'none', borderRadius: '6px', fontWeight: 600, cursor: isSavingLogo ? 'not-allowed' : 'pointer',
                    opacity: isSavingLogo ? 0.7 : 1, width: 'fit-content'
                  }}
                >
                  {isSavingLogo ? 'Enregistrement en cours...' : 'Enregistrer le logo'}
                </button>
              </div>
            </div>
          )}

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
