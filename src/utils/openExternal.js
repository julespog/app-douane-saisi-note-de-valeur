/**
 * Liens externes (ex. page source d'une image trouvée par la recherche IA).
 * - Web : lien normal ouvert dans un nouvel onglet.
 * - Application Windows (Tauri) : un lien target="_blank" ne fait rien dans la WebView ;
 *   on passe par le plugin officiel @tauri-apps/plugin-opener (navigateur par défaut).
 */

/** Renvoie l'URL si elle est en http(s), sinon null (les liens viennent de sites tiers). */
export const safeExternalUrl = (url) => {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
};

/** Nom de domaine lisible (sans « www. ») pour l'affichage du lien. */
export const urlHostname = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

const isTauri = () => typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__);

/** Gestionnaire onClick d'un <a href target="_blank"> : ouvre le navigateur externe sous Tauri. */
export const handleExternalLinkClick = async (event, url) => {
  event.stopPropagation();
  const safe = safeExternalUrl(url);
  if (!safe) { event.preventDefault(); return; }
  if (!isTauri()) return; // comportement normal du lien sur le web
  event.preventDefault();
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(safe);
  } catch (e) {
    console.warn('Ouverture externe impossible via Tauri, tentative window.open :', e);
    window.open(safe, '_blank', 'noopener,noreferrer');
  }
};
