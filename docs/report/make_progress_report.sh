#!/usr/bin/env bash
set -euo pipefail

# Fail fast if not running in a git repository.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run this script from inside a git repository." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Sprint window and report metadata (override with env vars).
START="${START:-2026-02-13 00:00}"
END="${END:-2026-02-27 23:59}"
REPORT_NUM="${REPORT_NUM:-3}"
PROJECT_TITLE="${PROJECT_TITLE:-TODO}"
TEAM_NAME="${TEAM_NAME:-TODO}"
TEAM_MEMBERS="${TEAM_MEMBERS:-TODO}"
OUT_DIR="${OUT_DIR:-docs/report}"

if [[ "$OUT_DIR" = /* ]]; then
  ABS_OUT_DIR="$OUT_DIR"
else
  ABS_OUT_DIR="$REPO_ROOT/$OUT_DIR"
fi
mkdir -p "$ABS_OUT_DIR"

OUT="$ABS_OUT_DIR/Progress_Report_${REPORT_NUM}_Draft.md"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HEAD_SHA="$(git rev-parse --short HEAD)"
GENERATED_AT="$(date '+%Y-%m-%d %H:%M:%S %Z')"

TOTAL_COMMITS="$(git rev-list --count --since="$START" --until="$END" HEAD)"
MERGE_COMMITS="$(git rev-list --count --since="$START" --until="$END" --merges HEAD)"
MERGE_RATE="$(
  awk -v merges="$MERGE_COMMITS" -v total="$TOTAL_COMMITS" 'BEGIN {
    if (total == 0) { printf "0.0" } else { printf "%.1f", (merges * 100.0) / total }
  }'
)"

read -r TOTAL_ADDED TOTAL_REMOVED < <(
  git --no-pager log --since="$START" --until="$END" --pretty=format: --numstat \
  | awk '
      $1 ~ /^[0-9]+$/ && $2 ~ /^[0-9]+$/ { a += $1; d += $2 }
      END { printf "%d %d\n", a + 0, d + 0 }
    '
)
TOTAL_CHURN=$((TOTAL_ADDED + TOTAL_REMOVED))

escape_md_cell() {
  local value="${1//|/\\|}"
  value="${value//$'\n'/ }"
  printf '%s' "$value"
}

emit_change_log_table_rows() {
  local has_rows=0
  while IFS='|' read -r c_date c_author c_subject; do
    [[ -z "$c_date" ]] && continue
    has_rows=1
    local description
    description="$(escape_md_cell "${c_author}: ${c_subject}")"
    printf '| %s | TODO | %s | TODO |\n' "$c_date" "$description"
  done < <(
    git --no-pager log \
      --since="$START" --until="$END" \
      --date=short --reverse \
      --pretty=format:'%ad|%an|%s'
  )

  if [[ "$has_rows" -eq 0 ]]; then
    echo "| TODO | TODO | TODO (No commits found in selected window) | TODO |"
  fi
}

emit_commits_per_author_rows() {
  local has_rows=0
  while IFS= read -r line; do
    [[ -z "${line//[[:space:]]/}" ]] && continue
    has_rows=1
    local count author
    count="$(awk '{print $1}' <<< "$line")"
    author="$(sed -E 's/^[[:space:]]*[0-9]+[[:space:]]+//' <<< "$line")"
    printf '| %s | %s |\n' "$(escape_md_cell "$author")" "$count"
  done < <(git --no-pager shortlog -sn --since="$START" --until="$END")

  if [[ "$has_rows" -eq 0 ]]; then
    echo "| TODO | 0 |"
  fi
}

emit_lines_per_author_rows() {
  local has_rows=0
  while IFS=$'\t' read -r author added removed; do
    [[ -z "$author" ]] && continue
    has_rows=1
    printf '| %s | +%s | -%s |\n' "$(escape_md_cell "$author")" "$added" "$removed"
  done < <(
    git --no-pager log --since="$START" --until="$END" --pretty=format:'@@@%aN' --numstat \
    | awk '
        /^@@@/ { author = substr($0, 4); next }
        $1 ~ /^[0-9]+$/ && $2 ~ /^[0-9]+$/ { add[author] += $1; del[author] += $2 }
        END {
          for (a in add) printf "%s\t%d\t%d\n", a, add[a], del[a]
        }
      ' | sort
  )

  if [[ "$has_rows" -eq 0 ]]; then
    echo "| TODO | +0 | -0 |"
  fi
}

echo "Generating $OUT for range: $START -> $END (branch: $BRANCH, head: $HEAD_SHA)"

{
  echo "# Progress Report ${REPORT_NUM} (Template-Aligned Draft)"
  echo
  echo "**Branch:** \`$BRANCH\`"
  echo
  echo "**Head commit:** \`$HEAD_SHA\`"
  echo
  echo "**Sprint window:** $START -> $END"
  echo
  echo "**Generated at:** $GENERATED_AT"
  echo
  echo "---"
  echo
  echo "## Report Form"
  echo
  echo "- **Project Title:** $PROJECT_TITLE"
  echo "- **Team Name:** $TEAM_NAME"
  echo "- **Team Members:** $TEAM_MEMBERS"
  echo
  echo "---"
  echo
  echo "## 1. Introduction"
  echo
  echo "### Iteration Plan"
  echo "- TODO"
  echo
  echo "### Iteration Accomplishments"
  echo "- TODO"
  echo
  echo "### Significant Changes Since Last Meeting"
  echo
  echo "| Date | Motivation | Description | Ramifications |"
  echo "| :--- | :--- | :--- | :--- |"
  emit_change_log_table_rows
  echo
  echo "---"
  echo
  echo "## 2. Customer Needs"
  echo
  echo "### Customer Needs and Expectations"
  echo "- TODO"
  echo
  echo "### Primary User Use Cases"
  echo "- **Title:** TODO"
  echo "- **User Goal:** TODO"
  echo "- **Basic Flow:** TODO"
  echo
  echo "### Secondary User Use Cases"
  echo "- **Title:** TODO"
  echo "- **User Goal:** TODO"
  echo "- **Basic Flow:** TODO"
  echo
  echo "---"
  echo
  echo "## 3. System Description"
  echo
  echo "### System Overview"
  echo "- TODO"
  echo
  echo "### Main Challenges"
  echo "- TODO"
  echo
  echo "---"
  echo
  echo "## 4. Current Status"
  echo
  echo "### What Is Working"
  echo "- TODO"
  echo
  echo "### Screenshots (To Insert)"
  echo "- TODO"
  echo
  echo "### Current Block Diagram (To Insert)"
  echo "- TODO"
  echo
  echo "### Whole-Project Gantt Chart (To Insert)"
  echo "- TODO"
  echo
  echo "---"
  echo
  echo "## 5. Previous Stage"
  echo
  echo "### What Went Well"
  echo "- TODO"
  echo
  echo "### What Did Not Go Well"
  echo "- TODO"
  echo
  echo "### What Prevented Goals from Being Met"
  echo "- TODO"
  echo
  echo "### Challenges Faced"
  echo "- TODO"
  echo
  echo "### Tests Run or Planned"
  echo "- TODO"
  echo
  echo "### Estimated Lines of Code Written"
  echo "- Repo-derived churn for selected window: **+$TOTAL_ADDED / -$TOTAL_REMOVED** (total touched lines: **$TOTAL_CHURN**)."
  echo "- TODO: confirm how much reflects net new authored code vs refactor/churn."
  echo
  echo "### Auxiliary Systems/Libraries/Utilities Installed"
  echo "- TODO"
  echo
  echo "---"
  echo
  echo "## 6. Next Stage"
  echo
  echo "### Goals for the Coming Iteration"
  echo "- TODO"
  echo
  echo "### Plan to Overcome Current Problems"
  echo "- TODO"
  echo
  echo "### What Will Be Done Differently"
  echo "- TODO"
  echo
  echo "### Specific Tasks and Milestones"
  echo "- TODO"
  echo
  echo "### Estimated Completion Date"
  echo "- TODO"
  echo
  echo "---"
  echo
  echo "## 7. Project Management"
  echo
  echo "### Change Log Up to Meeting Date"
  echo
  echo "| Date | Motivation | Description | Ramifications |"
  echo "| :--- | :--- | :--- | :--- |"
  emit_change_log_table_rows
  echo
  echo "### Goals for Next Iteration"
  echo "- TODO"
  echo
  echo "### Project Management Methodology"
  echo "- TODO (e.g., Agile/Scrum/Kanban/Waterfall)"
  echo
  echo "### Plan for the Rest of the Project"
  echo "- TODO"
  echo
  echo "---"
  echo
  echo "## 8. The Team"
  echo
  echo "### Team Roles"
  echo "- TODO"
  echo
  echo "### Member Contributions So Far"
  echo "- TODO"
  echo
  echo "### Contribution Percentages"
  echo "- TODO"
  echo
  echo "---"
  echo
  echo "## 9. Modern Metrics (Optional but Recommended)"
  echo
  echo "### Commits per Team Member"
  echo "| Team Member | Commits |"
  echo "| :--- | ---: |"
  emit_commits_per_author_rows
  echo
  echo "### Lines Added/Removed per Team Member"
  echo "| Team Member | Added | Removed |"
  echo "| :--- | :---: | :---: |"
  emit_lines_per_author_rows
  echo
  echo "### Branching Strategy and Merge Frequency"
  echo "- Active branch at generation time: \`$BRANCH\`"
  echo "- Total commits in selected window: **$TOTAL_COMMITS**"
  echo "- Merge commits in selected window: **$MERGE_COMMITS**"
  echo "- Merge frequency (merge commits / total commits): **$MERGE_RATE%**"
  echo "- TODO: explain branch policy and whether merge cadence met team goals."
  echo
  echo "### CI/CD Build Status and Test Coverage"
  echo "- TODO (include status/coverage if available)."
} > "$OUT"

echo "Done: $OUT"
echo "Window: $START -> $END | Branch: $BRANCH | Head: $HEAD_SHA"
