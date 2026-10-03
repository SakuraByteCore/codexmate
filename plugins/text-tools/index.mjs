export const DEFAULT_TEXT_TOOL_ID = 'compress';

export function compressTextToSingleLine(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/\s+/g, ' ').trim();
}

export const textTools = [
    {
        id: 'compress',
        labelKey: 'plugins.textTools.tools.compress',
        run: compressTextToSingleLine
    }
];
