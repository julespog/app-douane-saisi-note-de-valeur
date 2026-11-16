import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gnamatech.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

// Custom fetch wrapper: in Tauri native desktop app, uses Rust HTTP stack (@tauri-apps/plugin-http)
// In normal web browser, uses window.fetch
let tauriFetchInstance = null;

export const customFetch = async (input, init) => {
  if (typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__)) {
    if (!tauriFetchInstance) {
      try {
        const { fetch: tFetch } = await import('@tauri-apps/plugin-http');
        tauriFetchInstance = tFetch;
      } catch (e) {
        console.warn('Tauri HTTP plugin unavailable, falling back to window.fetch:', e);
        tauriFetchInstance = window.fetch.bind(window);
      }
    }
    return tauriFetchInstance(input, init);
  }
  return window.fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: customFetch
  }
});
