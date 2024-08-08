
from odoo import http
from odoo.tests import HttpCase

class TourDebuggerController(HttpCase, http.Controller):
    @http.route('/restart_tour', type='http', methods=['GET'], auth='public')
    def restart_tour(self):
        print(self)

        # theme_custo = self.env.ref('base.module_theme_test_custo')
        # website = self.env['website'].browse(1)
        # website.theme_id = theme_custo.id
        # theme_custo.with_context(load_all_views=True, apply_new_theme=True)._theme_load(website)
        # self.start_tour('/@/example', "theme_menu_hierarchies", login='admin')
