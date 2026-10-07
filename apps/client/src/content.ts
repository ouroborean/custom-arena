// Loads game content straight from the YAML files, so edits hot-reload in dev.
import { bundleFromYamlFiles, rawFromYamlFiles } from '@arena/content/browser';

const files = import.meta.glob('../../../packages/content/data/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const content = bundleFromYamlFiles(Object.entries(files).map(([path, text]) => ({ path, text })));

/** The core statuses (base/statuses.yaml), in file order: the reference lists them apart from element and fusion ones. */
export const coreStatusIds: string[] = Object.entries(files)
  .filter(([path]) => /[\/]base[\/]statuses\.yaml$/.test(path))
  .flatMap(([path, text]) => Object.keys(rawFromYamlFiles([{ path, text }]).statuses));
