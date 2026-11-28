import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const postcss = require('postcss');

test('record-only overrides flatten cards, retain theme tokens and enlarge action targets', () => {
    const css = postcss.parse(fs.readFileSync('web-ui/styles/sessions-list.css', 'utf8'));
    const declarations = selector => {
        const rules = []; css.walkRules(rule => { if (rule.selector === selector && rule.parent.type === 'root') rules.push(rule); });
        return Object.fromEntries(rules.at(-1).nodes.map(node => [node.prop, node.value]));
    };
    const row = declarations('#panel-sessions .session-list > .session-item');
    assert.equal(row['box-shadow'], 'none'); assert.equal(row['border-radius'], '8px'); assert.equal(row.background, 'transparent');
    assert.equal(declarations('#panel-sessions .session-list > .session-item::before').content, 'none');
    const button = declarations('#panel-sessions .session-item-copy');
    assert.equal(button.width, '44px'); assert.equal(button.height, '44px'); assert.equal(button.transform, 'none');
    const html = fs.readFileSync('web-ui/partials/index/panel-sessions.html', 'utf8');
    assert.ok(html.indexOf('class="session-count-badge"') > html.indexOf('class="session-item-meta"'));
    for (const action of ['selectSession(session)', 'toggleSessionPin(session)', 'copyResumeCommand(session)', 'toggleSessionSelectionForBatch(session)']) assert.ok(html.includes(action), action);
});
