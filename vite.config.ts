import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
