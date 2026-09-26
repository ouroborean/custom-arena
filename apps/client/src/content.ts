// Loads game content straight from the YAML files, so edits hot-reload in dev.
import { bundleFromYamlFiles } from '@arena/content/browser';

const files = import.meta.glob('../../../packages/content/data/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const content = bundleFromYamlFiles(Object.entries(files).map(([path, text]) => ({ path, text })));
