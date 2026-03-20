import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite plugin that adds local API endpoints for Instagram posting.
 * Only active in dev mode (npm run dev). Reads tokens from .env.
 */
function instagramApiPlugin() {
  return {
    name: 'instagram-api',
    configureServer(server) {
      // Load ALL env variables (including non-VITE_ ones) into process.env
      const env = loadEnv('development', process.cwd(), '');
      Object.assign(process.env, env);

      // Helper to read JSON body from request
      function readBody(req) {
        return new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { resolve({}); }
          });
          req.on('error', reject);
        });
      }

      // POST /api/instagram/publish
      server.middlewares.use('/api/instagram/publish', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const { imageUrl, caption } = await readBody(req);
          if (!imageUrl || !caption) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'imageUrl and caption are required' }));
            return;
          }

          const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
          const igUserId = process.env.INSTAGRAM_USER_ID;

          if (!accessToken || !igUserId) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID must be set in .env' }));
            return;
          }

          // Dynamic import to use ESM module
          const { publishToInstagram } = await import('./server/instagramApi.js');
          const result = await publishToInstagram(
            { imageUrl, caption },
            { accessToken, igUserId }
          );

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // GET /api/instagram/token-status
      server.middlewares.use('/api/instagram/token-status', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
          if (!accessToken) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ isValid: false, expiresAt: null }));
            return;
          }

          const { checkTokenStatus } = await import('./server/instagramApi.js');
          const status = await checkTokenStatus(accessToken);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(status));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      // POST /api/instagram/renew-token
      server.middlewares.use('/api/instagram/renew-token', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const currentToken = process.env.INSTAGRAM_ACCESS_TOKEN;
          const appId = process.env.INSTAGRAM_APP_ID;
          const appSecret = process.env.INSTAGRAM_APP_SECRET;

          if (!currentToken || !appId || !appSecret) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be set in .env' }));
            return;
          }

          // Exchange current token for a new long-lived token
          const exchangeRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`
          );
          const exchangeData = await exchangeRes.json();

          if (exchangeData.error) {
            throw new Error(exchangeData.error.message);
          }

          const newToken = exchangeData.access_token;
          const expiresIn = exchangeData.expires_in; // seconds

          // Update .env file on disk
          const fs = await import('fs');
          const path = await import('path');
          const envPath = path.resolve(process.cwd(), '.env');
          let envContent = fs.readFileSync(envPath, 'utf-8');
          envContent = envContent.replace(
            /INSTAGRAM_ACCESS_TOKEN=.*/,
            `INSTAGRAM_ACCESS_TOKEN=${newToken}`
          );
          fs.writeFileSync(envPath, envContent, 'utf-8');

          // Update the running process env
          process.env.INSTAGRAM_ACCESS_TOKEN = newToken;

          const expiresAt = Date.now() + expiresIn * 1000;

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, expiresAt, expiresInDays: Math.floor(expiresIn / 86400) }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), instagramApiPlugin()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
        }
      }
    }
  },
  server: {
    port: 3000,
    open: false
  }
})
