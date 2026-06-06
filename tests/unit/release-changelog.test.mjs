import assert from 'assert';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    normalizeReleaseTag,
    selectPreviousSemverTag,
    parseLogLine,
    groupCommits,
    listContributors,
    contributorProfile,
    formatContributorCard,
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
    assert.deepStrictEqual(listContributors(commits), ['awsl233777']);

    const changelog = formatChangelog({
        repository: 'SakuraByteCore/codexmate',
        previousTag: 'v0.0.38',
        currentTag: 'v0.0.39',
        currentRef: 'HEAD',
        commits
    });

    assert.doesNotMatch(changelog, /## codexmate v0\.0\.39/);
    assert.doesNotMatch(changelog, /Changes since v0\.0\.38/);
    assert.match(changelog, /### PRs/);
    assert.match(changelog, /#180 fix\(proxy\): bypass responses probe for streaming codex tasks \(f5700cf\)/);
    assert.match(changelog, /### Commits without PR/);
    assert.match(changelog, /abc1234 chore: update generated assets/);
    assert.match(changelog, /https:\/\/github\.com\/SakuraByteCore\/codexmate\/compare\/v0\.0\.38\.\.\.v0\.0\.39/);
    assert.match(changelog, /### Contributors\n<a href="https:\/\/github\.com\/awsl233777" title="Awsl">/);
    assert.match(changelog, /<img src="https:\/\/github\.com\/awsl233777\.png\?size=96" width="64" height="64" alt="Awsl" \/>/);
    assert.doesNotMatch(changelog, /<sub><b>Awsl<\/b><\/sub>/);
    assert.ok(changelog.trimEnd().endsWith('</a>'));
});

test('release changelog maps contributor display names to GitHub avatar cards', () => {
    assert.deepStrictEqual(contributorProfile('Awsl'), { login: 'awsl233777', displayName: 'Awsl' });
    assert.deepStrictEqual(contributorProfile('ymkiux'), { login: 'ymkiux', displayName: 'ymkiux' });

    const card = formatContributorCard('ymkiux');
    assert.match(card, /href="https:\/\/github\.com\/ymkiux"/);
    assert.match(card, /src="https:\/\/github\.com\/ymkiux\.png\?size=96"/);
    assert.doesNotMatch(card, /<sub><b>ymkiux<\/b><\/sub>/);
});

test('release changelog reports initial release when no previous tag exists', () => {
    const changelog = formatChangelog({
        repository: 'SakuraByteCore/codexmate',
        previousTag: '',
        currentTag: 'v0.0.1',
        currentRef: 'HEAD',
        commits: []
    });

    assert.doesNotMatch(changelog, /## codexmate v0\.0\.1/);
    assert.match(changelog, /No previous semver tag was found/);
    assert.match(changelog, /### Contributors\n- Unknown contributor/);
    assert.equal(compareUrl('SakuraByteCore/codexmate', '', 'v0.0.1', 'HEAD'), '');
});

test('release workflow uses generated changelog as release body', () => {
    const workflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');

    assert.match(workflow, /RELEASE_CHANGELOG_FILE:\s*release-changelog\.md/);
    assert.match(workflow, /node tools\/release\/changelog\.js/);
    assert.match(workflow, /test -s "\$\{RELEASE_CHANGELOG_FILE\}"/);
    assert.match(workflow, /body_path:\s*\$\{\{ env\.RELEASE_CHANGELOG_FILE \}\}/);
    assert.match(workflow, /generate_release_notes:\s*false/);
    assert.doesNotMatch(workflow, /generate_release_notes:\s*true/);
});
