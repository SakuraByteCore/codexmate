import { authorizationHeaders, withAccessToken } from '../../web-ui/modules/access-token.mjs';

const FILE_SHARING_ROUTE = '/api/file-sharing';
const MAX_SHARE_MANIFEST_BYTES = 512 * 1024;
const FILE_SHARING_ERRORS = new Set(['emptyFolder', 'invalid', 'busy', 'notFound', 'lanUnavailable', 'failed']);

async function requestFileSharing(suffix = '', options = {}) {
    const response = await fetch(FILE_SHARING_ROUTE + suffix, {
        ...options,
        headers: authorizationHeaders(options.headers),
        cache: 'no-store'
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(FILE_SHARING_ERRORS.has(payload.error) ? payload.error : 'failed');
    return payload;
}

function fileSharingMessage(t, error) {
    return t(`plugins.fileSharing.${FILE_SHARING_ERRORS.has(error.message) ? error.message : 'failed'}`);
}

export function createFileSharingMethods() {
    return {
        async refreshFileSharing() {
            return this.runFileSharingAction(async () => {
                this.fileSharingBatches = (await requestFileSharing()).batches;
            });
        },
        selectFileSharingItems(event, isFolder) {
            const input = event.target;
            const files = Array.from(input.files || []);
            input.value = '';
            if (this.fileSharingBusy) return;
            this.fileSharingError = '';
            if (!files.length) {
                if (isFolder) this.fileSharingError = this.t('plugins.fileSharing.emptyFolder');
                return;
            }
            const entries = files.map(file => ({ name: isFolder ? file.webkitRelativePath : file.name, size: file.size }));
            const folder = isFolder ? entries[0].name.split('/')[0] : '';
            const bytes = new TextEncoder().encode(JSON.stringify({ folder, files: entries }));
            if (bytes.length > MAX_SHARE_MANIFEST_BYTES) {
                this.fileSharingError = this.t('plugins.fileSharing.invalid');
                return;
            }
            const prefix = new ArrayBuffer(4);
            new DataView(prefix).setUint32(0, bytes.length);
            this.fileSharingPending = { entries, body: new Blob([prefix, bytes, ...files]) };
        },
        async runFileSharingAction(action) {
            if (this.fileSharingBusy) return false;
            this.fileSharingBusy = true;
            this.fileSharingError = '';
            try {
                await action();
                return true;
            } catch (error) {
                this.fileSharingError = fileSharingMessage(this.t, error);
                return false;
            } finally {
                this.fileSharingBusy = false;
            }
        },
        async uploadFileSharingItems() {
            if (!this.fileSharingPending) return;
            await this.runFileSharingAction(async () => {
                const { batch } = await requestFileSharing('', {
                    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: this.fileSharingPending.body
                });
                this.fileSharingPending = null;
                this.fileSharingBatches.push(batch);
            });
        },
        async removeFileSharingBatch(id) {
            await this.runFileSharingAction(async () => {
                await requestFileSharing(`/${id}`, { method: 'DELETE' });
                this.fileSharingBatches = this.fileSharingBatches.filter(batch => batch.id !== id);
            });
        },
        async copyFileSharingLink(id, index) {
            await this.runFileSharingAction(async () => {
                const { url } = await requestFileSharing(`/${id}/${index}/link`, { method: 'POST' });
                let copied = false;
                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(url);
                        copied = true;
                    }
                } catch (_) { /* HTTP and restricted contexts use the fallback. */ }
                if (copied || this.fallbackCopyText(url)) {
                    this.showMessage(this.t('toast.copy.ok'), 'success');
                } else {
                    window.prompt(this.t('plugins.fileSharing.copyManually'), url);
                }
            });
        },
        fileSharingDownloadUrl(id, index) {
            return withAccessToken(`${FILE_SHARING_ROUTE}/${id}/${index}`);
        }
    };
}
