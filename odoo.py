###################
#  This is a PoC  #
###################

import argparse


# TODO: Add metavars, specify types, destination, defaults per section, etc.
def main():
    # ------------- #
    #  Main parser  #
    # ------------- #
    main_parser = argparse.ArgumentParser(prog='odoo', description='Odoo CLI')
    # ----------------- #
    #  Logging options  #
    # ----------------- #
    main_parser.add_argument(
        '--logfile', '-lf', nargs=1,
        help="path where the log file should be saved"
    )
    main_parser.add_argument(
        '--syslog', '-sl', action='store_true',
        help="save odoo logs as system logs"
    )
    main_parser.add_argument(
        '--log-level', '-L', help="which type of logs to display to stdin"
    )
    # ---------------- #
    #  Common options  #
    # ---------------- #
    main_parser.add_argument(
        '--addons-path', '-ap', nargs='+',
        help="space-separated list of paths to check for addons"
    )
    main_parser.add_argument(
        '--data-dir', '-dd', nargs=1,
        help="path to a directory where odoo-generated files should be stored"
    )
    # ------------ #
    #  Subparsers  #
    # ------------ #
    top_level_subparsers = main_parser.add_subparsers(help='sub-command help')
    dbname_parser = argparse.ArgumentParser(add_help=False)
    dbname_parser.add_argument(
        'dbname', nargs=1, help="name of the database"
    )
    # ------------- #
    #  DB creation  #
    # ------------- #
    create_parser = top_level_subparsers.add_parser(
        'create',
        help="create odoo databases",
        parents=[dbname_parser]
    )
    create_parser.add_argument(
        '--demo', '-d', action='store_true',
        help="if specified demo data will be installed in the database"
    )
    create_parser.add_argument(
        '--launch', '-l', action='store_true',
        help="if specified, the db will be launched after db creation"
    )
    # ---------------- #
    #  DB duplication  #
    # ---------------- #
    dupe_parser = top_level_subparsers.add_parser(
        'duplicate',
        help="duplicate odoo databases",
    )
    dupe_parser.add_argument(
        'db_src', nargs=1, help="name of the source database"
    )
    dupe_parser.add_argument(
        'db_dest', nargs=1, help="name of the destination database"
    )
    # --------- #
    #  DB dump  #
    # --------- #
    dump_parser = top_level_subparsers.add_parser(
        'dump',
        help="dump odoo databases",
        parents=[dbname_parser]
    )
    dump_parser.add_argument(
        'filepath', nargs=1, help="path where the dump should be stored"
    )
    dump_parser.add_argument(
        '--format', '-f', choices=['gzip', 'raw', 'sql'],
        help="one of three available formats for the dump file"
    )
    # ------------ #
    #  DB restore  #
    # ------------ #
    restore_parser = top_level_subparsers.add_parser(
        'restore',
        help="restore odoo databases",
        parents=[dbname_parser]
    )
    restore_parser.add_argument(
        'filepath', nargs=1, help="path of the dump to restore"
    )
    restore_parser.add_argument(
        '--dbuuid', nargs=1, help="dbuuid of the db to restore"
    )
    # -------------- #
    #  Cron Process  #
    # -------------- #
    cron_parser = top_level_subparsers.add_parser(
        'cron',
        help="launch a cron thread for managing all databases' cron jobs"
    )
    cron_parser.add_argument(
        '--workers', '-w', nargs=1,
        help="amount of workers to assign to this cron thread"
    )
    cron_parser.add_argument(
        '--pid', '-p', nargs=1, help="pid for the cron thread"
    )
    cron_parser.add_argument(
        '--limits', '-l', help="???"
    )
    # ------------ #
    #  Migrations  #
    # ------------ #
    migration_parser = top_level_subparsers.add_parser(
        'migrate',
        help="migrate the specified odoo database",
        parents=[dbname_parser]
    )
    migration_parser.add_argument(
        'spath', nargs=1,
        help="path to the migration scripts for the specified database"
    )
    # ----------------- #
    #  Shell Interface  #
    # ----------------- #
    shell_parser = top_level_subparsers.add_parser(
        'shell',
        help="activate the shell interface for the specified database",
        parents=[dbname_parser]
    )
    shell_parser.add_argument(
        '--repl', '-r', choices=['python', 'ipython', 'ptpython'],
        help="the repl to be used for the shell session"
    )
    # --------- #
    #  Imports  #
    # --------- #
    import_parser = top_level_subparsers.add_parser(
        'import',
        help="import csv data into odoo",
        parents=[dbname_parser]
    )
    import_parser.add_argument(
        'filepath', nargs=1,
        help="path to the csv file to import into the odoo database"
    )
    import_parser.add_argument(
        '--import-partial', '-p', action='store_true',
        help="import in small batches instead of one big batch"
    )
    # --------------------- #
    #  Module installation  #
    # --------------------- #
    install_parser = top_level_subparsers.add_parser(
        'install',
        help="install odoo modules",
        parents=[dbname_parser]
    )
    install_parser.add_argument(
        'modules', nargs='+',
        help="space-separated list of modules to be installed"
    )
    # ---------------- #
    #  Module updates  #
    # ---------------- #
    update_parser = top_level_subparsers.add_parser(
        'update',
        help="update odoo modules",
        parents=[dbname_parser]
    )
    update_parser.add_argument(
        'modules', nargs='+',
        help="space-separated list of modules to be updated"
    )
    # --------------------------- #
    #  Standalone test execution  #
    # --------------------------- #
    test_parser = top_level_subparsers.add_parser(
        'test', help="execute specific unit/integration tests"
    )
    test_parser.add_argument(
        'tag', nargs='*', help="only run tests with the specified tags"
    )
    test_parser.add_argument(
        '-pp', '--pretty-print', action='store_true',
        help="print the test results in a pretty format"
    )
    test_parser.add_argument(
        '-e', '--exclude', nargs='+',
        help="exclude tests with these tags when running the tests suite"
    )
    test_parser.add_argument(
        '-ff', '--fail-fast', action='store_true',
        help="terminate the test execution upon first failure"
    )
    test_parser.add_argument(
        '-s', '--save', nargs='*',
        help="save the test results to the specified file or current directory"
    )
    # -------------- #
    #  Translations  #
    # -------------- #
    translation_parser = top_level_subparsers.add_parser(
        'translate', help="tools for handling translations in odoo",
        parents=[dbname_parser]
    )
    translation_subparsers = translation_parser.add_subparsers(
        help='translation toolset help'
    )
    # Load subcommand
    t_load_parser = translation_subparsers.add_parser(
        'load', help="load a translation into the specified database"
    )
    t_load_parser.add_argument(
        'language', nargs=1, help="language to be loaded"
    )
    # Import subcommand
    t_import_parser = translation_subparsers.add_parser(
        'import', help="import translations"
    )
    t_import_parser.add_argument(
        'language', nargs=1,
        help="language for which translations will be imported"
    )
    t_import_parser.add_argument(
        'infile', nargs=1,
        help="path to the PO/CSV file containing the translations"
    )
    t_import_parser.add_argument(
        '-o', '--overwrite', action='store_true',
        help="if specified, translations in the database will be overwritten"
        "for those found in the input file"
    )
    # Export subcommand
    t_export_parser = translation_subparsers.add_parser(
        'export', help="export translations"
    )
    t_export_parser.add_argument(
        'language', nargs=1,
        help="language for which translations will be exported"
    )
    t_export_parser.add_argument(
        'outfile', nargs=1,
        help="path to where the exported records will be stored"
    )
    t_export_parser.add_argument(
        '-t', '--template', help="???"
    )

    # Parse them args
    main_parser.parse_args()


if __name__ == '__main__':
    main()
