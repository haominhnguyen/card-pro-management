import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // or '0.0.0.0'
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true // Needed for some Docker environments
    }
  },
  build: {
    // Split heavy vendors into their own chunks so the main bundle stays lean
    // and the browser can cache React / antd independently across deploys.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react') || id.includes('/scheduler')) return 'react-vendor';
          if (id.includes('/antd') || id.includes('/@ant-design') || id.includes('/rc-'))
            return 'antd-vendor';
        },
      },
    },
  }
})

