import path from 'node:path';
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

const startAppScript = path.join('tests', 'e2e-browser', 'start-app.js');
const desktopPort = process.env.CODEXMATE_E2E_PORT || '3939';
const compactPort = process.env.CODEXMATE_E2E_COMPACT_PORT || '3940';
const externalUrl = process.env.CODEXMATE_E2E_URL;

function browserTarget(name: string, port: string, viewport: { width: number; height: number }) {
    return {
        name,
        engine: web({
            browser: 'chromium',
            viewport,
            testIdAttribute: 'id'
        }),
        app: {
            url: `http://127.0.0.1:${port}`,
            command: {
                executable: process.execPath,
                args: [startAppScript, port],
                env: {
                    CODEXMATE_PORT: port,
                    CODEXMATE_NO_BROWSER: '1'
                },
                startupTimeout: 60_000,
                log: `.e2e/logs/app-${name}.log`
            }
        }
    };
}

// 桌面目标走侧栏导航，紧凑目标走顶栏标签页导航；两者跑同一套用例。
const targets = externalUrl
    ? [
        {
            name: 'desktop',
            engine: web({ browser: 'chromium', viewport: { width: 1440, height: 900 }, testIdAttribute: 'id' }),
            app: { url: externalUrl }
        }
    ]
    : [
        browserTarget('desktop', desktopPort, { width: 1440, height: 900 }),
        browserTarget('compact', compactPort, { width: 390, height: 844 })
    ];

export default {
    tests: 'tests/e2e-browser/**/*.e2e.ts',
    targets,
    workers: 1,
    reporters: ['list'],
    output: '.e2e'
} satisfies E2EConfig;
