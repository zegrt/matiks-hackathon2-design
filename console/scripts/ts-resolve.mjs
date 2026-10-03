// Lets `node --test` import the app's extensionless TS modules (Node strips the types itself).
import { registerHooks } from 'node:module';
registerHooks({
  resolve(spec, ctx, next) {
    try { return next(spec, ctx); }
    catch (e) { if (spec.startsWith('.') && !/\.\w+$/.test(spec)) return next(spec + '.ts', ctx); throw e; }
  },
});
