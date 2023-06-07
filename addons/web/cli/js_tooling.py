import json
import os
import logging
import subprocess
from shutil import copyfile, copytree, rmtree

from odoo.cli import Command
from odoo.modules.module import get_modules, get_module_path, get_resource_path
from odoo.tools import file_open, config

_logger = logging.getLogger(__name__)

try:
    from pre_commit.main import main as pre_commit
except:
    pass

class JSTooling(Command):
    """Generates jsconfig files for javascript code"""
    name = "js-tooling"

    def run(self, cmdargs):
        # import time; time.sleep(5)
        if not pre_commit:
            raise Exception("The JS tooling requires that the python package 'pre-commit' is installed. You can install it with 'pip install pre-commit'")
        # make sure addons-path has been loaded before anything else
        config.parse_config(cmdargs)
        module_paths = {
            module: os.path.dirname(get_module_path(module))
            for module in get_modules()
        }
        addons_paths = set(module_paths.values())
        modules = sorted(module_paths.items())
        self.generate_jsconfigs(addons_paths, modules)

        git_repos = set()
        for path in addons_paths:
            command = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, cwd=path)
            if command.returncode != 0:
                _logger.info("%s is not in a git repo, tooling will not be enabled in this folder")
                continue
            git_repos.add(command.stdout.decode('utf-8').strip())

        git_repos = list(git_repos)
        working_directory = os.getcwd()
        _logger.info("enabling the tooling in the following folders:\n%s", '\n'.join(git_repos))
        for (i, repo) in enumerate(git_repos):
            os.chdir(repo)
            pre_commit(["install", "--config", get_resource_path("web", "tooling/pre-commit-config.yaml")])
            copyfile(get_resource_path("web", "tooling/pre-commit.py"), os.path.join(repo, "pre-commit.py"))
            copyfile(get_resource_path("web", "tooling/_eslintignore"), os.path.join(repo, ".eslintignore"))
            copyfile(get_resource_path("web", "tooling/_eslintrc.json"), os.path.join(repo, ".eslintrc.json"))
            copyfile(get_resource_path("web", "tooling/_package.json"), os.path.join(repo, "package.json"))
            # only run npm install once then copy in subsequent folders because it is slow
            if i == 0:
                _logger.info("installing node modules")
                subprocess.run(["npm", "install"], cwd=repo)
            else:
                copyfile(os.path.join(git_repos[0], "package-lock.json"), os.path.join(repo, "package-lock.json"))
                rmtree(os.path.join(repo, "node_modules"))
                copytree(os.path.join(git_repos[0], "node_modules"), os.path.join(repo, "node_modules"))
        os.chdir(working_directory)

    def generate_jsconfigs(self, addons_paths, modules):
        """Generates one jsconfig.json in each folder that contains a module inside addons-path"""
        for path in addons_paths:
            content = {
                "compilerOptions": {
                    "moduleResolution": "node",
                    "baseUrl": ".",
                    "target": "ES2022",
                    "noEmit": True,
                    "disableSizeLimit": True,
                    "checkJs": True,
                    "paths": {
                        f'@{module_name}/*': [
                            os.path.relpath(
                                os.path.join(module_folder, module_name, "static/src/*"),
                                path
                            )
                        ]
                        for module_name, module_folder in modules
                    }
                },
                "include": [
                    os.path.relpath(os.path.join(addon_path, suffix), path)
                    for addon_path in addons_paths
                    for suffix in ["**/*.js", "**/*.ts"]
                ],
                "exclude": [
                    "node_modules",
                    "**/lib",
                    "addons/spreadsheet/static/src/o_spreadsheet/o_spreadsheet.js"
                ]
            }
            with file_open(os.path.join(path, "jsconfig.json"), "w") as file:
                _logger.info("Creating jsconfig file: %s", os.path.join(path, "jsconfig.json"))
                json.dump(content, file, indent=2)
