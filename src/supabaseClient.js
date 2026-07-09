import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjxramixzefbrsaweuoz.supabase.co';
const supabaseKey = 'sb_publishable_m-eMCMOjReLuOxjSwTR8PQ_bYAVEzO7';

export const supabase = createClient(supabaseUrl, supabaseKey);
