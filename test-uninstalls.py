import odoo


from odoo.tools.misc import topological_sort


def cycle(mod):
    print("Installing %s" % mod.name)
    mod.button_immediate_install()
    print("Uninstalling %s" % mod.name)
    mod.button_immediate_uninstall()
    print("Reinstalling %s" % mod.name)
    mod.button_immediate_install()


db = 'foobarbaz'
reg = odoo.registry(db)

with odoo.api.Environment.manage():
    with reg.cursor() as cr:
        env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {})

        mod_blacklist = {
            'auth_ldap', 'document_ftp', 'base_gengo', 'website_gengo', 'website_instantclick',
            'pad', 'pad_project', 'note_pad', 'pos_cache', 'pos_blackbox_be', 'base',
        }

        def filter_mod(mod):
            return not (mod.name in mod_blacklist or mod.name.startswith(('hw_', 'theme_', 'l10n_', 'test_')))

        testable_mods = env['ir.module.module'].search([]).filtered(filter_mod)
        mod_dict = {mod.name: mod for mod in testable_mods}
        sorted_mods = topological_sort({k: v.dependencies_id.mapped('name') for k, v in mod_dict.items()})
        errs = []

        for mod in sorted_mods:
            try:
                cycle(mod_dict[mod])
            except Exception:
                errs.append(mod)
