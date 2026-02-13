#!/usr/bin/env bash
set -euo pipefail

# Sprint window (override by setting START / END env vars when running)
START="${START:-2026-02-13 00:00}"
END="${END:-2026-02-26 23:59}"

OUT="report/Progress_Report_2_Draft.md"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HEAD_SHA="$(git rev-parse --short HEAD)"

echo "Generating $OUT for range: $START → $END (branch: $BRANCH, head: $HEAD_SHA)"

{
  echo "# Progress Report 2 (Repo-Accurate Draft)"
  echo
  echo "**Branch:** $BRANCH"
  echo
  echo "**Head commit:** $HEAD_SHA"
  echo
  echo "**Sprint window:** $START → $END"
  echo
  echo "---"
  echo
  echo "## 1. Introduction"
  echo
  echo "- This draft is generated directly from git history to stay accurate to the repository."
  echo "- Fill in 3–5 sentences describing the sprint focus."
  echo
  echo "### Repo-verified accomplishments (commit-backed)"
  echo "- (Write 5–10 bullets by skimming the commit messages below.)"
  echo
  echo "---"
  echo
  echo "## 2. Change Log (git log)"
  echo

  git --no-pager log \
    --since="$START" --until="$END" \
    --date=short --reverse \
    --pretty=format:"- %ad | %an | %s"

  echo
  echo
  echo "---"
  echo
  echo "## 3. Metrics"
  echo
  echo "### 3.1 Commits per author"
  git --no-pager shortlog -sn \
    --since="$START" --until="$END"
  echo
  echo "### 3.2 Lines changed (added/removed) per author"
  git --no-pager log \
    --since="$START" --until="$END" \
    --pretty=format:"%an" --numstat \
  | awk '
    /^[[:alpha:]].*/ { author=$0 }
    /^[0-9]/ { add[author]+=$1; del[author]+=$2 }
    END {
      for (a in add) printf "- %s: +%d / -%d\n", a, add[a], del[a]
    }' \
  | sort
  echo
  echo "### 3.3 Files changed (top 25 by churn)"
  git --no-pager log \
    --since="$START" --until="$END" \
    --numstat --pretty=format: \
  | awk 'NF==3 { churn[$3]+=$1+$2 } END { for (f in churn) printf "%d\t%s\n", churn[f], f }' \
  | sort -nr | head -25 | awk '{printf "- %s (%s)\n", $2, $1 " lines"}'

  echo
  echo "---"
  echo
  echo "## 4. Current Status (Fill-in)"
  echo
  echo "- What works right now (bullet list)."
  echo "- What is partially working / flaky."
  echo "- What is not implemented yet."
  echo
  echo "---"
  echo
  echo "## 5. Risks / Issues Observed (Fill-in)"
  echo
  echo "- Deployment or env friction"
  echo "- OAuth/session/cookie issues"
  echo "- DB schema drift / local dev pain"
  echo
  echo "---"
  echo
  echo "## 6. Next Steps (Fill-in)"
  echo
  echo "- 5–10 bullets with concrete tasks."
  echo
  echo "---"
  echo
  echo "## 7. Team Coordination (Fill-in)"
  echo
  echo "- Meeting notes (1 short paragraph)."
  echo "- How work was split (bullets)."
} > "$OUT"

echo "Done: $OUT"
