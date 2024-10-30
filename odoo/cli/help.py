from .command import Command


class Help(Command):
    """ Display the list of available commands """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.text = (
            "Odoo CLI, use '{odoo_bin} --help' for regular server options.\n"
            "\n"
            "Available commands:\n"
            "    {command_list}\n"
            "\n"
            "Use '{odoo_bin} <command> --help' for individual command help.\n"
        )

    def run(self, args):
        self.load_internal_commands()
        self.load_addons_commands()
        padding = max(len(cmd) for cmd in self.all_commands) + 2
        command_list = "\n    ".join([
            f"{name:<{padding}}{command.description().strip()}"
            for name in sorted(self.all_commands)
            if (command := self.find_command(name))
        ])
        print(self.text.format(  # pylint: disable=bad-builtin  # noqa: T201
            odoo_bin=self.prog_name(),
            command_list=command_list
        ))
