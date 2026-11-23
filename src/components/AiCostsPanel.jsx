import { useEffect, useState, useCallback } from 'react';
import { Wallet, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import { customFetch } from '../supabaseClient';
import { handleExternalLinkClick } from '../utils/openExternal';

/**
 * Suivi des dépenses IA (Anthropic Claude) — page d'administration.
 * Données officielles d'Anthropic (API « Usage and Cost Analytics »), lues par le service IA
 * du serveur (GET /api/ai/costs) avec une clé d'administration stockée uniquement sur le
 * serveur. Les chiffres arrivent avec 4 à 24 h de décalage ; le solde de crédit restant
 * n'est pas fourni par l'API (lien vers la console Anthropic).
 */
const CONSOLE_BILLING_URL = 'https://console.anthropic.com/settings/billing';
const CONSOLE_ADMIN_KEYS_URL = 'https://console.anthropic.com/settings/admin-keys';

const usd = (n) => `${(Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const num = (n) => (Number(n) || 0).toLocaleString('fr-FR');
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

const Card = ({ label, value, hint }) => (
  <div style={{ padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.3rem', fontFamily: 'monospace' }}>{value}</div>
    {hint && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{hint}</div>}
  </div>
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
      if (!r.ok) return { data: body.configured === false ? body : null, error: body.error || `Erreur ${r.status}` };
      return { data: body, error: '' };
    } catch {
      return { data: null, error: 'Service de suivi des dépenses injoignable.' };
    }
  }, []);

  // Bouton « Actualiser » : force une nouvelle lecture chez Anthropic
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

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem 2rem', marginTop: '2rem', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ padding: '0.7rem', borderRadius: '10px', backgroundColor: 'rgba(225, 29, 72, 0.1)' }}><Wallet size={22} color="var(--accent-primary)" /></div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>Suivi des dépenses IA (Claude)</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Chiffres officiels d'Anthropic, en dollars US. Mise à jour par Anthropic avec 4 à 24 h de décalage.
            </p>
          </div>
        </div>
        {data?.configured && (
          <button type="button" onClick={refresh} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: loading ? 'wait' : 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Actualiser
          </button>
        )}
      </div>

      {loading && !data && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chargement des dépenses…</div>}

      {!loading && data?.configured === false && (
        <div style={{ padding: '1rem 1.2rem', borderRadius: '10px', border: '1px dashed var(--border-color)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Suivi non encore activé.</strong> Il faut une <strong>clé d'administration Anthropic</strong> (<code>sk-ant-admin…</code>),
          différente de la clé de l'IA, créée par un administrateur du compte dans la console Anthropic ({' '}
          <ExtLink href={CONSOLE_ADMIN_KEYS_URL}>Admin keys</ExtLink>{' '}). Pour des raisons de sécurité, elle s'installe
          <strong> uniquement sur le serveur</strong> (fichier protégé), jamais dans cette page.
          <div style={{ marginTop: '0.5rem' }}>En attendant, le solde et les factures sont consultables ici : <ExtLink href={CONSOLE_BILLING_URL}>Console Anthropic – Facturation</ExtLink></div>
        </div>
      )}

      {error && data?.configured !== false && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.9rem 1rem', borderRadius: '10px', backgroundColor: 'rgba(217,119,6,0.1)', color: '#d97706', fontSize: '0.86rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} /> {error}
        </div>
      )}

      {data?.configured && !data.error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem' }}>
            <Card label="Aujourd'hui" value={usd(data.today?.usd)} hint="partiel (décalage Anthropic)" />
            <Card label="Mois en cours" value={usd(data.month?.usd)} hint={`depuis le ${shortDay(data.month?.since)}`} />
            <Card label="Mois précédent" value={usd(data.previousMonth?.usd)} />
            <Card label="30 derniers jours" value={usd(data.last30?.usd)} hint={`${num(data.usage30?.requests)} requêtes`} />
          </div>

          {/* Dépenses jour par jour (30 jours) */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Dépenses par jour (30 derniers jours, UTC)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px', padding: '0.5rem', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)' }}>
              {days.map(d => (
                <div key={d.date} title={`${shortDay(d.date)} : ${usd(d.usd)}${d.partiel ? ' (partiel)' : ''}`}
                  style={{ flex: 1, minWidth: '4px', height: `${Math.max(2, (d.usd / maxDay) * 100)}%`, borderRadius: '3px 3px 0 0', backgroundColor: d.partiel ? 'rgba(225,29,72,0.4)' : 'var(--accent-primary)', opacity: d.usd > 0 ? 1 : 0.25 }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              <span>{days[0] ? shortDay(days[0].date) : ''}</span><span>{days.length ? shortDay(days[days.length - 1].date) : ''}</span>
            </div>
          </div>

          {/* Répartition par modèle */}
          {data.byModel?.length > 0 && (
            <table style={{ width: '100%', marginTop: '1.25rem', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  <th style={{ padding: '0.4rem' }}>Modèle (30 jours)</th><th style={{ padding: '0.4rem' }}>Requêtes</th><th style={{ padding: '0.4rem' }}>Tokens entrée / sortie</th><th style={{ padding: '0.4rem', textAlign: 'right' }}>Dépense</th>
                </tr>
              </thead>
              <tbody>
                {data.byModel.map(m => {
                  const u = (data.usage30?.byModel || []).find(x => x.model === m.model);
                  return (
                    <tr key={m.model} style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                      <td style={{ padding: '0.45rem', fontFamily: 'monospace' }}>{m.model}</td>
                      <td style={{ padding: '0.45rem' }}>{u ? num(u.requests) : '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{u ? `${num(u.inputTokens)} / ${num(u.outputTokens)}` : '—'}</td>
                      <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 700 }}>{usd(m.usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Données Anthropic complètes jusqu'au {fmtDateTime(data.refreshedAt)} · calculées le {fmtDateTime(data.generatedAt)}{data.cached ? ' (cache 15 min)' : ''}.
            Montants avant crédits/avoirs. Solde restant et factures : <ExtLink href={CONSOLE_BILLING_URL}>Console Anthropic – Facturation</ExtLink>
          </div>
        </>
      )}
    </div>
  );
};

export default AiCostsPanel;
