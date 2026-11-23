import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Comparaison sans accents ni casse (« Médicaments » = « medicaments »).
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Liste déroulante filtrable avec saisie libre, pour une liste de codes officiels.
 * - Au clic : la liste complète s'ouvre (code, libellé, détail).
 * - En tapant : filtre par début de code puis par mot du libellé / détail.
 * - Toute valeur tapée est conservée, même hors liste (saisie manuelle).
 * - `group(option)` (optionnel) renvoie 0 pour les options à proposer en premier,
 *   1 pour les autres (affichées sous `otherGroupLabel`).
 * - `warning` (optionnel) : message affiché (bordure orange) si la valeur pose question.
 * La liste est rendue dans <body> (position fixe) pour ne pas être coupée par les
 * conteneurs à défilement.
 */
const CodeListSelect = ({
  options, value, onChange, style, compact = false, showLabel = false,
  placeholder = '', noun = 'codes', group, firstGroupLabel, otherGroupLabel, warning, onFocusExtra,
  isKnown, // (valeur) => bool : valeur acceptée sans avertissement même si hors liste (ex. « 605-603 »)
  multi = false, maxSelected = 4, separator = '-', // sélection multiple : codes joints par le séparateur
}) => {
  const current = String(value ?? '');
  const parts = multi ? current.split(separator).map(s => s.trim().toUpperCase()).filter(Boolean) : [];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState(null);
  const [navigated, setNavigated] = useState(false); // flèches utilisées depuis la dernière frappe
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const index = useMemo(() => new Map(options.map(o => [o.code, o])), [options]);
  const info = index.get(current.trim().toUpperCase()) || null;
  const manual = Boolean(current.trim()) && !info && !(isKnown && isKnown(current));
  const warnMsg = warning || (manual ? 'Valeur saisie manuellement (hors liste officielle)' : '');

  const results = useMemo(() => {
    const q = fold(query.trim());
    let list = options;
    if (q) {
      const byCode = options.filter(o => fold(o.code).startsWith(q));
      const byText = options.filter(o => !fold(o.code).startsWith(q) &&
        (fold(o.libelle).includes(q) || fold(o.detail).includes(q)));
      list = [...byCode, ...byText];
    }
    if (group) list = [...list.filter(o => group(o) === 0), ...list.filter(o => group(o) !== 0)];
    return list;
  }, [query, options, group]);

  const firstOtherIdx = group ? results.findIndex(o => group(o) !== 0) : -1;

  const placeList = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 420);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - r.bottom;
    const above = spaceBelow < 260 && r.top > spaceBelow;
    setPos({ left: Math.max(8, left), width, top: above ? undefined : r.bottom + 4, bottom: above ? window.innerHeight - r.top + 4 : undefined, maxHeight: Math.min(340, (above ? r.top : spaceBelow) - 12) });
  };

  useLayoutEffect(() => { if (open) placeList(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => placeList();
    const onDown = (e) => {
      if (inputRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  // Codes déjà choisis (mode multiple), sans le morceau en cours de frappe s'il n'est pas un code.
  const chosen = multi ? parts.filter((p, i) => i < parts.length - 1 || index.has(p) || !query) : [];
  const full = multi && chosen.length >= maxSelected;

  const select = (code) => {
    if (!multi) { onChange(code); setQuery(''); setOpen(false); return; }
    // Multiple : un clic ajoute le code, un second clic le retire ; la liste reste ouverte.
    let next;
    if (chosen.includes(code)) next = chosen.filter(c => c !== code);
    else if (chosen.length < maxSelected) next = [...chosen, code];
    else return;
    onChange(next.length ? next.join(separator) : '000');
    setQuery('');
    setNavigated(false);
    inputRef.current?.focus();
  };

  const handleInput = (e) => {
    const v = e.target.value.toUpperCase();
    onChange(v);            // saisie manuelle : la valeur tapée est conservée
    // En mode multiple, on filtre sur le code en cours de frappe (après le dernier séparateur).
    setQuery(multi ? (v.split(separator).pop() || '').trim() : v);
    setHighlight(0);
    setNavigated(false);
    if (!open) setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); setNavigated(true); setHighlight(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setNavigated(true); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && open) {
      e.preventDefault();
      // Entrée : choisit l'élément parcouru aux flèches ; sinon garde exactement ce qui a été tapé.
      if (navigated && results[highlight]) select(results[highlight].code);
      else setOpen(false);
    }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); }
  };

  const sectionStyle = { padding: '6px 10px 4px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)' };

  return (
    <div style={{ position: 'relative', width: style?.width || '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={current}
          onChange={handleInput}
          onFocus={(e) => { e.target.select(); setQuery(''); setHighlight(0); setNavigated(false); setOpen(true); onFocusExtra?.(); }}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          title={info ? `${info.code} — ${info.libelle}${info.detail ? ` (${info.detail})` : ''}${warning ? `\n⚠ ${warning}` : ''}` : (warnMsg || `Choisir ou saisir (${noun})`)}
          autoComplete="off"
          spellCheck={false}
          style={{ ...style, width: '100%', paddingRight: compact ? '1.1rem' : '1.8rem', fontFamily: 'monospace', textTransform: 'uppercase', borderColor: warnMsg ? '#d97706' : style?.borderColor }}
        />
        <ChevronDown
          size={compact ? 12 : 16}
          onMouseDown={(e) => { e.preventDefault(); inputRef.current?.focus(); setOpen(o => !o); }}
          style={{ position: 'absolute', right: compact ? '3px' : '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }}
        />
      </div>

      {showLabel && (info || warnMsg) && (
        // Une seule ligne (texte complet au survol) pour garder les champs alignés.
        <div
          title={[info?.libelle, warnMsg].filter(Boolean).join('\n')}
          style={{ fontSize: '0.72rem', marginTop: '0.25rem', color: warnMsg ? '#d97706' : 'var(--text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {warnMsg ? `⚠ ${warnMsg}` : info.libelle}
        </div>
      )}

      {open && pos && createPortal(
        <div
          ref={listRef}
          onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight, overflowY: 'auto', zIndex: 10000, backgroundColor: 'var(--bg-secondary, #1e1e1e)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', padding: '4px' }}
        >
          {multi && (
            <div style={{ padding: '6px 10px', fontSize: '0.72rem', fontWeight: 600, color: full ? '#d97706' : 'var(--accent-primary)' }}>
              Sélection : {chosen.length}/{maxSelected}{chosen.length ? ` — ${chosen.join(separator)}` : ''}
              <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-muted)' }}>
                {full ? `Maximum atteint : retirez un code pour en ajouter un autre.` : 'Cliquez un code pour l\'ajouter, recliquez pour le retirer.'}
              </span>
            </div>
          )}
          <div style={{ padding: '6px 10px', fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
            {query
              ? `${results.length} résultat(s) pour « ${query} »${results.some(r => r.code === query) ? '' : ' — cliquez un code, ou Entrée pour garder votre saisie'}`
              : `${options.length} ${noun} — tapez un code ou un mot pour filtrer`}
          </div>
          {results.length === 0 && (
            <div style={{ padding: '10px', fontSize: '0.8rem', color: '#d97706' }}>
              Aucun code officiel ne correspond. La valeur « {query} » sera conservée telle quelle.
            </div>
          )}
          {results.map((o, i) => {
            const active = i === highlight;
            const selected = multi ? chosen.includes(o.code) : o.code === current;
            const disabled = multi && full && !selected;
            return (
              <div key={o.code}>
                {group && i === 0 && firstOtherIdx !== 0 && firstGroupLabel && <div style={sectionStyle}>{firstGroupLabel}</div>}
                {group && i === firstOtherIdx && otherGroupLabel && <div style={{ ...sectionStyle, borderTop: i > 0 ? '1px solid var(--border-color)' : 'none', marginTop: i > 0 ? '4px' : 0 }}>{otherGroupLabel}</div>}
                <div
                  data-idx={i}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => select(o.code)}
                  style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '7px 10px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent', borderLeft: selected ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
                >
                  {multi && (
                    <span style={{ width: '16px', height: '16px', marginTop: '1px', flexShrink: 0, borderRadius: '4px', border: `1.5px solid ${selected ? 'var(--accent-primary)' : 'var(--border-color)'}`, backgroundColor: selected ? 'var(--accent-primary)' : 'transparent', color: '#fff', fontSize: '11px', lineHeight: '13px', textAlign: 'center' }}>
                      {selected ? '✓' : ''}
                    </span>
                  )}
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-primary)', minWidth: '38px' }}>{o.code}</span>
                  <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>
                    {o.libelle}
                    {o.detail && <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{o.detail}</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CodeListSelect;
