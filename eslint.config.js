import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/* 순수 레이어(core/engine/ports): React·DOM·adapters·비결정 전역 금지 */
const pureLayerFiles = ['src/core/**/*.ts', 'src/engine/**/*.ts', 'src/ports/**/*.ts'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: pureLayerFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*'], message: '순수 레이어에서 React 금지' },
            { group: ['**/adapters/*', '**/ui/*'], message: '의존 화살표는 안쪽(core)만 향한다' },
            { group: ['zustand', 'zustand/*'], message: '순수 레이어에서 상태 라이브러리 금지' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: '순수 레이어에서 시간 접근 금지 — Clock 포트를 사용' },
        { name: 'setTimeout', message: '순수 레이어에서 타이머 금지' },
        { name: 'setInterval', message: '순수 레이어에서 타이머 금지' },
        { name: 'window', message: '순수 레이어에서 DOM 금지' },
        { name: 'document', message: '순수 레이어에서 DOM 금지' },
        { name: 'location', message: '순수 레이어에서 DOM 금지 — HashStore 포트를 사용' },
        { name: 'AudioContext', message: '순수 레이어에서 Web Audio 금지 — AudioSink 포트를 사용' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '순수 레이어에서 비결정성 금지' },
      ],
    },
  },
);
