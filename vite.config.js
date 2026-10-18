import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolveRuntimeConfig, CLOUD_ENV_KEYS } from './src/config.js';

// `vite build --mode native` produces the bundle that Capacitor wraps for Android and iOS.
// That build must contain a real Supabase configuration, so it refuses to finish without one.
// Demo fallbacks are only allowed in the normal browser build.
function nativeCloudGuard(mode) {
  return {
    name: 'yere-native-cloud-guard',
    apply: 'build',
    buildStart() {
      if (mode !== 'native') return;
      const fromFiles = loadEnv(mode, process.cwd(), 'VITE_');
      const env = { ...fromFiles };
      for (const key of Object.values(CLOUD_ENV_KEYS)) {
        if (process.env[key] !== undefined) env[key] = process.env[key];
      }
      const runtime = resolveRuntimeConfig(env, { native: true });
      if (!runtime.configured) {
        const lines = runtime.errors.map((message) => `  - ${message}`).join('\n');
        this.error(`Native Yere build refused: cloud configuration is invalid.\n${lines}\n` +
          'Set the GitHub repository variables (or local environment) and run the build again. ' +
          'Demo data is never bundled into native builds.');
      }
    }
  };
}

// Match Vercel's public legal routes in local development and the preview server.
function legalRoutes() {
  const install = (server) => {
    server.middlewares.use((req, _res, next) => {
      const [pathname, query] = (req.url || '').split('?');
      const routes = { '/privacy-policy': '/privacy.html', '/termsofuse': '/terms.html' };
      const destination = routes[pathname.replace(/\/$/, '')];
      if (destination) req.url = destination + (query ? `?${query}` : '');
      next();
    });
  };
  return { name: 'yere-legal-routes', configureServer: install, configurePreviewServer: install };
}

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), nativeCloudGuard(mode), legalRoutes()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  build: {
    target: 'es2020',
    sourcemap: true
  }
}));
