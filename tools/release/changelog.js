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
    const prs = [];
    const seenPrs = new Set();
    const directCommits = [];
    for (const commit of commits) {
        if (commit.pr) {
            if (!seenPrs.has(commit.pr)) {
                seenPrs.add(commit.pr);
                prs.push(commit);
            }
        } else {
            directCommits.push(commit);
        }
    }
    return { prs, directCommits };
}

function formatContributorName(author) {
    const value = String(author || '').trim();
    return value || 'Unknown contributor';
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

function formatChangelog({ repository = '', previousTag = '', currentTag = '', currentRef = 'HEAD', commits = [] }) {
    const currentLabel = currentTag || currentRef || 'HEAD';
    const lines = [];
    const releaseName = repository ? repository.split('/').pop() : 'Release';
    lines.push(`## ${releaseName} ${currentLabel}`);
    lines.push('');

    if (!previousTag) {
        lines.push(`### Changes`);
        lines.push('No previous semver tag was found. Treating this as the initial release.');
        lines.push('');
        lines.push('### Contributors');
        lines.push('- Unknown contributor');
        return `${lines.join('\n')}\n`;
    }

    lines.push(`### Changes since ${previousTag}`);
    lines.push('');

    const { prs, directCommits } = groupCommits(commits);
    if (!commits.length) {
        lines.push('No commits found in this range.');
    } else {
        if (prs.length) {
            lines.push('PRs:');
            for (const commit of prs) {
                lines.push(`- #${commit.pr} ${commit.subject.replace(/\s*\(#\d+\)\s*$/, '')} (${commit.hash})`);
            }
            lines.push('');
        }

        if (directCommits.length) {
            lines.push('Commits without PR:');
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
        for (const contributor of contributors) {
            lines.push(`- ${contributor}`);
        }
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
    compareUrl,
    formatChangelog,
    main
};

if (require.main === module) {
    process.exit(main());
}
