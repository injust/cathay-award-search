import love from 'eslint-config-love'
import tseslint from 'typescript-eslint'

export default tseslint.config(love, {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
})
