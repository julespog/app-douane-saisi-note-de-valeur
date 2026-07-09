const fs = require('fs');

const file = './src/pages/NoteForm.jsx';
let content = fs.readFileSync(file, 'utf-8');

// 1. Déplacer la barre de recherche
const searchBarStart = content.indexOf('      {/* BARRE DE RECHERCHE D\\'ARTICLES */}');
const searchBarEnd = content.indexOf('      {/* ZONE HAUTE : INFOS & VALEURS (75% / 25%) */}');
const searchBarContent = content.substring(searchBarStart, searchBarEnd);

content = content.substring(0, searchBarStart) + content.substring(searchBarEnd);

const zoneBasseStart = content.indexOf('      {/* ZONE BASSE : TABLEAU DES ARTICLES (100% de la largeur) */}');
content = content.substring(0, zoneBasseStart) + searchBarContent + '\n' + content.substring(zoneBasseStart);

// 2. Afficher toutes les devises
const oldDevise = `<select style={{...inputStyle, width: '45%', padding: '0.45rem 0.2rem'}} name="devise" value={infos.devise} onChange={handleInfosChange}>
                    <option value="XAF">XAF</option><option value="EUR">EUR</option><option value="USD">USD</option>
                  </select>`;
const newDevise = `<select style={{...inputStyle, width: '45%', padding: '0.45rem 0.2rem'}} name="devise" value={infos.devise} onChange={handleInfosChange}>
                    {['XAF','EUR','USD','GBP','JPY','CNY','CAD','CHF','ZAR','AED','MAD','XOF','AUD','SGD','INR','BRL','RUB','NGN','KES','GHS'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>`;
content = content.replace(oldDevise, newDevise);

// 3. Modifier la zone Fret/Assurance et déplacer la CAF
const oldValeursBlock = `              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div><label style={labelStyle}>V. FRET</label><input style={{...inputStyle, backgroundColor: 'white'}} name="vFret" type="number" value={valeurs.vFret} onChange={handleValeursChange}/></div>
                <div><label style={labelStyle}>V. ASSURANCE</label><input style={{...inputStyle, backgroundColor: 'white'}} name="vAssurance" type="number" value={valeurs.vAssurance} onChange={handleValeursChange}/></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div><label style={labelStyle}>Taux Ass. (%)</label><input style={{...inputStyle, backgroundColor: 'white'}} name="tauxAssurance" type="number" value={valeurs.tauxAssurance} onChange={handleValeursChange}/></div>
              </div>

              {/* Totaux */}
              <div style={{ padding: '0.75rem', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>C.A.F ({infos.devise})</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{valeurs.cafDevise || '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--bg-primary)' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 600 }}>C.A.F (CFA)</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    {valeurs.cafCFA || '0'}
                  </span>
                </div>
              </div>

              <details style={{ cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                <summary style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Autres frais...</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div><label style={labelStyle}>V. COMISSION</label><input style={inputStyle} name="vCommission" value={valeurs.vCommission} onChange={handleValeursChange}/></div>
                  <div><label style={labelStyle}>V. TAUX AJUST.</label><input style={inputStyle} name="vTauxAjust" value={valeurs.vTauxAjust} onChange={handleValeursChange}/></div>
                  <div><label style={labelStyle}>V. FRAIS DIVERS</label><input style={inputStyle} name="vFraisDivers" value={valeurs.vFraisDivers} onChange={handleValeursChange}/></div>
                </div>
              </details>`;

const newValeursBlock = `              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div><label style={labelStyle}>V. FRET</label><input style={{...inputStyle, backgroundColor: 'white'}} name="vFret" type="number" value={valeurs.vFret} onChange={handleValeursChange}/></div>
                <div><label style={labelStyle}>Taux Ass. (%)</label><input style={{...inputStyle, backgroundColor: 'white'}} name="tauxAssurance" type="number" value={valeurs.tauxAssurance} onChange={handleValeursChange}/></div>
                <div><label style={labelStyle}>V. ASSURANCE</label><input style={{...inputStyle, backgroundColor: 'white'}} name="vAssurance" type="number" value={valeurs.vAssurance} onChange={handleValeursChange}/></div>
              </div>

              <details style={{ cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.5rem' }} open>
                <summary style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Autres frais...</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div><label style={labelStyle}>V. COMISSION</label><input style={inputStyle} name="vCommission" value={valeurs.vCommission} onChange={handleValeursChange}/></div>
                  <div><label style={labelStyle}>V. TAUX AJUST.</label><input style={inputStyle} name="vTauxAjust" value={valeurs.vTauxAjust} onChange={handleValeursChange}/></div>
                  <div><label style={labelStyle}>V. FRAIS DIVERS</label><input style={inputStyle} name="vFraisDivers" value={valeurs.vFraisDivers} onChange={handleValeursChange}/></div>
                </div>
              </details>

              {/* Totaux */}
              <div style={{ padding: '0.75rem', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>C.A.F ({infos.devise})</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{valeurs.cafDevise || '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--bg-primary)' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 600 }}>C.A.F (CFA)</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    {valeurs.cafCFA || '0'}
                  </span>
                </div>
              </div>`;

content = content.replace(oldValeursBlock, newValeursBlock);

fs.writeFileSync(file, content, 'utf-8');
console.log('Modifications appliquees avec succes.');
