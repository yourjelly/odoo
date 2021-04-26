#!/bin/sh

cp -r _husky ../../../.husky
cp  _eslintignore ../../../.eslintignore
cp  _prettierignore ../../../.prettierignore
cp  _eslintrc.json ../../../.eslintrc.json
cp  _prettierrc.json ../../../.prettierrc.json
cp  _package.json ../../../package.json

npm install

echo ""
echo "JS tooling have been added to the root"
echo "Make sure to refresh the eslint service and configure your IDE so it uses the config files"
echo 'For VSCode, look inside your .vscode/settings.json file ("editor.defaultFormatter": "dbaeumer.vscode-eslint")'
echo ""
