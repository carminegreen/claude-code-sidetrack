#!/bin/sh
set -e
usage() { echo "usage: version.sh pr <base-branch> | push <target-ref> <commit>" >&2; exit 2; }
below() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1)" = "$1" ]; }
version_at() { git show "$1:.claude-plugin/plugin.json" | jq -r .version; }
released=$(git tag -l 'v*' --sort=-v:refname | head -n1 | sed 's/^v//')
[ -n "$released" ] || released=0.0.0
case $1 in
  pr)
    [ -n "$2" ] || usage
    commit=HEAD
    head=$(version_at "$commit")
    base=$(version_at "origin/$2")
    [ "$head" = "$base" ] || { echo "version: $2 is at $base; a branch keeps that version, only a release on master changes it" >&2; exit 1; } ;;
  push)
    [ -n "$3" ] || usage
    target=${2#refs/heads/}
    commit=$3
    head=$(version_at "$commit")
    if [ "$target" = master ]; then
      ! below "$head" "$released" || { echo "version: master is at $head, below the released $released" >&2; exit 1; }
    elif git rev-parse -q --verify refs/remotes/origin/master >/dev/null; then
      base=$(version_at origin/master)
      [ "$head" = "$base" ] || { echo "version: master is at $base; $target keeps that version (merge master into it), only a release on master changes it" >&2; exit 1; }
    fi ;;
  *) usage ;;
esac
git show "$commit:README.md" | grep -q "version-$head-blue" || { echo "version: set the README version badge to $head" >&2; exit 1; }
