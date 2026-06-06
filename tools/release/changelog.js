#!/usr/bin/env node
const fs = require('fs');
const { execFileSync } = require('child_process');

function parseSemverTag(tag) {
    const raw = String(tag || '').trim();
    const match = raw.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    return {
        tag: raw,
        version: `${match[1]}.${match[2]}.${match[3]}`,
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3])
    };
}

function normalizeReleaseTag(value) {
    const parsed = parseSemverTag(value);
    if (!parsed) return '';
    return `v${parsed.version}`;
}

function compareSemver(a, b) {
    for (const key of ['major', 'minor', 'patch']) {
        if (a[key] !== b[key]) return a[key] - b[key];
    }
    return 0;
}

function selectPreviousSemverTag(tags, currentTag) {
    const current = parseSemverTag(currentTag);
    if (!current) return '';
    return tags
        .map(parseSemverTag)
        .filter(Boolean)
        .filter((candidate) => compareSemver(candidate, current) < 0)
        .sort((a, b) => compareSemver(b, a))[0]?.tag || '';
}

function runGit(args, options = {}) {
    return execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe']
    }).trim();
}

function listGitTags() {
    try {
        const output = runGit(['tag', '--list']);
        return output ? output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function resolveCurrentRef(currentTag) {
    if (!currentTag) return 'HEAD';
    try {
        runGit(['rev-parse', '--verify', '--quiet', `refs/tags/${currentTag}`]);
        return currentTag;
    } catch (_) {
        return 'HEAD';
    }
}

function parseLogLine(line) {
    const [hash, subject, author] = line.split('\u001f');
    if (!hash || !subject) return null;
    const prMatch = subject.match(/\(#(\d+)\)\s*$/) || subject.match(/#(\d+)/);
    return {
        hash,
        subject,
        author: author || '',
        pr: prMatch ? Number(prMatch[1]) : null
    };
}

function readCommits(previousTag, currentRef) {
    const range = previousTag ? `${previousTag}..${currentRef || 'HEAD'}` : (currentRef || 'HEAD');
    const args = ['log', '--first-parent', '--pretty=format:%h%x1f%s%x1f%an', range];
    try {
        const output = runGit(args);
        return output ? output.split(/\r?\n/).map(parseLogLine).filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function groupCommits(commits) {
    return { directCommits: commits };
}

function formatContributorName(author) {
    const value = String(author || '').trim();
    return value || 'Unknown contributor';
}

const CONTRIBUTOR_PROFILES = new Map([
    ['awsl', { login: 'awsl233777', displayName: 'Awsl' }],
    ['awsl233777', { login: 'awsl233777', displayName: 'Awsl' }]
]);

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function contributorProfile(author) {
    const displayName = formatContributorName(author);
    const mapped = CONTRIBUTOR_PROFILES.get(displayName.toLowerCase());
    if (mapped) return mapped;
    return { login: displayName, displayName };
}

function formatContributorCard(author) {
    const { login, displayName } = contributorProfile(author);
    const safeLogin = encodeURIComponent(login);
    const safeDisplayName = escapeHtml(displayName);
    const githubAvatarUrl = `https://github.com/${safeLogin}.png?size=96`;
    const roundedAvatarUrl = `https://wsrv.nl/?url=${encodeURIComponent(githubAvatarUrl)}&w=96&h=96&fit=cover&mask=circle`;
    return [
        `<a href="https://github.com/${safeLogin}" title="${safeDisplayName}">`,
        `  <img src="${roundedAvatarUrl}" width="64" height="64" alt="${safeDisplayName}" />`,
        `</a>`
    ].join('\n');
}

function listContributors(commits) {
    const seen = new Set();
    const contributors = [];
    for (const commit of commits) {
        const contributor = formatContributorName(commit.author);
        const key = contributor.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        contributors.push(contributor);
    }
    return contributors;
}

function compareUrl(repository, previousTag, currentTag, currentRef) {
    if (!repository || !previousTag) return '';
    const right = currentTag || currentRef || 'HEAD';
    return `https://github.com/${repository}/compare/${previousTag}...${right}`;
}

function stripPullRequestSuffix(subject) {
    return String(subject || '').replace(/\s*\(#\d+\)\s*$/, '').trim();
}

function formatChangeSummaryLine(commit) {
    const subject = stripPullRequestSuffix(commit?.subject || '');
    if (!subject) return '';
    if (/^chore:\s*bump version\b/i.test(subject)) return '';

    const conventional = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
    const summary = conventional
        ? `${conventional[2] ? `${conventional[2]}: ` : ''}${conventional[3]}`
        : subject;
    return `- ${summary}${commit.pr ? ` (#${commit.pr})` : ''}`;
}

function formatChangeSummary(commits) {
    const lines = [];
    const seen = new Set();
    for (const commit of commits) {
        const line = formatChangeSummaryLine(commit);
        if (!line) continue;
        const key = line.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(line);
    }
    return lines;
}

function formatChangelog({ repository = '', previousTag = '', currentTag = '', currentRef = 'HEAD', commits = [] }) {
    const lines = [];

    if (!previousTag) {
        lines.push('No previous semver tag was found. Treating this as the initial release.');
        lines.push('');
        lines.push('### Contributors');
        lines.push('- Unknown contributor');
        return `${lines.join('\n')}\n`;
    }

    const { directCommits } = groupCommits(commits);
    if (!commits.length) {
        lines.push('No commits found in this range.');
    } else {
        const changeSummary = formatChangeSummary([...commits].reverse());
        if (changeSummary.length) {
            lines.push('### Changes');
            lines.push(...changeSummary);
            lines.push('');
        }

        if (directCommits.length) {
            lines.push('### Commits without PR');
            for (const commit of directCommits) {
                lines.push(`- ${commit.hash} ${commit.subject}${commit.author ? ` — ${commit.author}` : ''}`);
            }
            lines.push('');
        }
    }

    const url = compareUrl(repository, previousTag, currentTag, currentRef);
    if (url) {
        lines.push(`Compare: ${url}`);
        lines.push('');
    }

    lines.push('### Contributors');
    const contributors = listContributors(commits);
    if (!contributors.length) {
        lines.push('- Unknown contributor');
    } else {
        lines.push(contributors.map(formatContributorCard).join('\n&nbsp;&nbsp;\n'));
    }
    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

function appendIfPath(filePath, content) {
    if (!filePath) return;
    fs.appendFileSync(filePath, `${content}\n`, 'utf8');
}

function writeIfPath(filePath, content) {
    if (!filePath) return;
    fs.writeFileSync(filePath, content, 'utf8');
}

function main(env = process.env) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const currentTag = normalizeReleaseTag(env.RELEASE_TAG || packageJson.version);
    if (!currentTag) {
        console.error(`Unable to resolve a semver release tag from RELEASE_TAG/package.json version.`);
        return 1;
    }

    const tags = listGitTags();
    const previousTag = selectPreviousSemverTag(tags, currentTag);
    const currentRef = resolveCurrentRef(currentTag);
    const commits = previousTag ? readCommits(previousTag, currentRef) : [];
    const changelog = formatChangelog({
        repository: env.GITHUB_REPOSITORY || '',
        previousTag,
        currentTag,
        currentRef,
        commits
    });

    console.log(changelog.trimEnd());
    appendIfPath(env.GITHUB_STEP_SUMMARY, changelog);
    writeIfPath(env.RELEASE_CHANGELOG_FILE || 'release-changelog.md', changelog);
    if (env.GITHUB_ENV) {
        fs.appendFileSync(env.GITHUB_ENV, `RELEASE_CHANGELOG_FILE=${env.RELEASE_CHANGELOG_FILE || 'release-changelog.md'}\n`, 'utf8');
    }
    return 0;
}

module.exports = {
    parseSemverTag,
    normalizeReleaseTag,
    compareSemver,
    selectPreviousSemverTag,
    parseLogLine,
    groupCommits,
    listContributors,
    contributorProfile,
    formatContributorCard,
    stripPullRequestSuffix,
    formatChangeSummaryLine,
    formatChangeSummary,
    compareUrl,
    formatChangelog,
    main
};

if (require.main === module) {
    process.exit(main());
}
