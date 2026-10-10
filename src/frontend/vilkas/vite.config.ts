import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Where the Django dev server (manage.py runserver) listens.
  const backend = loadEnv(mode, process.cwd(), 'VITE_').VITE_BACKEND_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    build: {
      // MapLibre GL is ~1 MB minified; it's split into its own chunk and loaded only when a map is shown.
      chunkSizeWarningLimit: 1100,
    },
    server: {
      proxy: {
        // Forward API calls to Django, so the browser sees one origin and
        // needs no CORS setup. `changeOrigin: false` keeps the browser's Host
        // header, so the absolute `Media.file_url` Django builds points back
        // at this dev server rather than at the backend's own address.
        '/api': { target: backend, changeOrigin: false },
        // Where those `file_url`s resolve to: the uploaded photos.
        '/media': { target: backend, changeOrigin: false },
      },
    },
  }
})
