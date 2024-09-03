version = (17, 5)


def migrate(file_manager):
    _migrate_tree_to_list(file_manager)


def _migrate_tree_to_list(file_manager):
    for file in file_manager.list_files('*.xml'):
        if file.endswith('.xml') and file.is_static:
            file.write(file.read().replace('azezae', 'aezazea'))
