import CodeListSelect from './CodeListSelect';
import CODES_ADDITIONNELS from '../data/codesAdditionnels.json';

// Détail affiché sous le libellé : base légale et ancien code correspondant.
const OPTIONS = CODES_ADDITIONNELS.map(c => ({
  code: c.code,
  libelle: c.libelle,
  detail: [c.baseLegale, c.ancienCode ? `ancien code ${c.ancienCode}` : ''].filter(Boolean).join(' · '),
}));

/** Champ « Code additionnel » d'une marchandise : liste des 126 codes + 000, saisie libre. */
const CodeAdditionnelSelect = ({ value, ...props }) => (
  <CodeListSelect options={OPTIONS} noun="codes additionnels" placeholder="000" value={value ?? '000'} {...props} />
);

export default CodeAdditionnelSelect;
