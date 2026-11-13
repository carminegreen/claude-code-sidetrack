#!/bin/sh
set -e
rule=$(cd "$(dirname "$0")" && pwd)/version.sh
unset $(git rev-parse --local-env-vars)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"
git init -q -b master .
[ "$(git rev-parse --absolute-git-dir)" = "$(pwd -P)/.git" ] || { echo "version-test: not in its own scratch repo" >&2; exit 1; }
g() { git -c user.email=t@t -c user.name=t -c commit.gpgsign=false -c tag.gpgsign=false "$@"; }
mkdir .claude-plugin
at() {
  printf '{"version": "%s"}\n' "$1" > .claude-plugin/plugin.json
  printf 'version-%s-blue\n' "$1" > README.md
  g add -A && g commit -qm "$1" && git rev-parse HEAD
}
remote() { git update-ref "refs/remotes/origin/$1" "$2"; }
fails=0
expect() {
  want=$1; shift
  if sh "$rule" "$@" >/dev/null 2>&1; then got=pass; else got=fail; fi
  [ "$got" = "$want" ] || { echo "version-test: $* gave $got, wanted $want" >&2; fails=1; }
}
v070=$(at 0.7.0); g tag v0.7.0
remote master "$v070"
expect pass push refs/heads/master "$v070"
expect pass push refs/heads/fix/a "$v070"
git checkout -q "$v070"
expect pass pr master
v071=$(at 0.7.1)
expect fail push refs/heads/fix/a "$v071"
expect fail pr master
expect pass push refs/heads/master "$v071"
g tag v0.7.1
remote master "$v071"
expect fail push refs/heads/feat/b "$v070"
expect pass push refs/heads/feat/b "$v071"
expect pass pr master
v069=$(at 0.6.9)
expect fail push refs/heads/master "$v069"
printf '{"version": "0.7.1"}\n' > .claude-plugin/plugin.json
printf 'version-0.7.0-blue\n' > README.md
g add -A && g commit -qm badge
expect fail push refs/heads/master "$(git rev-parse HEAD)"
expect fail pr master
exit "$fails"

