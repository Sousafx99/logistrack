import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import apiHandler from './api/cargas-8132.js'

function apiDevPlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/cargas') || req.url.startsWith('/api/exportar-csv'))) {
          const urlObj = new URL(req.url, 'http://localhost');
          const query = Object.fromEntries(urlObj.searchParams.entries());
          req.query = query;
          
          res.status = (code) => {
            res.statusCode = code;
            return {
              json: (data) => {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify(data));
              },
              send: (data) => {
                res.end(data);
              },
              end: () => res.end()
            };
          };

          try {
            await apiHandler(req, res);
          } catch (e) {
            console.error('API Middleware Error:', e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    apiDevPlugin()
  ],
  server: {
    host: true,
    port: 5173
  }
})

