#!/usr/bin/env bash
# The three images a story page needs, from one original — a thin call into scripts/media.sh.
#
#   scripts/story-images.sh <media-id> <source-photo> <slug> [--focus <where>]
#
# Writes img/stories/<slug>/card.jpg, hero-1600.jpg and hero-800.jpg — the story-card and
# story-hero presets — and adds them to the record's renditions. Every rule (the record, consent,
# WhatsApp copies, minimum size, pixels only, --focus) is media.sh's: content/README.md
# §Cutting derivatives.
set -euo pipefail

usage="usage: story-images.sh <media-id> <source-photo> <slug> [--focus <where>]"
[[ $# -eq 3 || ( $# -eq 5 && $4 == --focus ) ]] || { echo "$usage" >&2; exit 1; }
[[ "$3" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "slug must be english kebab-case: $3" >&2; exit 1; }   # it becomes a path

here=$(dirname "$0")
exec "$here/media.sh" "$1" "$2" "$here/../img/stories/$3" story-card story-hero "${@:4}"
