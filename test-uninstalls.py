import odoo
import logging


from odoo.tools.misc import topological_sort

DB = 'foobarbaz'
REGISTRY = odoo.registry(DB)
CALLBACKS = ('button_immediate_install', 'button_immediate_uninstall')


def _call_on_mod(mod_id, callback):
    assert callback in CALLBACKS, f"_call_on_mod only accepts {CALLBACKS} as arguments"
    REGISTRY = odoo.registry(DB)
    with odoo.api.Environment.manage():
        with REGISTRY.cursor() as cr:
            env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {})
            mod = env['ir.module.module'].browse(mod_id)
            name = mod.name
            getattr(mod, callback)()
    return name


def _install(mod_id):
    name = _call_on_mod(mod_id, 'button_immediate_install')
    print(f"{name} installed")


def _uninstall(mod_id):
    name = _call_on_mod(mod_id, 'button_immediate_uninstall')
    print(f"{name} uninstalled")


def cycle(mod_id):
    _install(mod_id)
    _uninstall(mod_id)
    _install(mod_id)


with odoo.api.Environment.manage():
    with REGISTRY.cursor() as cr:
        env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {})

        mod_blacklist = {
            'auth_ldap', 'document_ftp', 'base_gengo', 'website_gengo', 'website_instantclick',
            'pad', 'pad_project', 'note_pad', 'pos_cache', 'pos_blackbox_be', 'base',
            'payment_test',
        }

        def filter_mod(mod):
            return not (mod.name in mod_blacklist or mod.name.startswith((
                'hw_', 'theme_', 'l10n_', 'test_')))

        mods = env['ir.module.module'].search([]).filtered(filter_mod)
        sorted_mods = topological_sort({
            mod.id: mod.dependencies_id.mapped('depend_id').ids for mod in mods
        })

for mod in sorted_mods:
    cycle(mod)
