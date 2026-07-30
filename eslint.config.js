// Config ESLint del progetto — formato nuovo "flat" (ESLint 9).
// Sostituisce il vecchio .eslintrc.cjs (formato legacy, non piu' avviabile con ESLint 9).
// Copre i file .js/.jsx (come il vecchio "--ext js,jsx"); i .ts NON si lintano qui (vedi note-operative-ai #6, si usa tsc).
// Guard colori dedicato: resta autonomo in eslint.colors.config.mjs (npm run lint:colors).
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // Cartelle da ignorare (equivalente del vecchio ignorePatterns: ['dist']).
  // La libreria gantt "vendored" (@hk-gantt, non importata da nessuna parte) non e'
  // codice nostro: TUTTA fuori dal lint (prima solo i tests/; estesa il 30/7/2026
  // quando i guardrail hanno iniziato a segnalarne il codice — rumore non azionabile).
  // Stessa esclusione in vite.config.js (test) e scripts/agenti/mappa.mjs (§2b).
  { ignores: ['dist/**', 'build/**', 'src/components/@hk-gantt/**'] },

  // Codice applicativo del frontend (browser).
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: '18.2' } },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // Regole hook classiche (intento del vecchio plugin:react-hooks/recommended):
      // rules-of-hooks + exhaustive-deps. NON si adotta qui l'intero ruleset "React Compiler"
      // del plugin 7.x (static-components, use-memo, immutability, set-state-in-effect...):
      // sarebbe una scelta a se', da concordare, con molte correzioni di massa sui moduli.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Override storici dal vecchio .eslintrc.cjs:
      'react/jsx-no-target-blank': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Guardrail manutenzione frontend (dal 30/7/2026, sessione riordino .jsx).
      // Tutti WARN: non bloccano ("blocca solo sul rosso"), segnalano il debito.
      // Le soglie si potranno stringere a error quando i file-mostro saranno spezzati.
      // no-unused-vars: riacceso (era off storico) per vedere il codice morto;
      // prefisso _ per ignorare di proposito; catch senza uso non segnalato.
      // Eccezione `React`: ~154 file hanno l'import legacy `import React from 'react'`,
      // innocuo col jsx-runtime attivo ma NON auto-fixabile — segnalarlo seppellirebbe
      // il segnale vero. Quando una pulizia meccanica rimuovera' gli import legacy,
      // togliere `|^React$` da varsIgnorePattern.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_|^React$',
        ignoreRestSiblings: true,
        caughtErrors: 'none',
      }],
      // Tetto dimensione file: 500 righe "conto grezzo" (stesso metro di npm run mappa;
      // la soglia-mostro resta 800). Un warning qui = il file va spezzato, non allungato.
      'max-lines': ['warn', 500],
      // Componenti/funzioni-monstre dentro i file.
      'max-lines-per-function': ['warn', 200],
    },
  },

  // File di configurazione alla radice (girano in Node).
  {
    files: ['*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'off',
    },
  },
]
