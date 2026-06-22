import assert from 'assert';
import { translateUiMessage } from '../../web-ui/modules/app.methods.runtime.mjs';

const zhContext = {
    t(key) {
        const table = {
            'toast.copy.ok': '已复制',
            'toast.operation.success': '操作成功',
            'toast.apply.fail': '应用配置失败',
            'toast.provider.addFail': '添加失败'
        };
        return table[key] || key;
    }
};

test('translateUiMessage uses current toast i18n keys for copied-link prefixes', () => {
    assert.strictEqual(translateUiMessage(zhContext, '已复制链接'), '已复制链接');
    assert.strictEqual(translateUiMessage(zhContext, '已复制路径'), '已复制路径');
});

test('translateUiMessage uses current toast i18n keys for exact messages', () => {
    assert.strictEqual(translateUiMessage(zhContext, '操作成功'), '操作成功');
    assert.strictEqual(translateUiMessage(zhContext, '应用失败'), '应用配置失败');
    assert.strictEqual(translateUiMessage(zhContext, '添加失败'), '添加失败');
});

test('translateUiMessage falls back to the original text when a mapped key is missing', () => {
    assert.strictEqual(translateUiMessage(zhContext, '配置已加载'), '配置已加载');
    assert.strictEqual(translateUiMessage(zhContext, '配置已加载，请刷新'), '配置已加载，请刷新');
});
