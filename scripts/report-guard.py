#!/usr/bin/env python3
"""Vet and split an agent-written report before anything publishes it (roadmap item 14).

Run by `agent-report.yml` between the agent and the publish step. Exit 0 and write
`title.txt` + `body.md` = safe to publish; exit 1 = withhold and fail the job.

Parsing lives here rather than in the shell so a title carrying quotes or backticks
cannot escape into a command line.

Why a check and not a redaction: the report jobs read public issue text and, since the
analytics wiring, attacker-influenceable values from GA4 and Search Console. The agent
cannot publish anything itself any more — but it can still read its own environment
(`$VAR` expands inside any allowed command's arguments; `gh --jq` is gojq and implements
`$ENV`), so the one remaining path for a secret is the report file. Quietly redacting
and shipping would hide the attempt; the report is worth less than knowing it happened.

Honest limits: this matches literal values only. Any encoding — base64, reversal,
interleaving — passes it. It makes the naive attempt loud and costs an attacker an extra
step; it is not a boundary. The boundary is that the agent holds no network write.
"""

import os
import sys

REPORT = 'report.md'
TITLE_OUT = 'title.txt'
BODY_OUT = 'body.md'
MAX_TITLE = 120
# GitHub rejects an issue body over 65536 characters. Truncating here keeps the week's
# report — failing at `gh issue create` would lose it entirely, and the API error reads
# like a bug in the publish step rather than a long report.
MAX_BODY = 60000
# Values the agent could have reached. Names only are logged, never values.
WATCHED = ('SCAN_OAUTH', 'SCAN_GH', 'SCAN_GOOGLE')
MIN_LEN = 12  # below this a "secret" is too short to match without false positives


def main() -> int:
    try:
        # utf-8-sig: a BOM on line 1 would otherwise fail the `# Title` check and
        # throw the whole report away.
        with open(REPORT, encoding='utf-8-sig', errors='replace') as fh:
            report = fh.read()
    except OSError as exc:
        print(f'report-guard: cannot read {REPORT}: {exc.strerror}')
        return 1

    hits = []
    for name in WATCHED:
        value = os.environ.get(name, '')
        if len(value) < MIN_LEN:
            continue
        if value in report:
            hits.append(name)
        # A token pasted into markdown may pick up a line break; check the joined form
        # too rather than let simple wrapping defeat the match.
        elif value in ''.join(report.split()):
            hits.append(f'{name} (split across lines)')

    if hits:
        print('report-guard: REFUSING TO PUBLISH — the report contains the value of: '
              + ', '.join(hits))
        print('This is not a formatting problem. Treat it as a compromised run: rotate the '
              'named secret, then read the run log and the agent transcript to find what '
              'instructed it. The report was not published.')
        return 1

    lines = report.split('\n')
    # Skip leading blank lines: a stray newline before the title should not cost the
    # whole report.
    while lines and not lines[0].strip():
        lines.pop(0)
    first = lines[0].strip() if lines else ''
    if not first.startswith('#'):
        print(f'report-guard: {REPORT} must start with a `# Title` line; got: {first[:60]!r}')
        return 1
    title = first.lstrip('#').strip()
    # The title becomes an issue title and is matched literally against existing ones.
    # Control characters and newlines cannot appear in one; a runaway title is a bug.
    if not title or len(title) > MAX_TITLE or any(ord(c) < 32 for c in title):
        print(f'report-guard: unusable title ({len(title)} chars) — nothing published.')
        return 1

    with open(TITLE_OUT, 'w', encoding='utf-8') as fh:
        fh.write(title)
    body = '\n'.join(lines[1:]).strip()
    truncated = len(body) > MAX_BODY
    if truncated:
        body = body[:MAX_BODY].rstrip() + (
            f'\n\n---\n*[truncated at {MAX_BODY} characters — GitHub caps an issue body at '
            '65,536. The full report is in the workflow run log.]*')
    with open(BODY_OUT, 'w', encoding='utf-8') as fh:
        fh.write(body + '\n')

    print(f'report-guard: clean; title {title!r}'
          + (f'; body TRUNCATED from {len(chr(10).join(lines[1:]).strip())} chars' if truncated else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
