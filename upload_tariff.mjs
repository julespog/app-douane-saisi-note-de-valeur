import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import fs from 'fs';

const supabaseUrl = 'https://cjxramixzefbrsaweuoz.supabase.co';
const supabaseKey = 'sb_publishable_m-eMCMOjReLuOxjSwTR8PQ_bYAVEzO7';
const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadTariff() {
  console.log("Loading Excel file...");
  const filePath = './public/DOCUMENTATION S DOUANE/Tarif des Droits et Taxes 2022/Tarif CEMAC 2022.xlsx';
  const data = fs.readFileSync(filePath);
  
  console.log("Parsing Excel...");
  const workbook = XLSX.read(data, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  
  console.log(`Parsed ${jsonData.length} rows.`);
  console.log("Uploading to Supabase...");
  
  const jsonString = JSON.stringify(jsonData);
  
  // Create a Blob or File for Supabase
  const { data: uploadData, error } = await supabase.storage
    .from('documents')
    .upload('tariffs_data.json', jsonString, {
      contentType: 'application/json',
      upsert: true
    });
    
  if (error) {
    console.error("Upload failed:", error);
  } else {
    console.log("Upload success!", uploadData);
  }
}

uploadTariff();
