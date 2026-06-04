import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    normalizeReleaseTag,
    selectPreviousSemverTag,
    parseLogLine,
    groupCommits,
    compareUrl,
    formatChangelog
} = require('../../tools/release/changelog.js');

test('release changelog selects the previous semver tag below the current release', () => {
    assert.equal(normalizeReleaseTag('0.0.39'), 'v0.0.39');
    assert.equal(normalizeReleaseTag('v0.0.39'), 'v0.0.39');
    assert.equal(
        selectPreviousSemverTag(['v0.0.37', 'v0.0.39', 'v0.0.38', 'not-a-version'], 'v0.0.39'),
        'v0.0.38'
    );
    assert.equal(
        selectPreviousSemverTag(['v0.0.40', 'v0.0.41'], 'v0.0.40'),
        ''
    );
});

test('release changelog groups PR commits and direct commits for action logs', () => {
    const commits = [
        parseLogLine('f5700cf\u001ffix(proxy): bypass responses probe for streaming codex tasks (#180)\u001fawsl233777'),
        parseLogLine('abc1234\u001fchore: update generated assets\u001fawsl233777')
    ];
    const grouped = groupCommits(commits);

    assert.deepStrictEqual(grouped.prs.map((commit) => commit.pr), [180]);
    assert.deepStrictEqual(grouped.directCommits.map((commit) => commit.hash), ['abc1234']);

    const changelog = formatChangelog({
        repository: 'SakuraByteCore/codexmate',
        previousTag: 'v0.0.38',
        currentTag: 'v0.0.39',
        currentRef: 'HEAD',
        commits
    });

    assert.match(changelog, /Release changelog: v0\.0\.38 → v0\.0\.39/);
    assert.match(changelog, /PRs:/);
    assert.match(changelog, /#180 fix\(proxy\): bypass responses probe for streaming codex tasks \(f5700cf\)/);
    assert.match(changelog, /Commits without PR:/);
    assert.match(changelog, /abc1234 chore: update generated assets/);
    assert.match(changelog, /https:\/\/github\.com\/SakuraByteCore\/codexmate\/compare\/v0\.0\.38\.\.\.v0\.0\.39/);
});

test('release changelog reports initial release when no previous tag exists', () => {
    const changelog = formatChangelog({
        repository: 'SakuraByteCore/codexmate',
        previousTag: '',
        currentTag: 'v0.0.1',
        currentRef: 'HEAD',
        commits: []
    });

    assert.match(changelog, /Initial release → v0\.0\.1/);
    assert.match(changelog, /No previous semver tag was found/);
    assert.equal(compareUrl('SakuraByteCore/codexmate', '', 'v0.0.1', 'HEAD'), '');
});
