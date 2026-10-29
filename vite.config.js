import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { transform as lightningTransform } from 'lightningcss'
import apiHandler from './api/cargas-8132.js'
import resolverGeolocHandler from './api/resolver-geoloc.js'
import adminAuthHandler from './api/admin-auth.js'
import tvAuthHandler from './api/tv-auth.js'
import pushSendHandler from './api/push-send.js'
import gpsPingHandler from './api/gps-ping.js'
import fs from 'node:fs'
import path from 'node:path'

function versionPlugin() {
  const versionId = `${Date.now()}`;
  return {
    name: 'version-plugin',
    buildStart() {
      try {
        const publicDir = path.resolve(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        const versionData = JSON.stringify({
          version: versionId,
          buildTime: new Date().toISOString()
        }, null, 2);
        fs.writeFileSync(path.join(publicDir, 'version.json'), versionData, 'utf-8');
      } catch (e) {
        console.error('Falha ao gerar version.json:', e);
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/version.json')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.end(JSON.stringify({
            version: versionId,
            buildTime: new Date().toISOString()
          }));
          return;
        }
        next();
      });
    }
  };
}

function apiDevPlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
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
            if (req.url.startsWith('/api/resolver-geoloc')) {
              await resolverGeolocHandler(req, res);
            } else if (req.url.startsWith('/api/admin-auth')) {
              await adminAuthHandler(req, res);
            } else if (req.url.startsWith('/api/tv-auth')) {
              await tvAuthHandler(req, res);
            } else if (req.url.startsWith('/api/push-send')) {
              await pushSendHandler(req, res);
            } else if (req.url.startsWith('/api/gps-ping')) {
              await gpsPingHandler(req, res);
            } else if (req.url.startsWith('/api/cargas') || req.url.startsWith('/api/exportar-csv')) {
              await apiHandler(req, res);
            } else {
              next();
            }
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

function unwrapLayers(code) {
  code = code.replace(/@layer\s+[^;{]+;/g, '');
  let result = '';
  let i = 0;
  while (i < code.length) {
    if (code.startsWith('@layer', i)) {
      const openBrace = code.indexOf('{', i);
      if (openBrace === -1) {
        result += code.substring(i);
        break;
      }
      let depth = 1;
      let j = openBrace + 1;
      while (j < code.length && depth > 0) {
        if (code[j] === '{') depth++;
        else if (code[j] === '}') depth--;
        j++;
      }
      const layerContent = code.substring(openBrace + 1, j - 1);
      result += unwrapLayers(layerContent);
      i = j;
    } else {
      result += code[i];
      i++;
    }
  }
  return result;
}

function webosCompatPlugin() {
  return {
    name: 'webos-compat-plugin',
    enforce: 'post',
    generateBundle(options, bundle) {
      for (const fileName in bundle) {
        if (fileName.endsWith('.css') && bundle[fileName].type === 'asset') {
          let css = bundle[fileName].source.toString();
          css = unwrapLayers(css);
          try {
            const res = lightningTransform({
              code: Buffer.from(css),
              targets: { chrome: (79 << 16) },
              minify: true
            });
            css = res.code.toString();
          } catch (e) {
            console.warn('[webosCompatPlugin] LightningCSS warning:', e);
          }
          bundle[fileName].source = css;
          console.log(`[webosCompatPlugin] CSS otimizado para Smart TVs (LG webOS / Chrome 79+): ${fileName} (${css.length} bytes, 0 @layers)`);
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    apiDevPlugin(),
    versionPlugin(),
    webosCompatPlugin()
  ],
  build: {
    target: ['es2020', 'chrome79', 'edge79', 'firefox78', 'safari13'],
    cssTarget: ['chrome79', 'edge79', 'firefox78', 'safari13'],
  },
  server: {
    host: true,
    port: 5173
  }
})
