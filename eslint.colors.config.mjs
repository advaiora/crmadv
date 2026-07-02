// Config ESLint dedicato al SOLO controllo dei colori fissi negli stili inline JSX.
// Autonomo (formato nuovo "flat"), scollegato dal lint principale del progetto.
// Uso: npm run lint:colors — vedi archivio-documenti/design-system-temi.md
// Nota: lo stylelint copre i file .css; questa regola copre gli stili inline in JSX.

const hexPattern = '/#[0-9a-fA-F]{3,8}/';
const rgbHslPattern = '/(rgb|hsl)a?\\(\\s*[0-9.]/';
const message =
  'Colore fisso negli stili inline: usa un token del tema var(--...) — vedi archivio-documenti/design-system-temi.md';

export default [
  {
    files: ['src/modules/**/*.{jsx,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': [
        'warn',
        { selector: `Literal[value=${hexPattern}]`, message },
        { selector: `Literal[value=${rgbHslPattern}]`, message },
        { selector: `TemplateElement[value.raw=${hexPattern}]`, message },
        { selector: `TemplateElement[value.raw=${rgbHslPattern}]`, message },
      ],
    },
  },
];
