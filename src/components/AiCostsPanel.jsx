import { useEffect, useState, useCallback } from 'react';
import { Wallet, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import { customFetch } from '../supabaseClient';
import { handleExternalLinkClick } from '../utils/openExternal';

/**
 * Suivi des dépenses IA (Anthropic Claude) — page d'administration.
 * Suivi INTERNE : le service IA du serveur enregistre la consommation de tokens renvoyée par
 * Claude à chaque recherche (fichier privé du serveur) et l'estime en dollars avec les tarifs
 * publics d'Anthropic. Le compte Anthropic étant individuel, l'API officielle de coûts n'est
 * pas disponible. Le solde restant se lit dans la console Anthropic (lien).
 */
const CONSOLE_BILLING_URL = 'https://platform.claude.com/settings/billing';

const usd = (n) => {
  const v = Number(n) || 0;
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: v > 0 && v < 0.1 ? 3 : 2, maximumFractionDigits: v > 0 && v < 0.1 ? 3 : 2 })} $`;
};
const num = (n) => (Number(n) || 0).toLocaleString('fr-FR');
const fcfaFmt = (usdValue, rate) => {
  if (!rate) return '— FCFA';
  const v = (Number(usdValue) || 0) * rate;
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: v > 0 && v < 10 ? 2 : 0, maximumFractionDigits: v > 0 && v < 10 ? 2 : 0 })} FCFA`;
};
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
};
const shortDay = (d) => { try { return new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }); } catch { return d; } };

const apiBase = () => ((typeof window !== 'undefined' && (window.__TAURI__ || window.location.origin.includes('localhost') || window.location.origin.includes('tauri'))) ? 'https://gnamatech.com' : '');

const ExtLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => handleExternalLinkClick(e, href)}
    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
    {children} <ExternalLink size={13} />
  </a>
);

