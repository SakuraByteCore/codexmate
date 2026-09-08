export function issueLatestRequestToken(context, key) {
    const token = (Number(context[key]) || 0) + 1;
    context[key] = token;
    return token;
}

export function isLatestRequestToken(context, key, token) {
    return !!context && context[key] === token;
}
