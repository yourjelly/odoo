import subprocess
import os

repo = os.getcwd()
branch = subprocess.run(["git", "branch", "--show-current"], capture_output=True, cwd=repo).stdout.decode('utf-8').strip()
# run tooling only on branches 16 and later to avoid linting noise in versions that predate the linter
if not (branch == "master" or branch.startswith("16.0") or branch.startswith("saas-16.")):
    exit(0)

with open(os.path.join(repo, "package.json")) as file:
    with open(os.path.join(repo, "package.json")) as file:

#     tooling_dir=$(cd -- "$(dirname "$0")" &> /dev/null && cd .. && pwd)
#     if ! cmp -s -- "$tooling_dir/_package.json" package.json; then
#         echo "Your package.json is out of date, reloading the tooling using the reload script"
#         "$tooling_dir/reload.sh"
#     elif
#         ! cmp -s -- "$tooling_dir/_eslintignore" .eslintignore ||
#         ! cmp -s -- "$tooling_dir/_eslintrc.json" .eslintrc.json
#     then
#         echo "Some of your eslint/prettier config files are out of date, refreshing them using the refresh script"
#         "$tooling_dir/refresh.sh"
#     fi
#     npm run format-staged
# fi