const Card = ({ label, value, sub, hint }) => (
  <div style={{ padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.3rem', fontFamily: 'monospace' }}>{value}</div>
    {sub && <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{sub}</div>}
    {hint && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{hint}</div>}
  </div>
);

const th = { padding: '0.4rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 };
const td = { padding: '0.45rem', color: 'var(--text-primary)' };

const Table = ({ title, rows, firstCol, renderFirst, rate }) => (
  rows?.length > 0 ? (
    <div style={{ marginTop: '1.25rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr><th style={th}>{firstCol}</th><th style={th}>Recherches</th><th style={th}>Tokens entrée / sortie</th><th style={{ ...th, textAlign: 'right' }}>Dépense (FCFA)</th><th style={{ ...th, textAlign: 'right' }}>Dépense ($)</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || r.model || i} style={{ borderTop: '1px solid var(--border-color)' }}>
              <td style={td}>{renderFirst(r)}</td>
              <td style={td}>{num(r.requests)}</td>
              <td style={td}>{num(r.inputTokens)} / {num(r.outputTokens)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fcfaFmt(r.usd, rate)}</td>
              <td style={{ ...td, textAlign: 'right', color: 'var(--text-secondary)' }}>{usd(r.usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null
);

const AiCostsPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Appel au service IA du serveur (aucune mise à jour d'état ici)
  const fetchCosts = useCallback(async (refresh) => {
    try {
      const r = await customFetch(`${apiBase()}/api/ai/costs${refresh ? '?refresh=1' : ''}`, { method: 'GET' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return { data: null, error: body.error || `Erreur ${r.status}` };
      return { data: body, error: '' };
    } catch {
      return { data: null, error: 'Service de suivi des dépenses injoignable.' };
    }
  }, []);

  // Bouton « Actualiser »
  const refresh = async () => {
    setLoading(true);
    const res = await fetchCosts(true);
    setData(res.data); setError(res.error); setLoading(false);
  };

  // Chargement initial
  useEffect(() => {
    let alive = true;
    fetchCosts(false).then(res => { if (alive) { setData(res.data); setError(res.error); setLoading(false); } });
    return () => { alive = false; };
  }, [fetchCosts]);

  const days = data?.last30?.days || [];
  const maxDay = Math.max(0.0001, ...days.map(d => d.usd));
  const empty = data && !data.trackingSince;
  const rate = data?.fx?.usdToXaf || null;
  const both = (v) => ({ value: fcfaFmt(v, rate), sub: usd(v) });

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem 2rem', marginTop: '2rem', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ padding: '0.7rem', borderRadius: '10px', backgroundColor: 'rgba(225, 29, 72, 0.1)' }}><Wallet size={22} color="var(--accent-primary)" /></div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>Suivi des dépenses IA (Claude)</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Estimation en francs CFA et en dollars US, à partir de la consommation réelle de chaque recherche et des tarifs publics d'Anthropic (facturés en dollars). Mise à jour immédiate.
            </p>
          </div>
        </div>
        <button type="button" onClick={refresh} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: loading ? 'wait' : 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Actualiser
        </button>
      </div>

      {loading && !data && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chargement des dépenses…</div>}

      {error && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.9rem 1rem', borderRadius: '10px', backgroundColor: 'rgba(217,119,6,0.1)', color: '#d97706', fontSize: '0.86rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} /> {error}
        </div>
      )}

      {data && !error && (
        <>
          {empty && (
            <div style={{ padding: '0.8rem 1rem', marginBottom: '1rem', borderRadius: '10px', border: '1px dashed var(--border-color)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Le suivi est actif : les dépenses apparaîtront ici dès la prochaine recherche IA. Les recherches faites avant la mise en place du suivi ne sont pas comptabilisées.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem' }}>
            <Card label="Aujourd'hui" {...both(data.today?.usd)} hint={`${num(data.today?.requests)} recherche(s)`} />
            <Card label="Mois en cours" {...both(data.month?.usd)} hint={`${num(data.month?.requests)} recherche(s) depuis le ${shortDay(data.month?.since)}`} />
            <Card label="Mois précédent" {...both(data.previousMonth?.usd)} hint={`${num(data.previousMonth?.requests)} recherche(s)`} />
            <Card label="30 derniers jours" {...both(data.last30?.usd)} hint={`${num(data.last30?.requests)} recherche(s) · ${data.last30?.requests ? fcfaFmt(data.last30.usd / data.last30.requests, rate) : '—'} / recherche`} />
          </div>

          {/* Dépenses jour par jour (30 jours) */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Dépenses par jour (30 derniers jours, UTC)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px', padding: '0.5rem', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)' }}>
              {days.map(d => (
                <div key={d.date} title={`${shortDay(d.date)} : ${fcfaFmt(d.usd, rate)} (${usd(d.usd)})${d.partiel ? ' — en cours' : ''}`}
                  style={{ flex: 1, minWidth: '4px', height: `${Math.max(2, (d.usd / maxDay) * 100)}%`, borderRadius: '3px 3px 0 0', backgroundColor: d.partiel ? 'rgba(225,29,72,0.55)' : 'var(--accent-primary)', opacity: d.usd > 0 ? 1 : 0.25 }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              <span>{days[0] ? shortDay(days[0].date) : ''}</span><span>{days.length ? shortDay(days[days.length - 1].date) : ''}</span>
            </div>
          </div>

          <Table title="Par entreprise (mois en cours)" rows={data.byCompany} rate={rate} firstCol="Entreprise" renderFirst={r => r.name} />
          <Table title="Par utilisateur (mois en cours, 20 premiers)" rows={data.byUser} rate={rate} firstCol="Utilisateur"
            renderFirst={r => <>{r.name}{r.company ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> · {r.company}</span> : null}</>} />
          <Table title="Par modèle (30 derniers jours)" rows={data.byModel} rate={rate} firstCol="Modèle" renderFirst={r => <span style={{ fontFamily: 'monospace' }}>{r.model}</span>} />

          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Suivi depuis le {fmtDateTime(data.trackingSince)} · calculé le {fmtDateTime(data.generatedAt)}.
            {rate && <> Taux : 1 $ = {rate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA{data.fx?.date ? ` (${data.fx.date.split('-').reverse().join('/')})` : ''} — {data.fx?.source}{data.fx?.approximatif ? ' — taux approximatif (source indisponible)' : ''}.</>}
            {data.unpricedRequests > 0 && <> {num(data.unpricedRequests)} recherche(s) avec un modèle au tarif inconnu (non chiffrées).</>}
            {' '}Estimation : la facture réelle peut légèrement différer (arrondis, remises, taxes).
            {' '}Solde restant et factures : <ExtLink href={CONSOLE_BILLING_URL}>Console Anthropic – Facturation</ExtLink>
          </div>
        </>
      )}
    </div>
  );
};

export default AiCostsPanel;
