// Browser-safe entry point (no node:fs). Clients supply the YAML texts themselves, e.g. via
// Vite's import.meta.glob, or load a prebuilt dist/content.json.
export * from './bundle.js';
export * from './schema.js';
export * from './parse.js';
