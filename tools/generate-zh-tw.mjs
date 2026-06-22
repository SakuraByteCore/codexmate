import { readFileSync, writeFileSync } from 'fs';
const OpenCC = (await import('opencc-js')).default;
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });

const src = readFileSync('web-ui/modules/i18n/locales/zh.mjs', 'utf8');

// Taiwan vocab overrides (applied AFTER OpenCC cn→tw conversion)
// Keys must be Traditional forms (post-OpenCC output)
const OVERRIDES = [
  ['服務器', '伺服器'],
  ['設置', '設定'],
  ['默認', '預設'],
  ['當前', '目前'],
  ['加載', '載入'],
  ['導出', '匯出'],
  ['導入', '匯入'],
  ['自定義', '自訂'],
  ['信息', '資訊'],
  ['數據', '資料'],
  ['視頻', '影片'],
  ['内存', '記憶體'],
  ['登錄', '登入'],
  ['注銷', '登出'],
  ['文件夾', '資料夾'],
  ['網絡', '網路'],
  ['打印', '列印'],
  ['鼠標', '滑鼠'],
  ['剪切', '剪下'],
  ['搜索', '搜尋'],
  ['替換', '取代'],
  ['菜單', '選單'],
  ['圖標', '圖示'],
  ['配置', '設定'],
  ['禁用', '停用'],
  ['卸載', '解除安裝'],
  ['发送', '傳送'],
  ['啓用', '啟用'],
  ['啓動', '啟動'],
  ['啓', '啟'],
  ['開啓', '開啟'],
  ['重啓', '重新啟動'],
  ['刷新', '重新整理'],
];

function postProcess(text) {
  let r = text;
  for (const [from, to] of OVERRIDES) {
    r = r.split(from).join(to);
  }
  return r;
}

const converted = postProcess(converter(src));

// Fix export name: const zh → const zhTw
const fixed = converted
  .replace(/^const zh = /m, 'const zhTw = ')
  .replace(/^export \{ zh \};/m, 'export { zhTw };')
  .replace(/^export default zh;/m, 'export default zhTw;');

writeFileSync('web-ui/modules/i18n/locales/zh-tw.mjs', fixed, 'utf8');
console.log('zh-tw.mjs generated, lines:', fixed.split('\n').length);
