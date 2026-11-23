import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import CODES_ADDITIONNELS from '../data/codesAdditionnels.json';

// Index code -> entrée, pour retrouver le libellé d'un code saisi.
const CODE_INDEX = new Map(CODES_ADDITIONNELS.map(c => [c.code, c]));

const getCodeAdditionnelInfo = (code) =>
  CODE_INDEX.get(String(code ?? '').trim().toUpperCase()) || null;

// Comparaison sans accents ni casse (« Médicaments » = « medicaments »).
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Champ « Code additionnel » : liste déroulante filtrable + saisie libre.
 * - Au clic : la liste complète s'ouvre (code, libellé, base légale, ancien code).
 * - En tapant : filtre par code (« 6E ») ou par mot du libellé (« diplomatique »).
 * - Toute valeur tapée est acceptée, même hors liste (saisie manuelle).
 * La liste est rendue dans <body> (position fixe) pour ne pas être coupée par
 * les conteneurs à défilement (tableau des marchandises).
 */
const CodeAdditionnelSelect = ({ value, onChange, style, compact = false, showLabel = false }) => {
  const current = String(value ?? '000');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState(null);
  const [navigated, setNavigated] = useState(false); // flèches utilisées depuis la dernière frappe
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const info = getCodeAdditionnelInfo(current);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return CODES_ADDITIONNELS;
    const byCode = CODES_ADDITIONNELS.filter(c => fold(c.code).startsWith(q));
    const byText = CODES_ADDITIONNELS.filter(c => !fold(c.code).startsWith(q) &&
      (fold(c.libelle).includes(q) || fold(c.baseLegale).includes(q) || fold(c.ancienCode) === q));
    return [...byCode, ...byText];
  }, [query]);

  const placeList = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 420);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - r.bottom;
    const above = spaceBelow < 260 && r.top > spaceBelow;
    setPos({ left: Math.max(8, left), width, top: above ? undefined : r.bottom + 4, bottom: above ? window.innerHeight - r.top + 4 : undefined, maxHeight: Math.min(320, (above ? r.top : spaceBelow) - 12) });
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

  // Garde l'élément surligné visible pendant la navigation au clavier.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const select = (code) => {
    onChange(code);
    setQuery('');
    setOpen(false);
  };

  const handleInput = (e) => {
    const v = e.target.value.toUpperCase();
    onChange(v);           // saisie manuelle : la valeur tapée est conservée
    setQuery(v);
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

  const manual = current && !info;

  return (
    <div style={{ position: 'relative', width: style?.width || '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={current}
          onChange={handleInput}
          onFocus={(e) => { e.target.select(); setQuery(''); setHighlight(0); setNavigated(false); setOpen(true); }}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="000"
          title={info ? `${info.code} — ${info.libelle}${info.baseLegale ? ` (${info.baseLegale})` : ''}` : (manual ? 'Code saisi manuellement (hors liste officielle)' : 'Choisir ou saisir un code additionnel')}
          autoComplete="off"
          spellCheck={false}
          style={{ ...style, width: '100%', paddingRight: compact ? '1.1rem' : '1.8rem', fontFamily: 'monospace', textTransform: 'uppercase', borderColor: manual ? '#d97706' : style?.borderColor }}
        />
        <ChevronDown
          size={compact ? 12 : 16}
          onMouseDown={(e) => { e.preventDefault(); inputRef.current?.focus(); setOpen(o => !o); }}
          style={{ position: 'absolute', right: compact ? '3px' : '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }}
        />
      </div>

      {showLabel && (
        <div style={{ fontSize: '0.72rem', marginTop: '0.25rem', color: manual ? '#d97706' : 'var(--text-muted)', lineHeight: 1.3 }}>
          {info ? info.libelle : (manual ? 'Code saisi manuellement (hors liste officielle)' : '')}
        </div>
      )}

      {open && pos && createPortal(
        <div
          ref={listRef}
          onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight, overflowY: 'auto', zIndex: 10000, backgroundColor: 'var(--bg-secondary, #1e1e1e)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', padding: '4px' }}
        >
          <div style={{ padding: '6px 10px', fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
            {query
              ? `${results.length} résultat(s) pour « ${query} »${results.some(r => r.code === query) ? '' : ' — cliquez un code, ou Entrée pour garder votre saisie'}`
              : `${CODES_ADDITIONNELS.length} codes additionnels — tapez un code ou un mot pour filtrer`}
          </div>
          {results.length === 0 && (
            <div style={{ padding: '10px', fontSize: '0.8rem', color: '#d97706' }}>
              Aucun code officiel ne correspond. La valeur « {query} » sera conservée telle quelle.
            </div>
          )}
          {results.map((c, i) => {
            const active = i === highlight;
            const selected = c.code === current;
            return (
              <div
                key={c.code}
                data-idx={i}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(c.code)}
                style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent', borderLeft: selected ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
              >
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-primary)', minWidth: '34px' }}>{c.code}</span>
                <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>
                  {c.libelle}
                  {(c.baseLegale || c.ancienCode) && (
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {c.baseLegale}{c.baseLegale && c.ancienCode ? ' · ' : ''}{c.ancienCode ? `ancien code ${c.ancienCode}` : ''}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CodeAdditionnelSelect;
