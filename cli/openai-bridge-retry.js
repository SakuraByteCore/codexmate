const DEFAULT_BRIDGE_MAX_RETRIES = Infinity;
const BASE_TRANSIENT_RETRY_DELAY_MS = 200;
const MAX_TRANSIENT_RETRY_DELAY_MS = 5000;

function normalizeBridgeMaxRetries(value, fallback = DEFAULT_BRIDGE_MAX_RETRIES) {
    const raw = Number(value);
    const fallbackRaw = Number(fallback);
    if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
    if (Number.isFinite(fallbackRaw) && fallbackRaw >= 0) return Math.floor(fallbackRaw);
    return DEFAULT_BRIDGE_MAX_RETRIES;
}


function isTransientHttpStatus(status) {
    const code = Number(status);
    return code === 408 || code === 409 || code === 425 || code === 429 || code === 500 || code === 502 || code === 503 || code === 504 || code === 520 || code === 521 || code === 522 || code === 523 || code === 524;
}

function isTransientNetworkError(error) {
    const text = String(error || '').trim();
    if (!text) return false;
    if (/socket hang up/i.test(text)) return true;
    if (/ECONNRESET|ECONNREFUSED|EPIPE|EPROTO|ETIMEDOUT/i.test(text)) return true;
    if (/EAI_AGAIN/i.test(text)) return true;
    if (/UND_ERR_SOCKET/i.test(text)) return true;
    if (/disconnected before|secure tls|tls handshake/i.test(text)) return true;
    return false;
}

function getTransientRetryDelayMs(attempt) {
    const index = Math.max(0, Number(attempt) - 1);
    return Math.min(MAX_TRANSIENT_RETRY_DELAY_MS, BASE_TRANSIENT_RETRY_DELAY_MS * Math.pow(3, index));
}

async function retryTransientRequest(executor, options = {}) {
    const maxRetries = normalizeBridgeMaxRetries(options && options.maxRetries);
    let lastResult = null;
    for (let attempt = 0; attempt === 0 || attempt <= maxRetries; attempt += 1) {
        if (attempt > 0) {
            const delay = getTransientRetryDelayMs(attempt);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => {
                const t = setTimeout(r, delay);
                if (typeof t.unref === 'function') t.unref();
            });
        }
        // eslint-disable-next-line no-await-in-loop
        const result = await executor(attempt);
        lastResult = result;
        if (!result) return result;
        if (result.status && result.status > 0) {
            if (!isTransientHttpStatus(result.status)) return result;
            continue;
        }
        if (result.ok) return result;
        if (result.retry) return result;
        if (!isTransientNetworkError(result.error)) return result;
    }
    return lastResult;
}

module.exports = {
    DEFAULT_BRIDGE_MAX_RETRIES,
    normalizeBridgeMaxRetries,
    isTransientNetworkError,
    isTransientHttpStatus,
    getTransientRetryDelayMs,
    retryTransientRequest
};
