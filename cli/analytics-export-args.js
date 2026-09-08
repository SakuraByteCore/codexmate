function parseAnalyticsExportArgs(args = []) {
    const options = {
        format: 'csv',
        source: 'all',
        output: ''
    };
    const errors = [];
    for (let index = 0; index < args.length; index += 1) {
        const token = String(args[index] || '');
        const readValue = (flag) => {
            if (token.startsWith(`${flag}=`)) {
                return token.slice(flag.length + 1);
            }
            const value = args[index + 1];
            index += 1;
            return value;
        };
        if (token === '--format' || token.startsWith('--format=')) {
            options.format = String(readValue('--format') || '').trim().toLowerCase();
            continue;
        }
        if (token === '--from' || token.startsWith('--from=')) {
            options.from = String(readValue('--from') || '').trim();
            continue;
        }
        if (token === '--to' || token.startsWith('--to=')) {
            options.to = String(readValue('--to') || '').trim();
            continue;
        }
        if (token === '--model' || token.startsWith('--model=')) {
            options.model = String(readValue('--model') || '').trim();
            continue;
        }
        if (token === '--source' || token.startsWith('--source=')) {
            options.source = String(readValue('--source') || '').trim().toLowerCase();
            continue;
        }
        if (token === '--output' || token === '-o' || token.startsWith('--output=')) {
            options.output = String(readValue(token === '-o' ? '-o' : '--output') || '').trim();
            continue;
        }
        if (token === '--force-refresh') {
            options.forceRefresh = true;
            continue;
        }
        if (token === '--help' || token === '-h') {
            options.help = true;
            continue;
        }
        if (token) {
            errors.push(`未知参数 ${token}`);
        }
    }
    if (options.format !== 'csv' && options.format !== 'json') {
        errors.push('--format 必须是 csv 或 json');
    }
    if (options.source && !['codex', 'claude', 'gemini', 'codebuddy', 'pi', 'all'].includes(options.source)) {
        errors.push('--source 必须是 codex、claude、gemini、codebuddy、pi 或 all');
    }
    return {
        options,
        error: errors.join('；')
    };
}

module.exports = {
    parseAnalyticsExportArgs
};
