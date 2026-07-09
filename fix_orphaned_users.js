import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjxramixzefbrsaweuoz.supabase.co';
const supabaseKey = 'sb_publishable_m-eMCMOjReLuOxjSwTR8PQ_bYAVEzO7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUsers() {
  const { data: orphanedUsers, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .is('company_id', null);

  if (fetchError) {
    console.error("Error fetching users:", fetchError);
    return;
  }

  if (!orphanedUsers || orphanedUsers.length === 0) {
    console.log("No orphaned users found.");
    return;
  }

  console.log(`Found ${orphanedUsers.length} orphaned users:`, orphanedUsers.map(u => u.email));

  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%navitrans%');

  if (compError) {
    console.error("Error fetching companies:", compError);
    return;
  }

  if (!companies || companies.length === 0) {
    console.log("Could not find Navitrans company.");
    return;
  }

  const navitransId = companies[0].id;
  console.log(`Found Navitrans company with ID: ${navitransId}`);

  for (const user of orphanedUsers) {
    console.log(`Updating user ${user.email}...`);
    const { error: updateError } = await supabase
      .from('users')
      .update({ company_id: navitransId })
      .eq('id', user.id);
      
    if (updateError) {
      console.error(`Failed to update user ${user.email}:`, updateError);
    } else {
      console.log(`Successfully updated user ${user.email}`);
    }
  }
}

fixUsers();
