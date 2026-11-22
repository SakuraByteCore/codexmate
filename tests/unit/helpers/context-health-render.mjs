import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Vue = require('vue');
const { compile } = require('@vue/compiler-dom');

export function mountContextHealth(template, options) {
    let focused = null;
    const scrolled = [];
    const element = (type, text = '') => ({ type, text, props: {}, style: {}, children: [], parent: null,
        scrollIntoView(value) { scrolled.push({ target: this, value }); },
        focus() { focused = this; }
    });
    function insert(node, parent, anchor = null) {
        if (node.parent) remove(node);
        node.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        if (index < 0) parent.children.push(node); else parent.children.splice(index, 0, node);
    }
    function remove(node) {
        if (!node.parent) return;
        const index = node.parent.children.indexOf(node);
        if (index >= 0) node.parent.children.splice(index, 1);
        node.parent = null;
    }
    const renderer = Vue.createRenderer({
        createElement: (tag) => element(tag), createText: (text) => element('#text', text),
        createComment: (text) => element('#comment', text), insert, remove,
        setText: (node, text) => { node.text = text; },
        setElementText: (node, text) => { node.text = text; node.children = []; },
        parentNode: (node) => node.parent,
        nextSibling: (node) => node.parent?.children[node.parent.children.indexOf(node) + 1] || null,
        patchProp: (node, key, _before, value) => { node.props[key] = value; },
        insertStaticContent: (content, parent, anchor) => {
            const node = element('#static', content); insert(node, parent, anchor); return [node, node];
        }
    });
    const render = new Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true }).code)(Vue);
    const root = element('root');
    const app = renderer.createApp({ ...options, render });
    const vm = app.mount(root);
    function find(predicate) {
        const nodes = [];
        const queue = [root];
        while (queue.length) {
            const node = queue.pop();
            if (predicate(node)) nodes.push(node);
            queue.push(...node.children);
        }
        return nodes;
    }
    return { vm, root, find, scrolled, getFocused: () => focused,
        async flush() { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick(); },
        unmount() { app.unmount(); }
    };
}
