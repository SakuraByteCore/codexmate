const GROUP_WHITESPACE = 'whitespace';
const GROUP_TEXT = 'text';
const GROUP_CASE = 'case';
const GROUP_ENCODE = 'encode';
const GROUP_FORMAT = 'format';
const GROUP_CONVERT = 'convert';

function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatLocalDateTime(date) {
    return [
        `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
        `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
    ].join(' ');
}

function toBinaryString(bytes) {
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return binary;
}

function base64Encode(text) {
    const bytes = new TextEncoder().encode(text);
    return btoa(toBinaryString(bytes));
}

function base64Decode(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

function titleCase(text) {
    return text.toLowerCase().replace(/(^|\s)([a-z])/g, (_match, prefix, ch) => prefix + ch.toUpperCase());
}

function camelToSnake(text) {
    return text
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
}

function snakeToCamel(text) {
    return text.replace(/_([a-z0-9])/g, (_match, ch) => String(ch).toUpperCase());
}

export const TEXT_TOOL_GROUPS = [
    { id: GROUP_WHITESPACE, labelKey: 'plugins.textTools.group.whitespace' },
    { id: GROUP_TEXT, labelKey: 'plugins.textTools.group.text' },
    { id: GROUP_CASE, labelKey: 'plugins.textTools.group.case' },
    { id: GROUP_ENCODE, labelKey: 'plugins.textTools.group.encode' },
    { id: GROUP_FORMAT, labelKey: 'plugins.textTools.group.format' },
    { id: GROUP_CONVERT, labelKey: 'plugins.textTools.group.convert' }
];

export const TEXT_TOOLS = [
    {
        id: 'removeSpaces',
        group: GROUP_WHITESPACE,
        labelKey: 'plugins.textTools.tool.removeSpaces',
        run: (text) => text.replace(/ /g, '')
    },
    {
        id: 'removeNewlines',
        group: GROUP_WHITESPACE,
        labelKey: 'plugins.textTools.tool.removeNewlines',
        run: (text) => text.replace(/[\r\n]+/g, '')
    },
    {
        id: 'removeBlankLines',
        group: GROUP_WHITESPACE,
        labelKey: 'plugins.textTools.tool.removeBlankLines',
        run: (text) => text.split(/\r?\n/).filter((line) => line.trim() !== '').join('\n')
    },
    {
        id: 'removeCR',
        group: GROUP_WHITESPACE,
        labelKey: 'plugins.textTools.tool.removeCR',
        run: (text) => text.replace(/\r/g, '')
    },
    {
        id: 'removeTabs',
        group: GROUP_WHITESPACE,
        labelKey: 'plugins.textTools.tool.removeTabs',
        run: (text) => text.replace(/\t/g, '')
    },
    {
        id: 'compressAll',
        group: GROUP_WHITESPACE,
        labelKey: 'plugins.textTools.tool.compressAll',
        run: (text) => text.replace(/\s+/g, '')
    },
    {
        id: 'dedupeLines',
        group: GROUP_TEXT,
        labelKey: 'plugins.textTools.tool.dedupeLines',
        run: (text) => {
            const seen = new Set();
            return text
                .split(/\r?\n/)
                .filter((line) => {
                    if (seen.has(line)) return false;
                    seen.add(line);
                    return true;
                })
                .join('\n');
        }
    },
    {
        id: 'sortLines',
        group: GROUP_TEXT,
        labelKey: 'plugins.textTools.tool.sortLines',
        run: (text) => text.split(/\r?\n/).sort((a, b) => a.localeCompare(b)).join('\n')
    },
    {
        id: 'reverseText',
        group: GROUP_TEXT,
        labelKey: 'plugins.textTools.tool.reverseText',
        run: (text) => Array.from(text).reverse().join('')
    },
    {
        id: 'toUpperCase',
        group: GROUP_CASE,
        labelKey: 'plugins.textTools.tool.toUpperCase',
        run: (text) => text.toUpperCase()
    },
    {
        id: 'toLowerCase',
        group: GROUP_CASE,
        labelKey: 'plugins.textTools.tool.toLowerCase',
        run: (text) => text.toLowerCase()
    },
    {
        id: 'titleCase',
        group: GROUP_CASE,
        labelKey: 'plugins.textTools.tool.titleCase',
        run: titleCase
    },
    {
        id: 'camelToSnake',
        group: GROUP_CASE,
        labelKey: 'plugins.textTools.tool.camelToSnake',
        run: camelToSnake
    },
    {
        id: 'snakeToCamel',
        group: GROUP_CASE,
        labelKey: 'plugins.textTools.tool.snakeToCamel',
        run: snakeToCamel
    },
    {
        id: 'base64Encode',
        group: GROUP_ENCODE,
        labelKey: 'plugins.textTools.tool.base64Encode',
        run: base64Encode
    },
    {
        id: 'base64Decode',
        group: GROUP_ENCODE,
        labelKey: 'plugins.textTools.tool.base64Decode',
        run: (text) => {
            const cleaned = text.trim();
            const packed = cleaned.replace(/\s+/g, '');
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(packed)) {
                throw new Error('Invalid Base64 input');
            }
            return base64Decode(packed);
        }
    },
    {
        id: 'jsonBeautify',
        group: GROUP_FORMAT,
        labelKey: 'plugins.textTools.tool.jsonBeautify',
        run: (text) => JSON.stringify(JSON.parse(text), null, 2)
    },
    {
        id: 'jsonMinify',
        group: GROUP_FORMAT,
        labelKey: 'plugins.textTools.tool.jsonMinify',
        run: (text) => JSON.stringify(JSON.parse(text))
    },
    {
        id: 'timestampToDate',
        group: GROUP_CONVERT,
        labelKey: 'plugins.textTools.tool.timestampToDate',
        run: (text) => {
            const raw = text.trim();
            if (!/^\d{1,17}$/.test(raw)) {
                throw new Error('Invalid timestamp');
            }
            let ms = Number(raw);
            if (raw.length === 10) ms *= 1000;
            const date = new Date(ms);
            if (!Number.isFinite(date.getTime())) {
                throw new Error('Invalid timestamp');
            }
            return formatLocalDateTime(date);
        }
    },
    {
        id: 'dateToTimestamp',
        group: GROUP_CONVERT,
        labelKey: 'plugins.textTools.tool.dateToTimestamp',
        run: (text) => {
            const ms = Date.parse(text.trim());
            if (!Number.isFinite(ms)) {
                throw new Error('Invalid date input');
            }
            return String(Math.floor(ms / 1000));
        }
    },
    {
        id: 'decToHex',
        group: GROUP_CONVERT,
        labelKey: 'plugins.textTools.tool.decToHex',
        run: (text) => {
            const raw = text.trim();
            if (!/^-?\d+$/.test(raw)) {
                throw new Error('Invalid decimal input');
            }
            return `0x${BigInt(raw).toString(16)}`;
        }
    },
    {
        id: 'hexToDec',
        group: GROUP_CONVERT,
        labelKey: 'plugins.textTools.tool.hexToDec',
        run: (text) => {
            const raw = text.trim().replace(/^0x/i, '');
            if (!/^-?[0-9a-fA-F]+$/.test(raw)) {
                throw new Error('Invalid hex input');
            }
            const sign = raw.startsWith('-') ? -1n : 1n;
            const digits = raw.replace(/^-/, '');
            return String(sign * BigInt(`0x${digits}`));
        }
    }
];

export function findTextTool(id) {
    const key = typeof id === 'string' ? id.trim() : '';
    if (!key) return null;
    return TEXT_TOOLS.find((tool) => tool && tool.id === key) || null;
}