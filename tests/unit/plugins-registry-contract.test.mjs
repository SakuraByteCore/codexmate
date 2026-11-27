import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const root = path.join(__dirname, '..', '..');
const registryPath = path.join(root, 'plugins', 'registry.mjs');
const generator = require(path.join(root, 'tools', 'dev', 'generate-plugins-registry.js'));

test('plugin subtabs follow desktop navigation order in every locale without reordering the registry', async () => {
    const { createPluginsComputed } = await import('../../web-ui/modules/plugins.computed.mjs');
    const { pluginsRegistry } = await import('../../plugins/registry.mjs');
    const { DICT } = await import('../../web-ui/modules/i18n.dict.mjs');
    const header = fs.readFileSync(path.join(root, 'web-ui/partials/index/layout-header.html'), 'utf8');
    const expected = [...header.matchAll(/data-plugins-id="([^"]+)"/g)].map(match => match[1]);
    const registryIds = pluginsRegistry.map(entry => entry.id);
    assert.deepStrictEqual(expected, ['prompt-templates', 'text-tools', 'file-sharing']);
    for (const dictionary of Object.values(DICT)) {
        const catalog = createPluginsComputed().pluginsCatalog.call({ t: key => dictionary[key] || key });
        assert.deepStrictEqual(catalog.map(plugin => plugin.id), expected);
        assert.strictEqual(catalog[0].title, dictionary['plugins.catalog.promptTemplates.title']);
    }
    assert.deepStrictEqual(pluginsRegistry.map(entry => entry.id), registryIds);
});

test('plugins registry matches generator output', () => {
    const actual = fs.readFileSync(registryPath, 'utf8').replace(/^\uFEFF/u, '');
    const expected = String(generator.generatePluginsRegistrySource() || '').replace(/^\uFEFF/u, '');
    assert.strictEqual(actual, expected);
});

