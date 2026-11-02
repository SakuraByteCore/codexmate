import path from 'node:path';
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

const port = process.env.CODEXMATE_E2E_PORT || '3939';

export default {
    tests: 'tests/e2e-browser/**/*.e2e.ts',
    targets: [
        {
            name: 'chromium',
            engine: web({
                browser: 'chromium',
                viewport: { width: 1440, height: 900 },
                testIdAttribute: 'id'
            }),
            app: {
                url: process.env.CODEXMATE_E2E_URL || `http://127.0.0.1:${port}`,
                command: {
                    executable: process.execPath,
                    args: [path.join('tests', 'e2e-browser', 'start-app.js'), port],
                    env: {
                        CODEXMATE_PORT: port,
                        CODEXMATE_NO_BROWSER: '1'
                    },
                    startupTimeout: 60_000,
                    log: '.e2e/logs/app.log'
                }
            }
        }
    ],
    workers: 1,
    reporters: ['list'],
    output: '.e2e'
} satisfies E2EConfig;
