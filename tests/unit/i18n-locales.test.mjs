import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DICT } from '../../web-ui/modules/i18n.dict.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const localeDir = path.join(repoRoot, 'web-ui', 'modules', 'i18n', 'locales');
const expectedLocales = ['zh', 'en', 'ja', 'vi'];

function placeholders(value) {
    return [...String(value).matchAll(/\{(\w+)\}/g)]
        .map(match => match[1])
        .sort();
}

function readLocaleSource(code) {
    return fs.readFileSync(path.join(localeDir, `${code}.mjs`), 'utf8');
}

function localeSourceKeys(code) {
    return [...readLocaleSource(code).matchAll(/^\s*'([^']+)'\s*:/gm)].map(match => match[1]);
}

test('i18n dictionaries are split into locale modules', () => {
    const localeFiles = fs.readdirSync(localeDir)
        .filter(name => name.endsWith('.mjs'))
        .sort();
    assert.deepStrictEqual(localeFiles, expectedLocales.map(code => `${code}.mjs`).sort());
    assert.deepStrictEqual(Object.keys(DICT).sort(), expectedLocales.sort());

    const aggregator = fs.readFileSync(path.join(repoRoot, 'web-ui', 'modules', 'i18n.dict.mjs'), 'utf8');
    assert(aggregator.length < 1200, 'i18n.dict.mjs should stay as a small locale aggregator');
    for (const code of expectedLocales) {
        assert(aggregator.includes(`./i18n/locales/${code}.mjs`), `aggregator should import ${code}.mjs`);
        assert(DICT[code] && typeof DICT[code] === 'object', `${code} dictionary should be available`);
    }
});

test('locale source files do not declare duplicate keys', () => {
    for (const code of expectedLocales) {
        const seen = new Set();
        const duplicates = new Set();
        for (const key of localeSourceKeys(code)) {
            if (seen.has(key)) {
                duplicates.add(key);
            }
            seen.add(key);
        }
        assert.deepStrictEqual([...duplicates].sort(), [], `${code} locale should not contain duplicate keys`);
    }
});

test('partial locale overrides only known keys and preserves placeholders', () => {
    const fallback = DICT.zh;
    for (const [key, value] of Object.entries(DICT.vi)) {
        assert(Object.prototype.hasOwnProperty.call(fallback, key), `vi should not define unknown key: ${key}`);
        assert.deepStrictEqual(
            placeholders(value),
            placeholders(fallback[key]),
            `vi placeholder mismatch for key: ${key}`
        );
    }
});

test('Japanese orchestration template copy stays localized', () => {
    const staleChineseCopy = [
        '输出统一结论',
        '避免重复描述',
        '继续处理新增 review 评论',
        '最后更新 PR 摘要',
        '用 Workflow 跑一组固定检查并整理结果'
    ];
    const templateCopy = [
        DICT.ja['orchestration.templates.reviewFix.notes'],
        DICT.ja['orchestration.templates.reviewFix.followUps'],
        DICT.ja['orchestration.templates.planOnly.notes'],
        DICT.ja['orchestration.templates.workflowBatch.notes']
    ].join('\n');
    for (const phrase of staleChineseCopy) {
        assert(!templateCopy.includes(phrase), `Japanese template copy should not include stale Chinese phrase: ${phrase}`);
    }
});
