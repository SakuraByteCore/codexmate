import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { parseAnalyticsExportArgs } = require(path.join(__dirname, '..', '..', 'cli', 'analytics-export-args.js'));

test('parseAnalyticsExportArgs accepts equals-style values and output shorthand', () => {
    const parsed = parseAnalyticsExportArgs([
        '--format=json',
        '--from=2026-05-01',
        '--to', '2026-05-06',
        '--model', 'gpt-5.3',
        '--source=codex',
        '-o', '-',
        '--force-refresh'
    ]);

    assert.strictEqual(parsed.error, '');
    assert.deepStrictEqual(parsed.options, {
        format: 'json',
        source: 'codex',
        output: '-',
        from: '2026-05-01',
        to: '2026-05-06',
        model: 'gpt-5.3',
        forceRefresh: true
    });
});

test('parseAnalyticsExportArgs accepts long output assignment and help flag', () => {
    const parsed = parseAnalyticsExportArgs(['--output=usage.csv', '--help']);

    assert.strictEqual(parsed.error, '');
    assert.deepStrictEqual(parsed.options, {
        format: 'csv',
        source: 'all',
        output: 'usage.csv',
        help: true
    });
});

test('parseAnalyticsExportArgs reports unknown tokens and invalid choices', () => {
    const parsed = parseAnalyticsExportArgs([
        '--format', 'xml',
        '--source', 'openai',
        '--surprise'
    ]);

    assert.match(parsed.error, /未知参数 --surprise/);
    assert.match(parsed.error, /--format 必须是 csv 或 json/);
    assert.match(parsed.error, /--source 必须是 codex、claude、gemini、codebuddy、pi 或 all/);
});

test('parseAnalyticsExportArgs accepts pi source', () => {
    const parsed = parseAnalyticsExportArgs(['--source', 'pi']);

    assert.strictEqual(parsed.error, '');
    assert.strictEqual(parsed.options.source, 'pi');
});
