#!/bin/sh

script="$0"
basename="$(dirname $script)"

cp -r $basename/_husky  $basename/../../../.husky
cp  $basename/_eslintignore  $basename/../../../.eslintignore
cp  $basename/_prettierignore  $basename/../../../.prettierignore
cp  $basename/_eslintrc.json  $basename/../../../.eslintrc.json
cp  $basename/_prettierrc.json  $basename/../../../.prettierrc.json
cp  $basename/_package.json  $basename/../../../package.json

npm install

echo ""
echo "JS tooling have been added to the root"
echo "Make sure to refresh the eslint service and configure your IDE so it uses the config files"
echo 'For VSCode, look inside your .vscode/settings.json file ("editor.defaultFormatter": "dbaeumer.vscode-eslint")'
echo ""
