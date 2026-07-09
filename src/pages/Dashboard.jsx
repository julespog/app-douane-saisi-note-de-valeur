import React, { useState, useContext, useEffect } from 'react';
import { Building, Users, UserPlus, Edit3, Trash2, CheckCircle, Plus, ChevronLeft, Save, X, FileText, RefreshCw } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', width: '90%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-light)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}><X size={18} /></button>
        </div>
        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, getCompanies, getUsers, createCompany, updateCompany, createUser, removeUser, renewSubscription } = useContext(UserContext);
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [notesStats, setNotesStats] = useState({}); // { companyId: { total, monthly } }
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('infos'); // 'infos' ou 'agents'
  const [editCompany, setEditCompany] = useState(null);

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewDays, setRenewDays] = useState(30);
  
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', email: '', password: '' });

  const [customAlert, setCustomAlert] = useState(null);

  useEffect(() => {
    if (user?.role !== 'superadmin') {
      navigate('/note/new');
      return;
    }
    refreshData();
  }, [user]);

  const refreshData = async () => {
    try {
      const companiesData = await getCompanies();
      const usersData = await getUsers();
      setCompanies(companiesData || []);
      setAllUsers(usersData || []);

      // Charger les stats de notes par entreprise
      const { data: notesData } = await supabase
        .from('notes_history')
        .select('company_id, created_at');

      if (notesData) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const stats = {};
        notesData.forEach(n => {
          const cid = n.company_id;
          if (!cid) return;
          if (!stats[cid]) stats[cid] = { total: 0, monthly: 0 };
          stats[cid].total += 1;
          if (new Date(n.created_at) >= startOfMonth) stats[cid].monthly += 1;
        });
        setNotesStats(stats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompanyLogoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditCompany({...editCompany, logo: event.target.result});
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleLegalInfoChange = (e) => {
    const { name, value } = e.target;
    if (name === 'name') {
      setEditCompany({ ...editCompany, name: value });
    } else {
      setEditCompany({
        ...editCompany,
        legalInfo: { ...editCompany.legalInfo, [name]: value }
      });
    }
  };

  const saveCompanyInfos = async () => {
    try {
      await updateCompany(selectedCompany.id, { 
        name: editCompany.name, 
        legalInfo: editCompany.legalInfo || {}, 
        logo: editCompany.logo,
        footer_text: editCompany.footer_text || ''
      });
      alert("Informations de l'entreprise mises à jour !");
      await refreshData();
      setSelectedCompany({ ...selectedCompany, name: editCompany.name, legalInfo: editCompany.legalInfo, logo: editCompany.logo, footer_text: editCompany.footer_text });
      setIsDetailsModalOpen(false);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleAddCompanySubmit = async (e) => {
    e.preventDefault();
    try {
      await createCompany({ 
        name: editCompany.name, 
        legalInfo: editCompany.legalInfo, 
        logo: editCompany.logo,
        footer_text: editCompany.footer_text || '' 
      });
      await refreshData();
      setIsAddModalOpen(false);
      alert("Entreprise ajoutée avec succès !");
    } catch (err) {
      alert(err.message);
    }
  };

  const openAddModal = () => {
    setEditCompany({ name: '', legalInfo: { nif: '', rccm: '', email: '', phone: '', address: '' }, logo: null, footer_text: '' });
    setIsAddModalOpen(true);
  };

  const openCompanyDetails = (comp) => {
    setSelectedCompany(comp);
    setEditCompany({
      name: comp.name,
      legalInfo: comp.legalInfo || { nif: '', rccm: '', email: '', phone: '', address: '' },
      logo: comp.logo || null,
      footer_text: comp.footer_text || ''
    });
    setActiveSubTab('infos');
    setIsDetailsModalOpen(true);
  };

  const handleRenewSubscriptionClick = (comp = selectedCompany) => {
    setSelectedCompany(comp);
    setRenewDays(30);
    setRenewModalOpen(true);
  };

  const submitRenewSubscription = async () => {
    if (!isNaN(renewDays) && renewDays !== '') {
      try {
        await renewSubscription(selectedCompany.id, parseInt(renewDays));
        setCustomAlert({ type: 'success', message: "Abonnement modifié avec succès !" });
        setRenewModalOpen(false);
        await refreshData();
        const companiesData = await getCompanies();
        const updated = companiesData.find(c => c.id === selectedCompany.id);
        if(updated) setSelectedCompany(updated);
      } catch (e) {
        setCustomAlert({ type: 'error', message: e.message });
      }
    }
  };

  const openAddAgentModal = (comp = selectedCompany) => {
    setSelectedCompany(comp);
    setNewAgent({ name: '', email: '', password: generateDefaultPassword() });
    setAddAgentModalOpen(true);
  };

  const generateDefaultPassword = () => {
    return Math.random().toString(36).slice(-8) + "!";
  };

  const submitAddAgent = async () => {
    if (newAgent.name && newAgent.email && newAgent.password) {
      try {
        await createUser({ ...newAgent, role: 'declarant', companyId: selectedCompany.id });
        await refreshData();
        setAddAgentModalOpen(false);
        setCustomAlert({ type: 'success', message: "Agent ajouté avec succès." });
      } catch (e) {
        setCustomAlert({ type: 'error', message: e.message });
      }
    }
  };

  const handleDeleteAgentClick = (agentId) => {
    setCustomAlert({
      type: 'confirm',
      title: "Supprimer l'agent",
      message: "Voulez-vous vraiment supprimer cet agent ? Cette action est irréversible.",
      onConfirm: async () => {
        try {
          await removeUser(agentId);
          await refreshData();
          setCustomAlert({ type: 'success', message: "Agent supprimé." });
        } catch (e) {
          setCustomAlert({ type: 'error', message: e.message });
        }
      },
      onCancel: () => setCustomAlert(null)
    });
  };

  const inputStyle = {
    width: '100%', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', outline: 'none', color: 'var(--text-primary)', fontSize: '0.95rem'
  };
  const labelStyle = { display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' };

  const activeCompaniesCount = companies.filter(c => c.id !== 'c_admin' && new Date(c.subscription?.endDate) > new Date()).length;
  const totalUsersCount = allUsers.filter(u => u.role === 'declarant').length;

  if (user?.role !== 'superadmin') return null;

  return (
    <div className="fade-in" style={{ padding: '2rem 0', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '2rem' }}>Tableau de Bord Administrateur</h1>

      {/* KPI Cards */}
      <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
            <Building size={24} color="var(--accent-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Entreprises Actives</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{activeCompaniesCount}</div>
          </div>
        </div>
        
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
            <Users size={24} color="var(--success)" />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Déclarants Enregistrés</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalUsersCount}</div>
          </div>
        </div>
      </div>

      {/* Tableau des entreprises */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--accent-primary)' }}>Liste des Entreprises</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={async () => { setIsRefreshing(true); await refreshData(); setIsRefreshing(false); }}
              title="Actualiser les statistiques"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            >
              <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              {isRefreshing ? 'Actualisation...' : 'Actualiser'}
            </button>
            <button onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={16} /> Ajouter une Entreprise
            </button>
          </div>
        </div>
        
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
             <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Nom de l'entreprise</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Agents</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Notes ce mois</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Notes total</th>
              <th style={{ padding: '0.75rem 1rem' }}>Abonnement</th>
              <th style={{ padding: '0.75rem 1rem' }}>NIF</th>
            </tr>
          </thead>
          <tbody>
            {companies.filter(c => c.id !== 'c_admin').map(comp => {
              const daysRemaining = Math.ceil((new Date(comp.subscription?.endDate || Date.now()) - new Date()) / (1000 * 60 * 60 * 24));
              const isActive = daysRemaining > 0;
              const compUsersCount = allUsers.filter(u => u.companyId === comp.id && u.role === 'declarant').length;
              return (
                <tr key={comp.id} onClick={() => openCompanyDetails(comp)} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--bg-tertiary)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                  <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      {comp.logo ? <img src={comp.logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Building size={16} color="var(--text-muted)" />}
                    </div>
                    {comp.name}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }} onClick={(e) => { e.stopPropagation(); openAddAgentModal(comp); }}>
                      Ajouter Agent
                    </button>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {(notesStats[comp.id]?.monthly) || 0}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ce mois</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {(notesStats[comp.id]?.total) || 0}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>total</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button style={{ backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isActive ? 'var(--success)' : 'var(--danger)', border: '1px solid', borderColor: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleRenewSubscriptionClick(comp); }}>
                      {isActive ? `Actif (${daysRemaining} j.)` : 'Expiré'}
                    </button>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{comp.legalInfo?.nif || '-'}</td>
                </tr>
              )
            })}
            {companies.filter(c => c.id !== 'c_admin').length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune entreprise enregistrée.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* POPUP : NOUVELLE ENTREPRISE */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Ajouter une Nouvelle Entreprise">
        <form onSubmit={handleAddCompanySubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Nom de l'entreprise *</label>
              <input name="name" style={inputStyle} value={editCompany?.name || ''} onChange={handleLegalInfoChange} required />
            </div>
            <div>
              <label style={labelStyle}>Numéro NIF</label>
              <input name="nif" style={inputStyle} value={editCompany?.legalInfo?.nif || ''} onChange={handleLegalInfoChange} />
            </div>
            <div>
              <label style={labelStyle}>Numéro RCCM</label>
              <input name="rccm" style={inputStyle} value={editCompany?.legalInfo?.rccm || ''} onChange={handleLegalInfoChange} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Pied de page (S'affiche en bas des impressions)</label>
              <input name="footer_text" style={inputStyle} value={editCompany?.footer_text || ''} onChange={(e) => setEditCompany({...editCompany, footer_text: e.target.value})} placeholder="Ex: FAST Dédouanement | NIF : 12345 | BP : 0000 Libreville" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}>Annuler</button>
            <button type="submit" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}>Créer l'entreprise</button>
          </div>
        </form>
      </Modal>

      {/* POPUP : DÉTAILS DE L'ENTREPRISE */}
      <Modal isOpen={isDetailsModalOpen && selectedCompany} onClose={() => setIsDetailsModalOpen(false)} title={`Dossier : ${selectedCompany?.name}`}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <button onClick={() => setActiveSubTab('infos')} style={{ padding: '1rem', background: 'none', border: 'none', borderBottom: activeSubTab === 'infos' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeSubTab === 'infos' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Informations Légales & Logo</button>
          <button onClick={() => setActiveSubTab('agents')} style={{ padding: '1rem', background: 'none', border: 'none', borderBottom: activeSubTab === 'agents' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeSubTab === 'agents' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Membres (Agents)</button>
        </div>

        {activeSubTab === 'infos' && editCompany && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                {editCompany.logo ? <img src={editCompany.logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Building size={32} color="#94a3b8" />}
              </div>
              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.85rem' }}>
                  Modifier le logo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCompanyLogoUpload} />
                </label>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <button onClick={() => handleRenewSubscriptionClick(selectedCompany)} style={{ padding: '0.6rem 1rem', backgroundColor: '#e0e7ff', color: 'var(--accent-primary)', border: '1px solid #c7d2fe', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  Renouveler Abonnement
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Nom de l'entreprise</label>
                <input name="name" style={inputStyle} value={editCompany.name} onChange={handleLegalInfoChange} />
              </div>
              <div>
                <label style={labelStyle}>Numéro NIF</label>
                <input name="nif" style={inputStyle} value={editCompany.legalInfo.nif} onChange={handleLegalInfoChange} />
              </div>
              <div>
                <label style={labelStyle}>Numéro RCCM</label>
                <input name="rccm" style={inputStyle} value={editCompany.legalInfo.rccm} onChange={handleLegalInfoChange} />
              </div>
              <div>
                <label style={labelStyle}>Email Principal</label>
                <input name="email" style={inputStyle} value={editCompany.legalInfo.email} onChange={handleLegalInfoChange} />
              </div>
              <div>
                <label style={labelStyle}>Téléphone</label>
                <input name="phone" style={inputStyle} value={editCompany.legalInfo.phone} onChange={handleLegalInfoChange} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Adresse physique</label>
                <input name="address" style={inputStyle} value={editCompany?.legalInfo?.address || ''} onChange={handleLegalInfoChange} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1rem' }}>
              <label style={labelStyle}>Pied de page (Texte à afficher en bas des impressions)</label>
              <input name="footer_text" style={inputStyle} value={editCompany?.footer_text || ''} onChange={(e) => setEditCompany({...editCompany, footer_text: e.target.value})} placeholder="Ex: FAST Dédouanement | NIF : 12345 | BP : 0000 Libreville" />
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={saveCompanyInfos} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}>
                <Save size={16} /> Enregistrer
              </button>
            </div>
          </div>
        )}

        {activeSubTab === 'agents' && selectedCompany && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Gérez les accès pour cette entreprise.</p>
              <button onClick={() => openAddAgentModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}>
                <UserPlus size={16} /> Ajouter un utilisateur
              </button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Nom de l'utilisateur</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Email de connexion</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.filter(u => u.companyId === selectedCompany.id && u.role === 'declarant').map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button onClick={() => handleDeleteAgentClick(u.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} title="Supprimer l'accès"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {allUsers.filter(u => u.companyId === selectedCompany.id && u.role === 'declarant').length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun agent enregistré pour cette entreprise.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Renew Subscription Modal */}
      <Modal isOpen={renewModalOpen} onClose={() => setRenewModalOpen(false)} title="Renouveler l'abonnement">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <label style={labelStyle}>Nombre de jours à appliquer (depuis aujourd'hui)</label>
          <input type="number" style={inputStyle} value={renewDays} onChange={(e) => setRenewDays(e.target.value)} />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mettre un nombre réduit permet de diminuer la période restante d'un utilisateur.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => setRenewModalOpen(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Annuler</button>
            <button onClick={submitRenewSubscription} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Appliquer</button>
          </div>
        </div>
      </Modal>

      {/* Add Agent Modal */}
      <Modal isOpen={addAgentModalOpen} onClose={() => setAddAgentModalOpen(false)} title="Ajouter un utilisateur">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Nom de l'agent *</label>
            <input style={inputStyle} value={newAgent.name} onChange={(e) => setNewAgent({...newAgent, name: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Email de connexion *</label>
            <input type="email" style={inputStyle} value={newAgent.email} onChange={(e) => setNewAgent({...newAgent, email: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Mot de passe par défaut *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input style={{...inputStyle, flex: 1}} value={newAgent.password} onChange={(e) => setNewAgent({...newAgent, password: e.target.value})} />
              <button onClick={() => setNewAgent({...newAgent, password: generateDefaultPassword()})} style={{ padding: '0 1rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Générer</button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => setAddAgentModalOpen(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Annuler</button>
            <button onClick={submitAddAgent} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Créer l'utilisateur</button>
          </div>
        </div>
      </Modal>

      {/* Custom Alert/Confirm */}
      {customAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            {customAlert.type === 'confirm' ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>{customAlert.title}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{customAlert.message}</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button onClick={customAlert.onCancel} style={{ padding: '0.6rem 1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-primary)' }}>Annuler</button>
                  <button onClick={customAlert.onConfirm} style={{ padding: '0.6rem 1.5rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--danger)', color: 'white', cursor: 'pointer' }}>Confirmer</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', color: customAlert.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
                  {customAlert.type === 'error' ? <X size={48} /> : <CheckCircle size={48} />}
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{customAlert.message}</p>
                <button onClick={() => setCustomAlert(null)} style={{ padding: '0.6rem 2rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'white', cursor: 'pointer' }}>OK</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
