export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, query } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // 1. Essayer d'abord de relayer vers le backend unifié Gnamatech (VPS)
  // qui détient la configuration et les clés centralisées d'Anthropic Claude
  try {
    const vpsResponse = await fetch('https://gnamatech.com/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, query }),
      signal: AbortSignal.timeout(60000)
    });

    if (vpsResponse.ok) {
      const vpsData = await vpsResponse.json();
      return res.status(200).json(vpsData);
    }
  } catch (err) {
    console.warn('Relais VPS Gnamatech indisponible depuis Vercel, tentative directe Anthropic :', err.message);
  }

  // 2. Appel direct Anthropic Claude si configuré dans Vercel
  const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.VITE_CLAUDE_API_KEY;
  if (!claudeKey) {
    return res.status(503).json({
      error: "Service d'IA Claude (Anthropic) indisponible. Veuillez vérifier la clé d'API Anthropic dans l'administration."
    });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey.trim(),
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(75000)
    });

    const anthropicData = await anthropicRes.json();
    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({
        error: anthropicData?.error?.message || "Erreur lors de l'appel à Anthropic Claude"
      });
    }

    const text = anthropicData?.content?.[0]?.text || '';
    return res.status(200).json({
      candidates: [{ content: { parts: [{ text }] } }],
      model: 'Claude (Anthropic)'
    });
  } catch (error) {
    console.error('Erreur Anthropic Claude Vercel :', error);
    return res.status(500).json({ error: 'Erreur réseau lors de la communication avec Claude (Anthropic)', details: error.message });
  }
}
