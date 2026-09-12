const fs = require('fs');
const path = require('path');

const HTML_INCLUDE_RE = /^[ \t]*<!--\s*@include\s+(.+?)\s*-->\s*$/gm;
const CSS_IMPORT_RE = /^[ \t]*@import\s+(?:url\(\s*)?(['"]?)([^'")]+)\1\s*\)?\s*;/gm;
const JS_IMPORT_RE = /(?:^|\n)\s*import\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]\s*;?/g;
const JS_EXPORT_FROM_RE = /(?:^|\n)\s*export\s+\*\s+from\s+['"](\.[^'"]+)['"]\s*;?/g;
const JS_RELATIVE_IMPORT_STATEMENT_RE = /(^|\n)([ \t]*)import\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]\s*;?[ \t]*/g;
const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;
const VOID_HTML_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
]);
const PRECOMPILED_RENDER_PATH = path.join(__dirname, 'res', 'web-ui-render.precompiled.js');

function stripBom(content) {
    return content.replace(/^\uFEFF/, '');
}

function readUtf8Text(filePath) {
    return stripBom(fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n'));
}

function normalizeIncludeTarget(rawTarget) {
    const trimmed = String(rawTarget || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/^['"]|['"]$/g, '');
}

function assertNoCircularDependency(filePath, stack) {
    if (!stack.includes(filePath)) {
        return;
    }
    const cycle = [...stack, filePath]
        .map(item => path.relative(path.join(__dirname, '..'), item))
        .join(' -> ');
    throw new Error(`Detected circular source include: ${cycle}`);
}

function bundleHtmlFile(filePath, stack = []) {
    assertNoCircularDependency(filePath, stack);
    const source = readUtf8Text(filePath);
    return source.replace(HTML_INCLUDE_RE, (_match, rawTarget) => {
        const target = normalizeIncludeTarget(rawTarget);
        if (!target) {
            return '';
        }
        const targetPath = path.resolve(path.dirname(filePath), target);
        return bundleHtmlFile(targetPath, [...stack, filePath]);
    });
}

function bundleCssFile(filePath, stack = []) {
    assertNoCircularDependency(filePath, stack);
    const source = readUtf8Text(filePath);
    return source.replace(CSS_IMPORT_RE, (match, _quote, rawTarget) => {
        const target = normalizeIncludeTarget(rawTarget);
        if (!target || !target.startsWith('.')) {
            return match;
        }
        const targetPath = path.resolve(path.dirname(filePath), target);
        return bundleCssFile(targetPath, [...stack, filePath]);
    });
}

function extractElementInnerHtmlById(html, id) {
    const escapedId = String(id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startRe = new RegExp(`<([A-Za-z][\\w:-]*)(?=[^>]*\\bid=["']${escapedId}["'])[^>]*>`, 'i');
    const startMatch = startRe.exec(html);
    if (!startMatch) {
        throw new Error(`Unable to find #${id} in bundled Web UI HTML`);
    }
    const tagName = startMatch[1].toLowerCase();
    const openEnd = startMatch.index + startMatch[0].length;
    const tagRe = new RegExp(`</?${tagName}\\b[^>]*>`, 'ig');
    tagRe.lastIndex = openEnd;
    let depth = 1;
    let match = tagRe.exec(html);
    while (match) {
        const rawTag = match[0];
        const isClosing = rawTag.startsWith('</');
        const isSelfClosing = rawTag.endsWith('/>') || VOID_HTML_TAGS.has(tagName);
        if (isClosing) {
            depth -= 1;
        } else if (!isSelfClosing) {
            depth += 1;
        }
        if (depth === 0) {
            return html.slice(openEnd, match.index);
        }
        match = tagRe.exec(html);
    }
    throw new Error(`Unable to find closing </${tagName}> for #${id} in bundled Web UI HTML`);
}

function compileWebUiTemplateToRenderScript(htmlPath = path.join(__dirname, 'index.html')) {
    let compile;
    try {
        ({ compile } = require('@vue/compiler-dom'));
    } catch (e) {
        throw new Error(`Unable to compile Web UI template: @vue/compiler-dom is required (${e.message})`);
    }
    const html = bundleHtmlFile(htmlPath);
    const appTemplate = extractElementInnerHtmlById(html, 'app');
    const result = compile(appTemplate, { mode: 'function', prefixIdentifiers: true });
    return [
        'window.__CODEXMATE_WEB_UI_RENDER__ = (() => {',
        result.code.trimEnd(),
        '})();',
        ''
    ].join('\n');
}

function readPrecompiledWebUiRenderScript(entryPath = PRECOMPILED_RENDER_PATH) {
    const resolvedPath = path.isAbsolute(entryPath)
        ? entryPath
        : path.resolve(__dirname, entryPath);
    try {
        const source = readUtf8Text(resolvedPath).trimEnd();
        return source ? `${source}\n` : '';
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return '';
        }
        throw error;
    }
}

function resolveJavaScriptDependencies(filePath) {
    const source = readUtf8Text(filePath);
    const dependencies = [];
    for (const pattern of [JS_IMPORT_RE, JS_EXPORT_FROM_RE]) {
        let match = pattern.exec(source);
        while (match) {
            const target = normalizeIncludeTarget(match[1]);
            if (target.startsWith('.')) {
                dependencies.push(path.resolve(path.dirname(filePath), target));
            }
            match = pattern.exec(source);
        }
        pattern.lastIndex = 0;
    }
    return dependencies;
}

function bundleJavaScriptFile(filePath, visited = new Set()) {
    if (visited.has(filePath)) {
        return '';
    }
    visited.add(filePath);

    const relativePath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
    const source = readUtf8Text(filePath);
    const chunks = [
        `// ===== FILE: ${relativePath} =====`,
        source.trimEnd(),
        ''
    ];

    for (const dependencyPath of resolveJavaScriptDependencies(filePath)) {
        chunks.push(bundleJavaScriptFile(dependencyPath, visited).trimEnd());
        chunks.push('');
    }

    return chunks.join('\n').trimEnd() + '\n';
}

function collectJavaScriptFiles(filePath, ordered = [], visited = new Set(), stack = []) {
    assertNoCircularDependency(filePath, stack);
    if (visited.has(filePath)) {
        return ordered;
    }
    visited.add(filePath);
    for (const dependencyPath of resolveJavaScriptDependencies(filePath)) {
        collectJavaScriptFiles(dependencyPath, ordered, visited, [...stack, filePath]);
    }
    ordered.push(filePath);
    return ordered;
}

function splitCommaSeparatedSpecifiers(source) {
    const items = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{' || ch === '[' || ch === '(') {
            depth += 1;
        } else if (ch === '}' || ch === ']' || ch === ')') {
            depth = Math.max(0, depth - 1);
        }
        if (ch === ',' && depth === 0) {
            items.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current) {
        items.push(current);
    }
    return items.map(item => item.trim()).filter(Boolean);
}

function buildRelativeImportAliasStatements(importClause, filePath) {
    const clause = String(importClause || '').trim();
    if (!clause) {
        return '';
    }
    if (!clause.startsWith('{') || !clause.endsWith('}')) {
        throw new Error(`Unsupported executable bundle import in ${filePath}: ${clause}`);
    }

    const innerClause = clause.slice(1, -1).trim();
    if (!innerClause) {
        return '';
    }

    const statements = [];
    for (const specifier of splitCommaSeparatedSpecifiers(innerClause)) {
        const parts = specifier.split(/\s+as\s+/);
        const imported = String(parts[0] || '').trim();
        const local = String(parts[1] || imported).trim();
        if (!IDENTIFIER_RE.test(imported) || !IDENTIFIER_RE.test(local)) {
            throw new Error(`Unsupported executable bundle import specifier in ${filePath}: ${specifier}`);
        }
        if (local !== imported) {
            statements.push(`const ${local} = ${imported};`);
        }
    }
    return statements.join('\n');
}

function buildScopedImportStatement(importClause, targetNamespace) {
    const clause = String(importClause || '').trim();
    if (!clause) {
        return `${targetNamespace};`;
    }
    const namespaceRe = /^\*\s+as\s+([A-Za-z_$][\w$]*)\s*$/;
    const namespaceMatch = namespaceRe.exec(clause);
    if (namespaceMatch) {
        return `const ${namespaceMatch[1]} = ${targetNamespace};`;
    }
    const braceIndex = clause.indexOf('{');
    if (braceIndex === -1) {
        const defaultName = clause.trim();
        if (!IDENTIFIER_RE.test(defaultName)) {
            throw new Error(`Unsupported executable bundle default import: ${clause}`);
        }
        return `const ${defaultName} = ${targetNamespace}.default;`;
    }
    const defaultName = braceIndex > 0
        ? clause.slice(0, braceIndex).replace(/,\s*$/, '').trim()
        : '';
    const namedPart = clause.slice(braceIndex).trim();
    const statements = [];
    if (defaultName) {
        statements.push(`const ${defaultName} = ${targetNamespace}.default;`);
    }
    const innerClause = namedPart.slice(1, -1).trim();
    if (innerClause) {
        const destructured = splitCommaSeparatedSpecifiers(innerClause)
            .map((specifier) => {
                const parts = specifier.split(/\s+as\s+/);
                const imported = String(parts[0] || '').trim();
                const local = String(parts[1] || imported).trim();
                if (!IDENTIFIER_RE.test(imported) || !IDENTIFIER_RE.test(local)) {
                    throw new Error(`Unsupported executable bundle import specifier: ${specifier}`);
                }
                return local === imported ? imported : `${imported}: ${local}`;
            })
            .join(', ');
        statements.push(`const { ${destructured} } = ${targetNamespace};`);
    }
    return statements.join('\n');
}

function transformJavaScriptModuleScoped(filePath, namespaceVar, fileToNamespace) {
    let source = readUtf8Text(filePath);
    const exportBindings = [];

    const resolveNamespace = (specifier) => {
        const targetPath = path.resolve(path.dirname(filePath), specifier);
        const targetNamespace = fileToNamespace.get(targetPath);
        if (!targetNamespace) {
            throw new Error(`Unresolved executable bundle dependency in ${filePath}: ${specifier}`);
        }
        return targetNamespace;
    };

    source = source.replace(JS_RELATIVE_IMPORT_STATEMENT_RE, (_match, prefix, indent, importClause, specifier) => {
        const targetNamespace = resolveNamespace(specifier);
        const statement = buildScopedImportStatement(importClause, targetNamespace);
        const indented = statement
            .split('\n')
            .map(line => `${indent || ''}${line}`)
            .join('\n');
        return `${prefix || ''}${indented}\n`;
    });

    source = source.replace(/(^|\n)[ \t]*export\s+\*\s+from\s+['"](\.?[^'"]+)['"]\s*;?[ \t]*/g, (_match, prefix, specifier) => {
        exportBindings.push({ spread: resolveNamespace(specifier) });
        return prefix || '';
    });

    source = source.replace(/(^|\n)[ \t]*export\s+\{([\s\S]*?)\}\s*from\s+['"](\.?[^'"]+)['"]\s*;?[ \t]*/g, (_match, prefix, innerClause, specifier) => {
        const targetNamespace = resolveNamespace(specifier);
        for (const spec of splitCommaSeparatedSpecifiers(innerClause)) {
            const parts = spec.split(/\s+as\s+/);
            const local = String(parts[0] || '').trim();
            const exported = String(parts[1] || local).trim();
            exportBindings.push({ exported, valueRef: `${targetNamespace}.${local}` });
        }
        return prefix || '';
    });

    source = source.replace(/(^|\n)[ \t]*export\s+\{([\s\S]*?)\}\s*;?[ \t]*/g, (_match, prefix, innerClause) => {
        for (const spec of splitCommaSeparatedSpecifiers(innerClause)) {
            const parts = spec.split(/\s+as\s+/);
            const local = String(parts[0] || '').trim();
            const exported = String(parts[1] || local).trim();
            exportBindings.push({ exported, valueRef: local });
        }
        return prefix || '';
    });

    source = source.replace(/(^|\n)[ \t]*export\s+default\s+(?!(?:async\s+function|function|class)\b)([A-Za-z_$][\w$]*)\s*(?:;|(?=[\n\r])|$)/g, (_match, prefix, name) => {
        exportBindings.push({ exported: 'default', valueRef: name });
        return prefix || '';
    });

    source = source.replace(/(^|\n)([ \t]*)export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)\b/g, (_match, prefix, indent, keyword, name) => {
        exportBindings.push({ exported: name, valueRef: name });
        return `${prefix || ''}${indent || ''}${keyword} ${name}`;
    });

    const returnEntries = exportBindings.map((binding) => {
        if (binding.spread) {
            return `...${binding.spread}`;
        }
        return `${binding.exported}: ${binding.valueRef}`;
    });
    const residualExport = /(^|\n)[ \t]*export\b/.exec(source);
    if (residualExport) {
        throw new Error(`Unsupported export syntax left in executable bundle module ${filePath}: ${residualExport[0].trim()}`);
    }

    return [
        `const ${namespaceVar} = (() => {`,
        source.trimEnd(),
        `    return { ${returnEntries.join(', ')} };`,
        '})();'
    ].join('\n');
}

function transformJavaScriptModuleSource(source, options = {}) {
    const preserveExports = !!options.preserveExports;
    const sourcePath = typeof source === 'string' ? source : String(source || '');
    let transformed = readUtf8Text(sourcePath);
    transformed = transformed.replace(JS_RELATIVE_IMPORT_STATEMENT_RE, (_match, prefix, indent, importClause) => {
        const aliases = buildRelativeImportAliasStatements(importClause, sourcePath);
        if (!aliases) {
            return prefix || '';
        }
        const indentedAliases = aliases
            .split('\n')
            .map(line => `${indent || ''}${line}`)
            .join('\n');
        return `${prefix || ''}${indentedAliases}\n`;
    });
    transformed = transformed.replace(/^[ \t]*export\s+\*\s+from\s+['"]\.[^'"]+['"]\s*;?\s*$/gm, '');
    if (!preserveExports) {
        transformed = transformed.replace(/(^|\n)([ \t]*)export\s+(?=(?:async\s+function|const|let|class|function)\b)/g, '$1$2');
    }
    return transformed.trimEnd();
}

function bundleExecutableJavaScriptFile(entryPath, options = {}) {
    const orderedFiles = collectJavaScriptFiles(entryPath);
    const preserveExports = !!options.preserveExports;
    if (preserveExports) {
        const chunks = [];
        for (const filePath of orderedFiles) {
            const transformed = transformJavaScriptModuleSource(filePath, { preserveExports });
            if (!transformed) {
                continue;
            }
            chunks.push(transformed);
        }
        return chunks.join('\n\n').trimEnd() + '\n';
    }

    const fileToNamespace = new Map();
    orderedFiles.forEach((filePath, index) => {
        fileToNamespace.set(filePath, `__bundled_module_${index}__`);
    });
    const chunks = [];
    for (const filePath of orderedFiles) {
        const namespaceVar = fileToNamespace.get(filePath);
        const transformed = transformJavaScriptModuleScoped(filePath, namespaceVar, fileToNamespace);
        if (!transformed) {
            continue;
        }
        chunks.push(transformed);
    }
    return chunks.join('\n\n').trimEnd() + '\n';
}

function readBundledWebUiHtml(entryPath = path.join(__dirname, 'index.html')) {
    return bundleHtmlFile(entryPath).trimEnd() + '\n';
}

function readBundledWebUiCss(entryPath = path.join(__dirname, 'styles.css')) {
    return bundleCssFile(entryPath).trimEnd() + '\n';
}

function readBundledWebUiScript(entryPath = path.join(__dirname, 'app.js')) {
    return bundleJavaScriptFile(entryPath);
}

function readExecutableBundledWebUiScript(entryPath = path.join(__dirname, 'app.js')) {
    const renderScript = readPrecompiledWebUiRenderScript() || compileWebUiTemplateToRenderScript();
    return `${renderScript}\n${bundleExecutableJavaScriptFile(entryPath, { preserveExports: false })}`;
}

function readExecutableBundledJavaScriptModule(entryPath) {
    const resolvedEntryPath = path.isAbsolute(entryPath)
        ? entryPath
        : path.resolve(__dirname, '..', entryPath);
    return bundleExecutableJavaScriptFile(resolvedEntryPath, { preserveExports: true });
}

module.exports = {
    collectJavaScriptFiles,
    compileWebUiTemplateToRenderScript,
    extractElementInnerHtmlById,
    readPrecompiledWebUiRenderScript,
    readUtf8Text,
    readBundledWebUiHtml,
    readBundledWebUiCss,
    readBundledWebUiScript,
    readExecutableBundledWebUiScript,
    readExecutableBundledJavaScriptModule
};
