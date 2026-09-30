/**
 * Prompts-panel change axis: aggregates the line-level diff between the
 * saved original content and the current editor content (or between the
 * rendered diff rows) into clickable tick positions. Pure functions only.
 *
 * The diff engine itself is reused from logic.agents-diff.mjs (LCS for
 * small inputs, window-sync for large ones) so hunk line numbers stay
 * consistent with the red/green preview flow.
 */

import { buildLineDiff } from './logic.agents-diff.mjs';

const AXIS_MAX_TICKS = 200;
const AXIS_MIN_TICK_HEIGHT_PERCENT = 1.2;

function isChangedDiffType(type) {
    return type === 'add' || type === 'del';
}

function clampAxisPercent(value) {
    if (!Number.isFinite(value) || value < 0) return 0;
    if (value > 100) return 100;
    return value;
}

function tickKindForRun(added, removed) {
    if (added && removed) return 'mixed';
    return added ? 'add' : 'del';
}

function buildTickFromRun(run, positioning) {
    const height = clampAxisPercent(Math.max(
        AXIS_MIN_TICK_HEIGHT_PERCENT,
        (Math.max(run.added, run.removed) / Math.max(1, positioning.total)) * 100
    ));
    const top = Math.min(clampAxisPercent((run.anchor / Math.max(1, positioning.total)) * 100), 100 - height);
    return {
        kind: tickKindForRun(run.added, run.removed),
        startLine: run.startLine,
        endLine: run.startLine + Math.max(run.added, run.removed) - 1,
        added: run.added,
        removed: run.removed,
        top,
        height,
        rowIndex: typeof run.rowIndex === 'number' ? run.rowIndex : null
    };
}

function capAxisTicks(runs, positioning) {
    const truncated = runs.length > AXIS_MAX_TICKS;
    const visibleRuns = truncated ? runs.slice(0, AXIS_MAX_TICKS) : runs;
    return {
        ticks: visibleRuns.map((run) => buildTickFromRun(run, positioning)),
        truncated
    };
}

/**
 * Build change-axis ticks for the editor view.
 *
 * @param {string} baseText saved original content
 * @param {string} currentText current editor content
 * @returns {{ ticks: Array<object>, totalLines: number, truncated: boolean,
 *            stats: { added: number, removed: number, unchanged: number } }}
 */
export function buildPromptsChangeAxis(baseText, currentText) {
    const diff = buildLineDiff(baseText, currentText);
    const totalLines = Math.max(1, diff.newLineCount);
    const runs = [];
    let run = null;
    let newCursor = 0;
    const flushRun = () => {
        if (run) {
            runs.push(run);
            run = null;
        }
    };

    for (const line of diff.lines) {
        if (!line || !isChangedDiffType(line.type)) {
            flushRun();
            if (line && line.type === 'context' && typeof line.newNumber === 'number') {
                newCursor = line.newNumber;
            }
            continue;
        }
        if (!run) {
            run = {
                anchor: line.type === 'add' && typeof line.newNumber === 'number'
                    ? line.newNumber - 1
                    : newCursor,
                startLine: line.type === 'add' && typeof line.newNumber === 'number'
                    ? line.newNumber
                    : newCursor + 1,
                added: 0,
                removed: 0
            };
        }
        if (line.type === 'add') {
            run.added += 1;
        } else {
            run.removed += 1;
        }
    }
    flushRun();

    const { ticks, truncated } = capAxisTicks(runs, { total: totalLines });
    return {
        ticks,
        totalLines,
        truncated,
        stats: diff.stats
    };
}

/**
 * Build change-axis ticks for the diff preview view. Tick positions map to
 * rendered row indexes so clicks scroll the diff list to the exact row.
 *
 * @param {Array<object>} diffLines rendered diff rows ({type, value, oldNumber, newNumber})
 * @returns {{ ticks: Array<object>, rowCount: number, truncated: boolean }}
 */
export function buildPromptsDiffAxis(diffLines) {
    const rows = Array.isArray(diffLines) ? diffLines.filter((line) => line && line.type) : [];
    const rowCount = rows.length;
    const runs = [];
    let run = null;
    const flushRun = () => {
        if (run) {
            runs.push(run);
            run = null;
        }
    };

    rows.forEach((line, index) => {
        if (!isChangedDiffType(line.type)) {
            flushRun();
            return;
        }
        if (!run) {
            run = {
                anchor: index,
                rowIndex: index,
                startLine: line.type === 'add' && typeof line.newNumber === 'number'
                    ? line.newNumber
                    : (typeof line.oldNumber === 'number' ? line.oldNumber : index + 1),
                added: 0,
                removed: 0
            };
        }
        if (line.type === 'add') {
            run.added += 1;
        } else {
            run.removed += 1;
        }
    });
    flushRun();

    const { ticks, truncated } = capAxisTicks(runs, { total: Math.max(1, rowCount) });
    return {
        ticks,
        rowCount,
        truncated
    };
}

/**
 * Proportional scroll position for jumping to a line inside the editor
 * textarea. The textarea scrolls internally (min-height contract in
 * prompts-editor.css), so scrollTop maps linearly onto the line space.
 *
 * @param {number} scrollHeight textarea scrollHeight
 * @param {number} clientHeight textarea clientHeight
 * @param {number} lineIndex 1-based target line in the current content
 * @param {number} totalLines total line count of the current content
 * @returns {number} clamped scrollTop value
 */
export function computePromptsAxisScrollTop(scrollHeight, clientHeight, lineIndex, totalLines) {
    const maxScroll = Math.max(0, (Number(scrollHeight) || 0) - (Number(clientHeight) || 0));
    if (maxScroll <= 0) {
        return 0;
    }
    const safeTotal = Math.max(1, Number(totalLines) || 1);
    const safeLine = Math.max(1, Number(lineIndex) || 1);
    const ratio = Math.min(1, Math.max(0, (safeLine - 1) / Math.max(1, safeTotal - 1)));
    return Math.min(maxScroll, Math.round(maxScroll * ratio));
}
