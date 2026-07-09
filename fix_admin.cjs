const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cjxramixzefbrsaweuoz.supabase.co',
  'sb_publishable_m-eMCMOjReLuOxjSwTR8PQ_bYAVEzO7'
);

async function main() {
  // Voir tous les utilisateurs avec role superadmin
  const { data: admins, error: err1 } = await supabase
    .from('users')
    .select('id, email, role, password')
    .eq('role', 'superadmin');

  console.log('=== SUPERADMINS TROUVES ===');
  console.log(JSON.stringify(admins, null, 2));
  if (err1) console.error('Erreur lecture:', err1.message);

  // Chercher admin@fast.com spécifiquement
  const adminExists = admins?.find(u => u.email === 'admin@fast.com');

  if (!adminExists) {
    console.log('\n⚠️  admin@fast.com introuvable — tentative de création...');
    const { data, error } = await supabase
      .from('users')
      .insert({ email: 'admin@fast.com', password: 'admin', role: 'superadmin', name: 'Administrateur' })
      .select();
    console.log('Résultat création:', JSON.stringify(data, null, 2));
    if (error) console.error('Erreur création:', error.message);
  } else {
    console.log('\n✅ Compte trouvé. Mot de passe actuel:', adminExists.password);
    console.log('Réinitialisation du mot de passe à "admin"...');
    const { data, error } = await supabase
      .from('users')
      .update({ password: 'admin' })
      .eq('email', 'admin@fast.com')
      .select();
    console.log('Mis à jour:', JSON.stringify(data, null, 2));
    if (error) console.error('Erreur mise à jour:', error.message);
  }
}

main();
