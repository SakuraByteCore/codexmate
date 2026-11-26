'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OPENAI_CHAT_TARGET = 'openai-chat';
const TARGETS = new Set(['codex', 'claude', OPENAI_CHAT_TARGET]);
const STRATEGIES = new Set(['order', 'rotate']);
const MAX_GROUPS = 64;
const MAX_MEMBERS = 16;
const MAX_NAME_LENGTH = 128;
const MAX_MODEL_LENGTH = 256;
const VERSION = 1;
const MAX_STORAGE_BYTES = 2 * 1024 * 1024;

function routeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}
function revisionOf(source) {
    return crypto.createHash('sha256').update(source).digest('hex');
}
function validText(value, limit) {
    return typeof value === 'string' && value.trim() && value.trim().length <= limit;
}
function validateGroup(group) {
    if (!group || !validText(group.name, MAX_NAME_LENGTH) || !TARGETS.has(group.target) || !STRATEGIES.has(group.strategy)) {
        throw routeError('routing-invalid', '路由组名称、目标或策略无效');
    }
    if (!Array.isArray(group.members) || !group.members.length || group.members.length > MAX_MEMBERS) {
        throw routeError('routing-invalid', '每组需要 1–16 个成员');
    }
    const seen = new Set();
    const members = group.members.map(member => {
        if (!member || !validText(member.provider, MAX_NAME_LENGTH) || !validText(member.model, MAX_MODEL_LENGTH)) {
            throw routeError('routing-invalid', '成员必须指定供应商与模型');
        }
        const normalized = { provider: member.provider.trim(), model: member.model.trim() };
        const key = JSON.stringify(normalized);
        if (seen.has(key)) throw routeError('routing-invalid', '成员不能重复');
        seen.add(key);
        return normalized;
    });
    return { id: group.id, name: group.name.trim(), target: group.target, strategy: group.strategy, members };
}

function createRoutingGroups({ filePath, assertAllowed, catalog }) {
    function read() {
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_STORAGE_BYTES) throw routeError('routing-corrupt', '路由组文件超过 2 MiB');
        const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
        const state = source ? JSON.parse(source) : { version: VERSION, groups: [], bindings: { codex: '', claude: '' } };
        if (!state || state.version !== VERSION || !Array.isArray(state.groups) || !state.bindings || state.groups.length > MAX_GROUPS) {
            throw routeError('routing-corrupt', '路由组文件格式无效');
        }
        if (state.bindings[OPENAI_CHAT_TARGET] === undefined) state.bindings[OPENAI_CHAT_TARGET] = '';
        const ids = new Set();
        state.groups = state.groups.map(group => {
            if (!validText(group.id, MAX_NAME_LENGTH) || ids.has(group.id)) throw routeError('routing-corrupt', '路由组标识无效');
            ids.add(group.id);
            return validateGroup(group);
        });
        for (const target of TARGETS) {
            const id = state.bindings[target];
            if (typeof id !== 'string' || (id && !state.groups.some(group => group.id === id && group.target === target))) {
                throw routeError('routing-corrupt', '路由绑定无效');
            }
        }
        return { version: VERSION, groups: state.groups, bindings: Object.fromEntries([...TARGETS].map(target => [target, state.bindings[target]])), revision: revisionOf(source) };
    }
    function write(state, expectedRevision) {
        if (read().revision !== expectedRevision) throw routeError('routing-conflict', '路由组已被修改，请刷新后重试');
        const source = JSON.stringify({ version: VERSION, groups: state.groups, bindings: state.bindings }, null, 2) + '\n';
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const temporary = filePath + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
        try {
            fs.writeFileSync(temporary, source, { mode: 0o600, flag: 'wx' });
            fs.renameSync(temporary, filePath);
        } finally {
            if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        }
        return { ...state, revision: revisionOf(source) };
    }
    function checkRevision(state, revision) {
        if (revision !== state.revision) throw routeError('routing-conflict', '路由组已被修改，请刷新后重试');
    }
    function checkMembers(group) {
        const names = new Set(catalog(group.target).map(entry => entry.name));
        if (group.members.some(member => !names.has(member.provider))) {
            throw routeError('routing-provider-missing', '成员供应商不存在或已排除');
        }
    }
    function save(params) {
        const state = read();
        checkRevision(state, params.revision);
        const previous = params.id ? state.groups.find(group => group.id === params.id) : null;
        if (params.id && !previous) throw routeError('routing-not-found', '路由组不存在');
        const group = validateGroup({ ...params, id: previous ? previous.id : crypto.randomBytes(12).toString('hex') });
        if (previous && previous.target !== group.target) throw routeError('routing-invalid', '已有路由组不能更换目标工具');
        assertAllowed(group.target);
        checkMembers(group);
        if (state.groups.some(item => item.id !== group.id && item.target === group.target && item.name === group.name)) {
            throw routeError('routing-invalid', '同一工具的路由组名称不能重复');
        }
        if (!previous && state.groups.length >= MAX_GROUPS) throw routeError('routing-invalid', '最多保存 64 个路由组');
        state.groups = previous ? state.groups.map(item => item.id === group.id ? group : item) : [...state.groups, group];
        return write(state, params.revision);
    }
    function remove(params) {
        const state = read();
        checkRevision(state, params.revision);
        const group = state.groups.find(item => item.id === params.id);
        if (!group) throw routeError('routing-not-found', '路由组不存在');
        assertAllowed(group.target);
        if (state.bindings[group.target] === group.id) throw routeError('routing-in-use', '请先解除绑定再删除路由组');
        state.groups = state.groups.filter(item => item.id !== group.id);
        return write(state, params.revision);
    }
    function bind(params) {
        const state = read();
        checkRevision(state, params.revision);
        if (!TARGETS.has(params.target) || typeof params.id !== 'string') throw routeError('routing-invalid', '路由绑定参数无效');
        assertAllowed(params.target);
        if (params.id) {
            const group = state.groups.find(item => item.id === params.id && item.target === params.target);
            if (!group) throw routeError('routing-not-found', '路由组不存在或工具不匹配');
            checkMembers(group);
        }
        state.bindings[params.target] = params.id;
        return write(state, params.revision);
    }
    function resolve(target) {
        const state = read();
        const id = state.bindings[target];
        if (!id) return null;
        const group = state.groups.find(item => item.id === id && item.target === target);
        const entries = catalog(target);
        const members = group.members.map(member => {
            const entry = entries.find(item => item.name === member.provider);
            return entry ? { ...entry, model: member.model } : null;
        }).filter(Boolean);
        if (!members.length) throw routeError('routing-no-upstream', '绑定路由组没有可用成员，请检查供应商与排除设置');
        return { ...group, members };
    }
    return { read, save, remove, bind, resolve };
}

function createRoutingScheduler() {
    const positions = new Map();
    return group => {
        if (group.strategy === 'order') return group.members;
        const signature = JSON.stringify([group.strategy, group.members.map(member => [member.name, member.model])]);
        const previous = positions.get(group.id);
        const index = previous && previous.signature === signature ? previous.index % group.members.length : 0;
        positions.delete(group.id);
        positions.set(group.id, { signature, index: index + 1 });
        while (positions.size > MAX_GROUPS) positions.delete(positions.keys().next().value);
        return [...group.members.slice(index), ...group.members.slice(0, index)];
    };
}
module.exports = { createRoutingGroups, createRoutingScheduler, OPENAI_CHAT_TARGET };
