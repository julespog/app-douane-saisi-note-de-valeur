import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjxramixzefbrsaweuoz.supabase.co';
const supabaseKey = 'sb_publishable_m-eMCMOjReLuOxjSwTR8PQ_bYAVEzO7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteCompany() {
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', 'Administration Générale');

  if (compError) {
    console.error("Error fetching companies:", compError);
    return;
  }

  if (!companies || companies.length === 0) {
    console.log("Could not find 'Administration Générale'. Trying case-insensitive matching...");
    const { data: allComps } = await supabase.from('companies').select('id, name');
    const target = allComps.find(c => c.name.toLowerCase().includes('administration'));
    if (target) {
        console.log(`Found ${target.name} with ID: ${target.id}`);
        const { error: delError } = await supabase.from('companies').delete().eq('id', target.id);
        if (delError) console.error(delError);
        else console.log('Successfully deleted ' + target.name);
    } else {
        console.log("No matching company found.");
    }
    return;
  }

  const targetId = companies[0].id;
  console.log(`Found 'Administration Générale' with ID: ${targetId}. Deleting...`);

  // First, we might need to delete associated users or let Supabase cascade delete
  const { error: delError } = await supabase
    .from('companies')
    .delete()
    .eq('id', targetId);
    
  if (delError) {
    console.error(`Failed to delete company:`, delError);
  } else {
    console.log(`Successfully deleted company 'Administration Générale'`);
  }
}

deleteCompany();
