export async function withRequestDeadline(run, options = {}) {
    const { timeoutMs, signal } = options;
    if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs < 0)) {
        throw new TypeError('timeoutMs must be a non-negative finite number');
    }
    if (signal && signal.aborted) throw signal.reason || new Error('请求已取消');
    if (timeoutMs === undefined && !signal) return await run();

    const controller = new AbortController();
    let timer = null;
    let rejectCanceled;
    const canceled = new Promise((_resolve, reject) => { rejectCanceled = reject; });
    const cancel = (reason) => {
        controller.abort(reason);
        rejectCanceled(reason);
    };
    const onAbort = () => cancel(signal.reason || new Error('请求已取消'));
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
        const request = run(controller.signal);
        if (timeoutMs !== undefined) {
            timer = setTimeout(() => {
                const error = new Error('timeout');
                error.name = 'TimeoutError';
                cancel(error);
            }, timeoutMs);
        }
        return await Promise.race([request, canceled]);
    } finally {
        if (timer !== null) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
    }
}
