const fs = require('fs');

const countriesStr = fs.readFileSync('src/utils/countries.js', 'utf8');
const match = countriesStr.match(/export const COUNTRIES = \[([\s\S]+?)\];/);

if (match) {
  // Dirty parse of the array
  const arr = eval('[' + match[1] + ']');
  
  // A quick way to get ISO codes in node: Intl.DisplayNames
  // But wait, Intl.DisplayNames converts code to name, not name to code.
  // I will just download a JSON of country codes and map it, or use a library, or just approximate it.
  // Actually, I can use a simple map for the most common ones, or a package if it's already in node_modules.
  // Let's check if 'i18n-iso-countries' is installed.
  console.log(arr.length + " countries found.");
}
