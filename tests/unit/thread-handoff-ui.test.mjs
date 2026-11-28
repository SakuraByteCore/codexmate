import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const template = fs.readFileSync('web-ui/partials/index/thread-handoff.html', 'utf8');
const css = fs.readFileSync('web-ui/styles/sessions-preview.css', 'utf8');

test('handoff polish preserves all form bindings, recovery actions and evidence semantics', () => {
    assert.ok(require('@vue/compiler-dom').compile(template, { mode: 'function', prefixIdentifiers: true }).code);
    for (const field of ['handoffDraft.target', 'handoffDraft.goal', 'handoffDraft[field.key]']) assert.ok(template.includes(`v-model="${field}"`));
    for (const action of ['loadThreadHandoffs', 'copyThreadHandoff(record)', 'generateSelectedHandoff', 'locateDraftEvidence(item)']) assert.ok(template.includes(`@click="${action}"`));
    assert.ok(template.includes('@submit.prevent="createThreadHandoff"'));
    assert.ok(template.includes('@toggle="toggleThreadHandoff"'));
    assert.match(template, /readonly :value="handoffCopyText" @focus="\$event.target.select\(\)"/);
    assert.match(template, /复制不会自动发送/);
    for (const field of ['record.id', 'record.createdAt', 'record.durationMs', 'record.writeDurationMs', 'record.fallback', 'record.mcp.server', 'record.mcp.tool', 'record.filePath', 'record.readConfirmation.agent', 'record.readConfirmation.at', 'warning.source', 'warning.reason']) assert.ok(template.includes(field), field);
    assert.match(template, /失败或结果未确认（不重试）/);
    assert.match(template, /class="thread-handoff-audit">\s*<summary>投递详情<\/summary>/);
    assert.ok(template.indexOf('record.readConfirmation.evidence') < template.indexOf('<summary>投递详情</summary>'));
});

test('handoff styling scopes typography, responsive columns and theme contrast to its own surface', () => {
    const stylesheet = require('postcss').parse(css);
    const styles = css.slice(css.indexOf('#panel-sessions .thread-handoff {'), css.indexOf('/* Keep the session tab close'));
    assert.match(styles, /font-size: max\(16px, var\(--font-size-body\)\)/);
    assert.match(styles, /@container handoff \(max-width: 560px\)/);
    assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(styles, /background: var\(--color-text-primary\); color: var\(--color-surface\)/);
    assert.match(styles, /prefers-reduced-motion/); assert.match(styles, /focus-visible/);
    assert.doesNotMatch(styles, /#fff|#000|linear-gradient|backdrop-filter/);
    assert.ok(styles.includes('min-height: 44px')); assert.ok(styles.includes('min-width: 44px'));
    const rules = []; stylesheet.walkRules(rule => { if (rule.selector.includes('thread-handoff')) rules.push(rule); });
    assert.ok(rules.every(rule => rule.selector.includes('thread-handoff') || rule.selector.includes('handoff')));
});
