#!/bin/bash
#
# SessionStart hook (.claude/settings.json) — readies a Claude Code cloud
# session: installs dependencies from the lockfile and fetches the vanilla
# Minecraft assets the Litematica viewer needs.
#
# Runs on every session start and resume, so it always matches the current
# lockfile (the cloud environment's cached setup can be days old). A no-op
# anywhere but the cloud: CLAUDE_CODE_REMOTE is only set to "true" there.
#
# The cloud environment itself should use Trusted network access (npm and
# raw.githubusercontent.com are on its default list), no production secrets,
# and a setup script that pins pnpm — see "Claude Code cloud sessions" in the
# README.

set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "$CLAUDE_PROJECT_DIR"

# Hook stdout becomes session context, so the noisy output goes to stderr and
# only the summary line goes to stdout.
pnpm install --frozen-lockfile >&2
pnpm assets:mc >&2

echo "Cloud session ready: dependencies installed, Minecraft assets in public/litematic/."
