#!/bin/sh

script="$0"
basename="$(dirname $script)"

rm -rf $basename/../../../.husky
rm -rf $basename/../../../.eslintignore
rm -rf $basename/../../../.prettierignore
rm -rf $basename/../../../.eslintrc.json
rm -rf $basename/../../../.prettierrc.json
rm -rf $basename/../../../package.json
rm -rf $basename/../../../package-lock.json
rm -rf $basename/../../../node_modules

echo ""
echo "JS tooling have been removed from the root"
echo ""
