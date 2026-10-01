/**
 * Prompts-panel change axis: aggregates the rendered diff rows into
 * clickable tick positions for the red/green diff preview view.
 * Pure functions only.
 */

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

