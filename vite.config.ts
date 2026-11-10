import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // 앱 코드와 바뀌지 않는 라이브러리를 나눈다. 한 덩어리면 500KB를 넘어
        // 경고가 나고, 앱만 고쳐도 사용자가 React와 supabase-js를 다시 받는다.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'supabase', test: /node_modules\/@supabase\// },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/dump.test.ts'],
    env: {
      // supabase-js는 생성 시점에 URL 형식을 검증한다. 실제 네트워크 호출이 없는
      // 순수 헬퍼 테스트에서도 모듈 임포트만으로 client가 생성되므로 더미 값 필요.
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
