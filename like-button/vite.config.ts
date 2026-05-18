import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Dockerの外から見れるようにする
    watch: {
      usePolling: true, // ★これを追加！ファイルを無理やり見に行く設定
    },
  },
})