/**
 * Rattachement des pays (liste COUNTRIES de countries.js) à 5 continents,
 * pour le regroupement par codes additionnels (niveaux 2 à 4).
 * Classification géographique de l'ONU pour les pays transcontinentaux :
 * Russie → Europe ; Turquie, Chypre, Géorgie, Arménie, Azerbaïdjan → Asie.
 */

const AFRIQUE = [
  'Afrique du Sud', 'Algérie', 'Angola', 'Bénin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroun', 'Cap-Vert',
  'Comores', 'Congo-Brazzaville', 'Congo-Kinshasa', "Côte d'Ivoire", 'Djibouti', 'Égypte', 'Érythrée', 'Eswatini',
  'Éthiopie', 'Gabon', 'Gambie', 'Ghana', 'Guinée', 'Guinée-Bissau', 'Guinée équatoriale', 'Kenya', 'Lesotho',
  'Liberia', 'Libye', 'Madagascar', 'Malawi', 'Mali', 'Maroc', 'Maurice', 'Mauritanie', 'Mozambique', 'Namibie',
  'Niger', 'Nigeria', 'Ouganda', 'République centrafricaine', 'Rwanda', 'São Tomé-et-Príncipe', 'Sénégal',
  'Seychelles', 'Sierra Leone', 'Somalie', 'Soudan', 'Soudan du Sud', 'Tanzanie', 'Tchad', 'Togo', 'Tunisie',
  'Zambie', 'Zimbabwe',
];

const EUROPE = [
  'Albanie', 'Allemagne', 'Andorre', 'Autriche', 'Belgique', 'Biélorussie', 'Bosnie-Herzégovine', 'Bulgarie',
  'Croatie', 'Danemark', 'Espagne', 'Estonie', 'Finlande', 'France', 'Grèce', 'Hongrie', 'Irlande', 'Islande',
  'Italie', 'Lettonie', 'Liechtenstein', 'Lituanie', 'Luxembourg', 'Macédoine du Nord', 'Malte', 'Moldavie',
  'Monaco', 'Monténégro', 'Norvège', 'Pays-Bas', 'Pologne', 'Portugal', 'Roumanie', 'Royaume-Uni', 'Russie',
  'Saint-Marin', 'Serbie', 'Slovaquie', 'Slovénie', 'Suède', 'Suisse', 'Tchéquie', 'Ukraine', 'Vatican',
];

const ASIE = [
  'Afghanistan', 'Arabie Saoudite', 'Arménie', 'Azerbaïdjan', 'Bahreïn', 'Bangladesh', 'Bhoutan', 'Birmanie',
  'Brunei', 'Chine', 'Chypre', 'Corée du Nord', 'Corée du Sud', 'Émirats arabes unis', 'Géorgie', 'Inde',
  'Indonésie', 'Irak', 'Iran', 'Israël', 'Japon', 'Jordanie', 'Kazakhstan', 'Kirghizistan', 'Koweït', 'Laos',
  'Liban', 'Malaisie', 'Maldives', 'Mongolie', 'Népal', 'Oman', 'Ouzbékistan', 'Pakistan', 'Philippines', 'Qatar',
  'Singapour', 'Sri Lanka', 'Syrie', 'Tadjikistan', 'Thaïlande', 'Timor oriental', 'Turkménistan', 'Turquie',
  'Viêt Nam', 'Yémen',
];

const AMERIQUE = [
  'Antigua-et-Barbuda', 'Argentine', 'Bahamas', 'Barbade', 'Belize', 'Bolivie', 'Brésil', 'Canada', 'Chili',
  'Colombie', 'Costa Rica', 'Cuba', 'Dominique', 'Équateur', 'États-Unis', 'Grenade', 'Guatemala', 'Guyana',
  'Haïti', 'Honduras', 'Jamaïque', 'Mexique', 'Nicaragua', 'Panama', 'Paraguay', 'Pérou', 'République dominicaine',
  'Saint-Kitts-et-Nevis', 'Saint-Vincent-et-les-Grenadines', 'Sainte-Lucie', 'Salvador', 'Suriname',
  'Trinité-et-Tobago', 'Uruguay', 'Venezuela',
];

const OCEANIE = [
  'Australie', 'Fidji', 'Kiribati', 'Micronésie', 'Nauru', 'Niue', 'Nouvelle-Zélande', 'Palaos',
  'Papouasie-Nouvelle-Guinée', 'Samoa', 'Tonga', 'Tuvalu', 'Vanuatu',
];

const norm = (s) => String(s || '').normalize('NFC').trim().toLowerCase();

const CONTINENT_BY_COUNTRY = new Map([
  ...AFRIQUE.map(p => [norm(p), 'Afrique']),
  ...EUROPE.map(p => [norm(p), 'Europe']),
  ...ASIE.map(p => [norm(p), 'Asie']),
  ...AMERIQUE.map(p => [norm(p), 'Amérique']),
  ...OCEANIE.map(p => [norm(p), 'Océanie']),
]);

export const CONTINENTS = ['Afrique', 'Europe', 'Asie', 'Amérique', 'Océanie'];

/** Continent d'un pays ; pays inconnu → son propre nom (il n'est alors regroupé qu'avec lui-même). */
export const getContinent = (pays) => CONTINENT_BY_COUNTRY.get(norm(pays)) || `Pays:${pays || '?'}`;
