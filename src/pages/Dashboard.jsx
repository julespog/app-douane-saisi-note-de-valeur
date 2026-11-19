import React, { useState, useContext, useEffect } from 'react';
import { 
  Building, Users, UserPlus, Edit3, Trash2, CheckCircle, Plus, ChevronLeft, Save, X, 
  FileText, RefreshCw, Upload, Folder, Eye, Download, BookOpen, Bot, Key, Cpu, EyeOff, ShieldCheck, Zap 
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { supabase, customFetch } from '../supabaseClient';
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

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Ko';
  const k = 1024;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const Dashboard = () => {
  const { user, getCompanies, getUsers, createCompany, updateCompany, createUser, removeUser, renewSubscription } = useContext(UserContext);
  const navigate = useNavigate();

  // Navigation tab : 'companies' | 'documents' | 'ai'
  const [mainTab, setMainTab] = useState('companies');

  const [companies, setCompanies] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [notesStats, setNotesStats] = useState({}); // { companyId: { total, monthly } }
  const [aiStats, setAiStats] = useState({}); // { companyId: { total, monthly } }
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Custom documentation states
  const [customDocs, setCustomDocs] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newDocData, setNewDocData] = useState({
    name: '',
    category: 'Note de Service et Arretes Douane',
    customCategory: '',
    file: null
  });

  // AI Configuration states
  const [aiSettings, setAiSettings] = useState({
    active_provider: 'claude',
    claude_api_key: '',
    claude_model: 'claude-3-5-sonnet-20241022',
    gemini_api_key: '',
    gemini_model: 'gemini-2.5-flash',
    groq_api_key: ''
  });
  const [aiSettingsLoading, setAiSettingsLoading] = useState(false);
  const [aiSettingsSaving, setAiSettingsSaving] = useState(false);
  const [showKeys, setShowKeys] = useState({ claude: false, gemini: false, groq: false });
  const [testResults, setTestResults] = useState({});

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
    fetchCustomDocs();
    fetchAiSettings();
  }, [user]);

  const refreshData = async () => {
    try {
      const companiesData = await getCompanies();
      const usersData = await getUsers();
      setCompanies(companiesData || []);
      setAllUsers(usersData || []);

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

      const { data: aiData } = await supabase
        .from('ai_queries')
        .select('company_id, created_at');

      if (aiData) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const stats = {};
        aiData.forEach(n => {
          const cid = n.company_id;
          if (!cid) return;
          if (!stats[cid]) stats[cid] = { total: 0, monthly: 0 };
          stats[cid].total += 1;
          if (new Date(n.created_at) >= startOfMonth) stats[cid].monthly += 1;
        });
        setAiStats(stats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomDocs = async () => {
    setDocLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomDocs(data || []);
    } catch (err) {
      console.error("Erreur chargement documents :", err);
    } finally {
      setDocLoading(false);
    }
  };

  const fetchAiSettings = async () => {
    setAiSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (data) {
        setAiSettings({
          active_provider: data.active_provider || 'claude',
          claude_api_key: data.claude_api_key || '',
          claude_model: data.claude_model || 'claude-3-5-sonnet-20241022',
          gemini_api_key: data.gemini_api_key || '',
          gemini_model: data.gemini_model || 'gemini-2.5-flash',
          groq_api_key: data.groq_api_key || ''
        });
      }
    } catch (err) {
      console.warn("Erreur chargement ai_settings :", err);
    } finally {
      setAiSettingsLoading(false);
    }
  };

  const handleSaveAiSettings = async (e) => {
    if (e) e.preventDefault();
    setAiSettingsSaving(true);
    try {
      const { error } = await supabase
        .from('ai_settings')
        .upsert({
          id: 'default',
          active_provider: aiSettings.active_provider,
          claude_api_key: aiSettings.claude_api_key ? aiSettings.claude_api_key.trim() : '',
          claude_model: aiSettings.claude_model,
          gemini_api_key: aiSettings.gemini_api_key ? aiSettings.gemini_api_key.trim() : '',
          gemini_model: aiSettings.gemini_model,
          groq_api_key: aiSettings.groq_api_key ? aiSettings.groq_api_key.trim() : '',
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      setCustomAlert({
        type: 'success',
        message: "Clés d'API et paramètres d'IA enregistrés avec succès ! Prise d'effet immédiate sur le web et l'application Windows."
      });
    } catch (err) {
      setCustomAlert({
        type: 'error',
        message: err.message || "Erreur lors de l'enregistrement des paramètres IA."
      });
    } finally {
      setAiSettingsSaving(false);
    }
  };

  const handleTestKey = async (provider) => {
    setTestResults(prev => ({ ...prev, [provider]: { testing: true } }));
    const apiBase = (typeof window !== 'undefined' && (window.__TAURI__ || window.location.origin.includes('localhost') || window.location.origin.includes('tauri'))) ? 'https://gnamatech.com' : '';
    
    let keyToTest = '';
    let modelToTest = '';
    if (provider === 'claude') {
      keyToTest = aiSettings.claude_api_key;
      modelToTest = aiSettings.claude_model;
    } else if (provider === 'gemini') {
      keyToTest = aiSettings.gemini_api_key;
      modelToTest = aiSettings.gemini_model;
    } else if (provider === 'groq') {
      keyToTest = aiSettings.groq_api_key;
    }

    if (!keyToTest || !keyToTest.trim()) {
      setTestResults(prev => ({
        ...prev,
        [provider]: { testing: false, ok: false, message: "Veuillez saisir une clé d'API avant de tester." }
      }));
      return;
    }

    try {
      const res = await customFetch(`${apiBase}/api/ai/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: keyToTest.trim(), model: modelToTest })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResults(prev => ({
          ...prev,
          [provider]: { testing: false, ok: true, message: `✅ ${data.message || 'Connexion réussie !'}` }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [provider]: { testing: false, ok: false, message: `❌ ${data.error || 'Erreur lors du test de connexion.'}` }
        }));
      }
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [provider]: { testing: false, ok: false, message: `❌ Erreur réseau : ${err.message}` }
      }));
    }
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!newDocData.file || !newDocData.name.trim()) {
      setCustomAlert({ type: 'error', message: 'Veuillez saisir un titre et sélectionner un fichier PDF.' });
      return;
    }

    const file = newDocData.file;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setCustomAlert({ type: 'error', message: 'Seuls les fichiers PDF sont acceptés.' });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setCustomAlert({ type: 'error', message: 'Le fichier dépasse la taille maximale autorisée (50 Mo).' });
      return;
    }

    const finalCategory = newDocData.category === '__custom__'
      ? (newDocData.customCategory.trim() || 'Autres Documents')
      : newDocData.category;

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `custom/${Date.now()}_${cleanFileName}`;

    try {
      setIsUploadingDoc(true);
      const { data: uploadRes, error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(storagePath);

      const { error: insertErr } = await supabase
        .from('custom_documents')
        .insert([{
          name: newDocData.name.trim(),
          category: finalCategory,
          file_url: publicUrl,
          file_path: storagePath,
          file_size: file.size
        }]);

      if (insertErr) throw insertErr;

      setCustomAlert({ 
        type: 'success', 
        message: 'Document douanier ajouté avec succès ! Il apparaît immédiatement dans la documentation.' 
      });
      setIsDocModalOpen(false);
      setNewDocData({ name: '', category: 'Note de Service et Arretes Douane', customCategory: '', file: null });
      await fetchCustomDocs();
    } catch (err) {
      console.error("Erreur lors de l'upload du document :", err);
      setCustomAlert({ type: 'error', message: err.message || "Erreur lors du téléversement du document." });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocClick = (doc) => {
    setCustomAlert({
      type: 'confirm',
      title: "Supprimer ce document",
      message: `Voulez-vous vraiment supprimer "${doc.name}" ? Il sera retiré de la documentation pour tous les utilisateurs.`,
      onConfirm: async () => {
        try {
          if (doc.file_path) {
            await supabase.storage.from('documents').remove([doc.file_path]);
          }
          await supabase.from('custom_documents').delete().eq('id', doc.id);
          setCustomAlert({ type: 'success', message: "Document supprimé." });
          await fetchCustomDocs();
        } catch (e) {
          setCustomAlert({ type: 'error', message: e.message || "Erreur lors de la suppression." });
        }
      },
      onCancel: () => setCustomAlert(null)
    });
  };

  const handleOpenDetails = (comp) => {
    setSelectedCompany(comp);
    setEditCompany({ ...comp, settings: { ...comp.settings } });
    setActiveSubTab('infos');
    setIsDetailsModalOpen(true);
  };

  const handleSaveCompanyDetails = async () => {
    try {
      await updateCompany(editCompany);
      await refreshData();
      setSelectedCompany(editCompany);
      setCustomAlert({ type: 'success', message: "Modifications enregistrées avec succès." });
    } catch (e) {
      setCustomAlert({ type: 'error', message: e.message });
    }
  };

  const handleRenewClick = () => {
    setRenewDays(30);
    setRenewModalOpen(true);
  };

  const submitRenewal = async () => {
    try {
      await renewSubscription(selectedCompany.id, parseInt(renewDays, 10));
      await refreshData();
      const updated = (await getCompanies()).find(c => c.id === selectedCompany.id);
      setSelectedCompany(updated);
      setEditCompany(updated);
      setRenewModalOpen(false);
      setCustomAlert({ type: 'success', message: `Abonnement prolongé de ${renewDays} jours.` });
    } catch (e) {
      setCustomAlert({ type: 'error', message: e.message });
    }
  };

  const openAddModal = () => {
    setEditCompany({
      name: '',
      nif: '',
      address: '',
      phone: '',
      email: '',
      logo: '',
      subscription: {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30*24*60*60*1000).toISOString()
      },
      settings: {
        declarationType: 'importation',
        cleDouane: '',
        cleCentre: '',
        regimeDouanier: '4000',
        bureauDouane: 'GA001',
        paysOrigine: 'GA',
        paysProvenance: 'GA',
        typeColis: 'CT',
        codeAdditionnel: '000',
        deviseParDefaut: 'EUR',
        tauxAssuranceParDefaut: '0.5'
      }
    });
    setIsAddModalOpen(true);
  };

  const submitCreateCompany = async () => {
    if (editCompany.name && editCompany.email) {
      try {
        await createCompany(editCompany);
        await refreshData();
        setIsAddModalOpen(false);
        setCustomAlert({ type: 'success', message: "Entreprise ajoutée avec succès." });
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
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Tableau de Bord Administrateur</h1>

      {/* Superadmin Tab Navigation */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setMainTab('companies')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: mainTab === 'companies' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: mainTab === 'companies' ? 'white' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: mainTab === 'companies' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none'
          }}
        >
          <Building size={18} />
          Entreprises & Déclarants
        </button>
        
        <button
          onClick={() => { setMainTab('documents'); fetchCustomDocs(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: mainTab === 'documents' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: mainTab === 'documents' ? 'white' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: mainTab === 'documents' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none'
          }}
        >
          <BookOpen size={18} />
          Documentation Douanière
          {customDocs.length > 0 && (
            <span style={{ backgroundColor: mainTab === 'documents' ? 'rgba(255,255,255,0.25)' : 'var(--accent-primary)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
              {customDocs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setMainTab('ai'); fetchAiSettings(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: mainTab === 'ai' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: mainTab === 'ai' ? 'white' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: mainTab === 'ai' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none'
          }}
        >
          <Bot size={18} />
          Configuration des IA
        </button>
      </div>

      {/* ONGLET 1 : ENTREPRISES & DECLARANTS */}
      {mainTab === 'companies' && (
        <div className="fade-in">
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
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>IA ce mois</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>IA total</th>
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
                    <tr 
                      key={comp.id} 
                      onClick={() => handleOpenDetails(comp)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {comp.logo ? (
                            <img src={comp.logo} alt="" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} />
                          ) : (
                            <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Building size={16} color="var(--text-muted)" />
                            </div>
                          )}
                          <span>{comp.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                          {compUsersCount}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {notesStats[comp.id]?.monthly || 0}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {notesStats[comp.id]?.total || 0}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: '#10B981' }}>
                        {aiStats[comp.id]?.monthly || 0}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {aiStats[comp.id]?.total || 0}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          color: isActive ? 'var(--success)' : 'var(--danger)', 
                          fontWeight: 600,
                          backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? 'var(--success)' : 'var(--danger)' }}></span>
                          {isActive ? `${daysRemaining}j restants` : 'Expiré'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{comp.nif || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : DOCUMENTATION DOUANIERE */}
      {mainTab === 'documents' && (
        <div className="fade-in">
          {/* KPI Cards Documents */}
          <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <FileText size={24} color="var(--accent-primary)" />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fichiers Personnalisés</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{customDocs.length}</div>
              </div>
            </div>
            
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <Folder size={24} color="var(--success)" />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Dossiers Cibles</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{new Set(customDocs.map(d => d.category)).size}</div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <Upload size={24} color="#ea580c" />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Taille Globale</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {formatFileSize(customDocs.reduce((acc, d) => acc + (d.file_size || 0), 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Tableau des Documents */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.25rem 0', color: 'var(--accent-primary)' }}>Documentation Douanière Personnalisée</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tous les documents chargés ici s'affichent automatiquement dans l'espace Documentation de tous les utilisateurs.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={fetchCustomDocs}
                  title="Actualiser la liste"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}
                >
                  <RefreshCw size={15} style={{ animation: docLoading ? 'spin 0.8s linear infinite' : 'none' }} />
                  Actualiser
                </button>
                <button
                  onClick={() => setIsDocModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)' }}
                >
                  <Plus size={16} /> Charger un Document PDF
                </button>
              </div>
            </div>

            {docLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem', width: '28px', height: '28px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                Chargement des documents...
              </div>
            ) : customDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-primary)' }}>
                <Folder size={48} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: '1rem' }} />
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Aucun document ajouté pour le moment</h3>
                <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '480px', marginInline: 'auto' }}>
                  Vous pouvez charger manuellement des arrêtés ministériels, notes de service, circulaires ou guides au format PDF. Ils apparaîtront instantanément dans l'explorateur de documentation.
                </p>
                <button
                  onClick={() => setIsDocModalOpen(true)}
                  className="premium-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Upload size={16} /> Charger un premier document
                </button>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Titre du document</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Dossier cible</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Taille</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Date d'ajout</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customDocs.map(doc => (
                      <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} color="var(--accent-primary)" />
                            <span>{doc.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {doc.category}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {new Date(doc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Visualiser le fichier"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', transition: 'all 0.2s' }}
                              onMouseOver={e => e.currentTarget.style.color = 'var(--accent-primary)'}
                              onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            >
                              <Eye size={16} />
                            </a>
                            <button
                              onClick={() => handleDeleteDocClick(doc)}
                              title="Supprimer ce document"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                              onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONGLET 3 : CONFIGURATION DES IA & CLES D'API */}
      {mainTab === 'ai' && (
        <div className="fade-in">
          {/* Header Info */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem', marginBottom: '2rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.9rem', borderRadius: '12px', backgroundColor: 'rgba(225, 29, 72, 0.1)' }}>
                <Bot size={28} color="var(--accent-primary)" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>
                  Gestion des Modèles d'Intelligence Artificielle & Clés d'API
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Configurez et sauvegardez directement les clés d'API de vos modèles. Les modifications prennent effet instantanément pour tous les utilisateurs (Web et Application Windows).
                </p>
              </div>
            </div>

            {/* Choix du Fournisseur Principal */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
              <label style={{ ...labelStyle, fontSize: '0.95rem', marginBottom: '0.8rem', color: 'var(--text-primary)' }}>
                Moteur d'IA Prioritaire pour la Recherche Tarifaire :
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {/* Option Claude */}
                <div 
                  onClick={() => setAiSettings({ ...aiSettings, active_provider: 'claude' })}
                  style={{ 
                    padding: '1.2rem', borderRadius: '10px', cursor: 'pointer',
                    border: aiSettings.active_provider === 'claude' ? '2px solid #e11d48' : '1px solid var(--border-color)',
                    backgroundColor: aiSettings.active_provider === 'claude' ? 'rgba(225, 29, 72, 0.05)' : 'var(--bg-tertiary)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Anthropic Claude</strong>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#e11d48', color: 'white', fontWeight: 600 }}>Recommandé</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Excellente précision pour l'interprétation des règles douanières CEMAC et la justification tarifaire.
                  </p>
                </div>

                {/* Option Gemini */}
                <div 
                  onClick={() => setAiSettings({ ...aiSettings, active_provider: 'gemini' })}
                  style={{ 
                    padding: '1.2rem', borderRadius: '10px', cursor: 'pointer',
                    border: aiSettings.active_provider === 'gemini' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    backgroundColor: aiSettings.active_provider === 'gemini' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-tertiary)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Google Gemini</strong>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', backgroundColor: 'var(--accent-primary)', color: 'white', fontWeight: 600 }}>Rapide</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Modèles Gemini 2.5 Flash / Pro. Très rapide et performant sur les recherches courantes.
                  </p>
                </div>

                {/* Option Groq */}
                <div 
                  onClick={() => setAiSettings({ ...aiSettings, active_provider: 'groq' })}
                  style={{ 
                    padding: '1.2rem', borderRadius: '10px', cursor: 'pointer',
                    border: aiSettings.active_provider === 'groq' ? '2px solid #10b981' : '1px solid var(--border-color)',
                    backgroundColor: aiSettings.active_provider === 'groq' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-tertiary)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Groq Cloud</strong>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#10b981', color: 'white', fontWeight: 600 }}>Ultra-Vitesse</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Vitesse d'inférence instantanée avec les modèles open source Llama / Qwen.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulaire des Clés d'API */}
          <form onSubmit={handleSaveAiSettings}>
            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
              
              {/* Carte 1 : Anthropic Claude */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Cpu size={22} color="#e11d48" />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 600 }}>Anthropic Claude API</h3>
                  </div>
                  {aiSettings.claude_api_key ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
                      <CheckCircle size={14} /> Clé configurée
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Non configurée</span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Clé d'API Anthropic (sk-ant-api03-...)</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type={showKeys.claude ? 'text' : 'password'}
                        style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                        placeholder="sk-ant-api03-..."
                        value={aiSettings.claude_api_key}
                        onChange={(e) => setAiSettings({ ...aiSettings, claude_api_key: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys({ ...showKeys, claude: !showKeys.claude })}
                        title={showKeys.claude ? "Masquer la clé" : "Afficher la clé"}
                        style={{ padding: '0 0.8rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        {showKeys.claude ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Modèle Claude</label>
                    <select
                      style={inputStyle}
                      value={aiSettings.claude_model}
                      onChange={(e) => setAiSettings({ ...aiSettings, claude_model: e.target.value })}
                    >
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Le plus précis)</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Ultra rapide)</option>
                      <option value="claude-3-opus-20240229">Claude 3 Opus (Raisonnement approfondi)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => handleTestKey('claude')}
                    disabled={testResults.claude?.testing || !aiSettings.claude_api_key}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem', cursor: (!aiSettings.claude_api_key || testResults.claude?.testing) ? 'not-allowed' : 'pointer', color: 'var(--text-primary)' }}
                  >
                    <Zap size={14} color="#e11d48" />
                    {testResults.claude?.testing ? "Test en cours..." : "Tester la clé Claude"}
                  </button>

                  {testResults.claude?.message && (
                    <span style={{ fontSize: '0.85rem', color: testResults.claude?.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                      {testResults.claude?.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Carte 2 : Google Gemini */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Bot size={22} color="var(--accent-primary)" />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 600 }}>Google Gemini API</h3>
                  </div>
                  {aiSettings.gemini_api_key ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
                      <CheckCircle size={14} /> Clé active
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Non configurée</span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Clé d'API Google AI Studio</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type={showKeys.gemini ? 'text' : 'password'}
                        style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                        placeholder="AQ.Ab8RN6..."
                        value={aiSettings.gemini_api_key}
                        onChange={(e) => setAiSettings({ ...aiSettings, gemini_api_key: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys({ ...showKeys, gemini: !showKeys.gemini })}
                        title={showKeys.gemini ? "Masquer la clé" : "Afficher la clé"}
                        style={{ padding: '0 0.8rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        {showKeys.gemini ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Modèle Gemini</label>
                    <select
                      style={inputStyle}
                      value={aiSettings.gemini_model}
                      onChange={(e) => setAiSettings({ ...aiSettings, gemini_model: e.target.value })}
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommandé)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Haute réflexion)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => handleTestKey('gemini')}
                    disabled={testResults.gemini?.testing || !aiSettings.gemini_api_key}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem', cursor: (!aiSettings.gemini_api_key || testResults.gemini?.testing) ? 'not-allowed' : 'pointer', color: 'var(--text-primary)' }}
                  >
                    <Zap size={14} color="var(--accent-primary)" />
                    {testResults.gemini?.testing ? "Test en cours..." : "Tester la clé Gemini"}
                  </button>

                  {testResults.gemini?.message && (
                    <span style={{ fontSize: '0.85rem', color: testResults.gemini?.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                      {testResults.gemini?.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Carte 3 : Groq API */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Key size={22} color="#10b981" />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 600 }}>Groq API</h3>
                  </div>
                  {aiSettings.groq_api_key ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
                      <CheckCircle size={14} /> Clé active
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Non configurée</span>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Clé d'API Groq (gsk_...)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type={showKeys.groq ? 'text' : 'password'}
                      style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                      placeholder="gsk_..."
                      value={aiSettings.groq_api_key}
                      onChange={(e) => setAiSettings({ ...aiSettings, groq_api_key: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys({ ...showKeys, groq: !showKeys.groq })}
                      title={showKeys.groq ? "Masquer la clé" : "Afficher la clé"}
                      style={{ padding: '0 0.8rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                      {showKeys.groq ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => handleTestKey('groq')}
                    disabled={testResults.groq?.testing || !aiSettings.groq_api_key}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem', cursor: (!aiSettings.groq_api_key || testResults.groq?.testing) ? 'not-allowed' : 'pointer', color: 'var(--text-primary)' }}
                  >
                    <Zap size={14} color="#10b981" />
                    {testResults.groq?.testing ? "Test en cours..." : "Tester la clé Groq"}
                  </button>

                  {testResults.groq?.message && (
                    <span style={{ fontSize: '0.85rem', color: testResults.groq?.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                      {testResults.groq?.message}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bouton d'enregistrement général */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                type="submit"
                disabled={aiSettingsSaving}
                className="premium-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 600 }}
              >
                {aiSettingsSaving ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={18} /> Enregistrer la Configuration des IA
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Charger un document PDF */}
      <Modal isOpen={isDocModalOpen} onClose={() => !isUploadingDoc && setIsDocModalOpen(false)} title="Charger un Document dans la Documentation">
        <form onSubmit={handleUploadDoc} style={{ display: 'grid', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>Titre / Nom officiel du document *</label>
            <input
              style={inputStyle}
              placeholder="Ex: Arrêté Ministériel n° 0045/2026 fixant les valeurs mercuriales..."
              value={newDocData.name}
              onChange={(e) => setNewDocData({ ...newDocData, name: e.target.value })}
              required
              disabled={isUploadingDoc}
            />
          </div>

          <div>
            <label style={labelStyle}>Dossier de destination dans la Documentation *</label>
            <select
              style={inputStyle}
              value={newDocData.category}
              onChange={(e) => setNewDocData({ ...newDocData, category: e.target.value })}
              disabled={isUploadingDoc}
            >
              <option value="Note de Service et Arretes Douane">Note de Service et Arrêtés Douane</option>
              <option value="Code des Douanes Gabonais">Code des Douanes Gabonais</option>
              <option value="Reglementation Douaniere">Réglementation Douanière CEMAC</option>
              <option value="Tarif des Droits et Taxes 2022">Tarif des Droits et Taxes 2022</option>
              <option value="NOTE EXPLICATIVE systeme harmonise 2022">NOTE EXPLICATIVE système harmonisé 2022</option>
              <option value="Circulaires & Instructions Récentes">Circulaires & Instructions Récentes</option>
              <option value="__custom__">+ Créer un nouveau dossier personnalisé...</option>
            </select>
          </div>

          {newDocData.category === '__custom__' && (
            <div>
              <label style={labelStyle}>Nom du nouveau dossier *</label>
              <input
                style={inputStyle}
                placeholder="Ex: Arrêtés Ministériels 2026, Circulaires Portuaires..."
                value={newDocData.customCategory}
                onChange={(e) => setNewDocData({ ...newDocData, customCategory: e.target.value })}
                required
                disabled={isUploadingDoc}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Fichier PDF *</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setNewDocData(prev => ({
                    ...prev,
                    file,
                    name: prev.name ? prev.name : file.name.replace(/\.pdf$/i, '')
                  }));
                }
              }}
              style={{ ...inputStyle, padding: '0.6rem' }}
              required
              disabled={isUploadingDoc}
            />
            {newDocData.file && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Taille : {formatFileSize(newDocData.file.size)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setIsDocModalOpen(false)}
              disabled={isUploadingDoc}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', cursor: isUploadingDoc ? 'not-allowed' : 'pointer', color: 'var(--text-primary)' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isUploadingDoc || !newDocData.file || !newDocData.name.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: isUploadingDoc ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isUploadingDoc ? 0.7 : 1 }}
            >
              {isUploadingDoc ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                  Téléversement en cours...
                </>
              ) : (
                <>
                  <Upload size={16} /> Publier dans la Documentation
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Détails Entreprise */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`Fiche Entreprise : ${selectedCompany?.name}`}>
        {editCompany && (
          <div>
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <button onClick={() => setActiveSubTab('infos')} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeSubTab === 'infos' ? '2px solid var(--accent-primary)' : 'none', color: activeSubTab === 'infos' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Informations & Valeurs</button>
              <button onClick={() => setActiveSubTab('agents')} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeSubTab === 'agents' ? '2px solid var(--accent-primary)' : 'none', color: activeSubTab === 'agents' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Agents ({allUsers.filter(u => u.companyId === selectedCompany?.id && u.role === 'declarant').length})</button>
            </div>

            {activeSubTab === 'infos' ? (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Statut de l'abonnement</div>
                    <div style={{ fontWeight: 600, color: (Math.ceil((new Date(selectedCompany?.subscription?.endDate || Date.now()) - new Date()) / (1000 * 60 * 60 * 24)) > 0) ? 'var(--success)' : 'var(--danger)' }}>
                      {(Math.ceil((new Date(selectedCompany?.subscription?.endDate || Date.now()) - new Date()) / (1000 * 60 * 60 * 24)) > 0) ? `Actif jusqu'au ${new Date(selectedCompany?.subscription?.endDate).toLocaleDateString()}` : 'Abonnement Expiré'}
                    </div>
                  </div>
                  <button onClick={handleRenewClick} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Renouveler</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Nom de l'entreprise</label>
                    <input style={inputStyle} value={editCompany.name} onChange={(e) => setEditCompany({...editCompany, name: e.target.value})} />
                  </div>
                  <div>
                    <label style={labelStyle}>NIF</label>
                    <input style={inputStyle} value={editCompany.nif} onChange={(e) => setEditCompany({...editCompany, nif: e.target.value})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input style={inputStyle} value={editCompany.email} onChange={(e) => setEditCompany({...editCompany, email: e.target.value})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Téléphone</label>
                    <input style={inputStyle} value={editCompany.phone} onChange={(e) => setEditCompany({...editCompany, phone: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Adresse</label>
                  <input style={inputStyle} value={editCompany.address} onChange={(e) => setEditCompany({...editCompany, address: e.target.value})} />
                </div>

                <h3 style={{ fontSize: '1.1rem', margin: '1rem 0 0.5rem 0', color: 'var(--text-primary)' }}>Paramètres douaniers par défaut</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Régime Douanier</label>
                    <input style={inputStyle} value={editCompany.settings?.regimeDouanier || ''} onChange={(e) => setEditCompany({...editCompany, settings: {...editCompany.settings, regimeDouanier: e.target.value}})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Bureau de Douane</label>
                    <input style={inputStyle} value={editCompany.settings?.bureauDouane || ''} onChange={(e) => setEditCompany({...editCompany, settings: {...editCompany.settings, bureauDouane: e.target.value}})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Type Déclaration</label>
                    <input style={inputStyle} value={editCompany.settings?.declarationType || ''} onChange={(e) => setEditCompany({...editCompany, settings: {...editCompany.settings, declarationType: e.target.value}})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Clé Douane</label>
                    <input style={inputStyle} value={editCompany.settings?.cleDouane || ''} onChange={(e) => setEditCompany({...editCompany, settings: {...editCompany.settings, cleDouane: e.target.value}})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Clé Centre</label>
                    <input style={inputStyle} value={editCompany.settings?.cleCentre || ''} onChange={(e) => setEditCompany({...editCompany, settings: {...editCompany.settings, cleCentre: e.target.value}})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Devise</label>
                    <input style={inputStyle} value={editCompany.settings?.deviseParDefaut || ''} onChange={(e) => setEditCompany({...editCompany, settings: {...editCompany.settings, deviseParDefaut: e.target.value}})} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                  <button onClick={() => setIsDetailsModalOpen(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Annuler</button>
                  <button onClick={handleSaveCompanyDetails} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Enregistrer</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Liste des déclarants</h3>
                  <button onClick={() => openAddAgentModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <Plus size={14} /> Ajouter un déclarant
                  </button>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem' }}>Nom</th>
                      <th style={{ padding: '0.5rem' }}>Email</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.filter(u => u.companyId === selectedCompany?.id && u.role === 'declarant').map(agent => (
                      <tr key={agent.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.5rem' }}>{agent.name}</td>
                        <td style={{ padding: '0.5rem' }}>{agent.email}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          <button onClick={() => handleDeleteAgentClick(agent.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Ajout Entreprise */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Ajouter une Entreprise">
        {editCompany && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nom de l'entreprise *</label>
                <input style={inputStyle} value={editCompany.name} onChange={(e) => setEditCompany({...editCompany, name: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>NIF</label>
                <input style={inputStyle} value={editCompany.nif} onChange={(e) => setEditCompany({...editCompany, nif: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} value={editCompany.email} onChange={(e) => setEditCompany({...editCompany, email: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Téléphone</label>
                <input style={inputStyle} value={editCompany.phone} onChange={(e) => setEditCompany({...editCompany, phone: e.target.value})} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Adresse</label>
              <input style={inputStyle} value={editCompany.address} onChange={(e) => setEditCompany({...editCompany, address: e.target.value})} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setIsAddModalOpen(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={submitCreateCompany} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Créer l'entreprise</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Renouvellement */}
      <Modal isOpen={renewModalOpen} onClose={() => setRenewModalOpen(false)} title={`Renouveler l'abonnement - ${selectedCompany?.name}`}>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div>
            <label style={labelStyle}>Durée du renouvellement (jours)</label>
            <input type="number" min="1" style={inputStyle} value={renewDays} onChange={(e) => setRenewDays(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button onClick={() => setRenewModalOpen(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Annuler</button>
            <button onClick={submitRenewal} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Confirmer le renouvellement</button>
          </div>
        </div>
      </Modal>

      {/* Modal Ajout Déclarant */}
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
