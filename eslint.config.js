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
  // I test della libreria gantt "vendored" (@hk-gantt, non importata da nessuna parte)
  // usano globali di test-runner e non sono codice nostro: fuori dal lint.
  { ignores: ['dist/**', 'build/**', 'src/components/@hk-gantt/**/tests/**'] },

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
      'no-unused-vars': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
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
