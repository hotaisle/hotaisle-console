import { bindings, defineConfig, exports } from 'cf/config';

export default defineConfig((ctx) => ({
  worker: {
    name: 'hotaisle-console',
    compatibilityDate: '2026-10-01',
    entrypoint: './src/index.ts',
    observability: { enabled: true },
    assets: {
      notFoundHandling: 'single-page-application',
      runWorkerFirst: ['/auth/*', '/api/*', '/records/*'],
    },
    env: {
      API_BASE: bindings.text(ctx.mode === 'fake' ? 'http://127.0.0.1:8788/api' : 'https://admin.hotaisle.app/api'),
      SESSION_SECRET: ctx.mode === 'fake'
        ? bindings.text(process.env.HOTAISLE_FAKE_SESSION_SECRET ?? '')
        : bindings.secret(),
      ACCOUNTS: bindings.durableObject({ worker: 'hotaisle-console', exportName: 'Account' }),
      ASSETS: bindings.assets(),
    },
    exports: {
      Account: exports.durableObject({ storage: 'sqlite' }),
    },
  },
}));
