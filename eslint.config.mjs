import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig({
  files: ['**/*.{js,ts,tsx}'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: [js.configs.recommended, tseslint.configs.recommended, tseslint.configs.strict],
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'react-refresh/only-export-components': 'warn',
  },
})
