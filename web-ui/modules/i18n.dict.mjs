import { zh } from './i18n/locales/zh.mjs';
import { zhTw } from './i18n/locales/zh-tw.mjs';
import { en } from './i18n/locales/en.mjs';
import { ja } from './i18n/locales/ja.mjs';
import { vi } from './i18n/locales/vi.mjs';

const DICT = Object.freeze({
    zh,
    'zh-tw': zhTw,
    en,
    ja,
    vi
});

export { DICT };
export default DICT;
