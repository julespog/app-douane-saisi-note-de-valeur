import React, { useState, useEffect, useContext, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, Plus, Trash2, Save, Download, 
  Printer, BookOpen, FileText, CheckCircle, Calculator, Package, CreditCard, AlertCircle, Folder, Lock
} from 'lucide-react';
import { applyGroupingLogic } from '../utils/groupingLogic';
import { COUNTRIES } from '../utils/countries';
import { useNavigate, useLocation } from 'react-router-dom';
import NoteDocument from '../components/NoteDocument';
import { DatabaseContext } from '../context/DatabaseContext';
import { UserContext } from '../context/UserContext';

const INITIAL_INFOS = {
  noDossier: '', noOT: '', noCDEMarque: '', noRepertoire: '',
  noSTRedevable: '', noSTDestination: '',
  typeLTA_CNT: 'No LTA', valLTA_CNT: '',
  provenance: 'Afghanistan', nombreNatureColis: '', poidsBrut: '', poidsNet: '', noVolOuVol: '',
  devise: 'XAF', tauxDevise: '655.957', modeReglement: '01',
  typeOperation: 'IM4', modeTaxation: '4000 / 000', modeTransport: 'MER', incoterm: 'FOB'
};

const INITIAL_VALEURS = {
  vFacture: '', vFactureCalculee: '', vFret: '', vAssurance: '',
  tauxAssurance: '0.05', vCommission: '', vTauxAjust: '', vFraisDivers: '',
  cafDevise: '', cafCFA: ''
};

const NoteForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tariffs } = useContext(DatabaseContext);
  const { user } = useContext(UserContext);

  // 1. Inform































































































































































































































































































































































































































  return (
    <div className="fade-in" style={{ paddingBottom: '4rem', position: 'relative' }} onKeyDown={handleGlobalKeyDown}>
      
      {/* OVERLAY ABONNEMENT EXPIRÉ */}
      {isExpired && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(3px)', zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '10rem'
        }}>
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px', backgroundColor: 'white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <Lock size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.5rem', color: 'var(--danger)', marginBottom: '1rem' }}>Abonnement Expiré</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Votre abonnement est arrivé à terme. Vous ne pouvez plus saisir de nouvelles notes de valeurs. 
              Veuillez contacter le support pour renouveler votre accès.
            </p>
            <button onClick={() => navigate('/archives')} className="premium-btn">
              Consulter mes archives
            </button>
          </div>
        </div>
      )}

      {/* MODAL BEAUTIFUL */}
      {modalData && (
        <div styl






































































































































































































































































































               display: 'flex', alignItems: 'center', gap: '0.5rem', 
               backgroundColor: '#6b21a8', color: 'white', 
               border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 
             }}>
               <Search size={14} /> Rechercher
             </button>
             <button 
               type="button"
               style={{ 
               display: 'flex', alignItems: 'center', gap: '0.5rem', 
               backgroundColor: '#6b21a8', color: 'white', 
               border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 
             }}>
               <Plus size={14} /> Ajouter sélection
             </button>
           </div>
         </div>

         {/* Formulaire d'ajout rapide (visible après sélection d'un tarif) */}
         {newArticle && (
           <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--accent-light)', animation: 'fadeIn 0.2s ease-out' }}>
             <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Package size={18} /> Ajout d'Article : {newArticle.codeSH}
             </h3>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
               <div style={{ gridColumn: 'span 2' }}>
                 <label style={labelStyle}>Intitulé</label>
                 <input style={inputStyle} name="intitule" value={newArticle.intitule} onChange={handleNewArticleChange} />
               </div>
               <div>
                 <label style={labelStyle}>Taux DD (%)</label>
                 <input style={inputStyle} name="tauxDD" value={newArticle.tauxDD} onChange={handleNewArticleChange} />
               </div>
               <div>
                 <label style={labelStyle}>Origine</label>
                 <select style={inputStyle} name="origine" value={newArticle.origine} onChange={handleNewArticleChange}>
                   {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
               <div>
                 <label style={labelStyle}>Quantité</label>
                 <input style={inputStyle} type="number" name="quantite" value={newArticle.quantite} onChange={handleNewArticleChange} />
               </div>
               <div>
                 <label style={labelStyle}>Valeur article</label>
                 <input style={{...inputStyle, borderColor: 'var(--accent-primary)'}} type="number" name="valeur" value={newArticle.valeur} onChange={handleNewArticleChange} placeholder="Ex: 1500" />
               </div>
               <div>
                 <label style={labelStyle}>Poids Brut (kg)</label>
                 <input style={inputStyle} type="number" name="pBrut" value={newArticle.pBrut} onChange={handleNewArt















































































































































              {customAlert.type === 'confirm' && <div style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '0.75rem', borderRadius: '50%' }}><Save size={28} /></div>}
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>{customAlert.title}</h3>
            </div>
            
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>{customAlert.message}</p>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              {customAlert.type === 'confirm' && (
                <button 
                  onClick={customAlert.onCancel}
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  Annuler
                </button>
              )}
              <button 
                onClick={customAlert.onConfirm}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: customAlert.type === 'error' ? '#dc2626' : 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              >
                {customAlert.type === 'confirm' ? 'Restaurer' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NoteForm;

