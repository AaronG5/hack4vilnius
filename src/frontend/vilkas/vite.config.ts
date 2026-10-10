import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // MapLibre GL is ~1 MB minified; it's split into its own chunk and loaded only when a map is shown.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    // Forward API calls to the Django dev server (manage.py runserver).
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
