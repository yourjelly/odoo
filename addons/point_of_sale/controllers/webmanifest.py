from odoo.addons.web.controllers.webmanifest import WebManifest as WebWebManifest


class WebManifest(WebWebManifest):

    def _get_sub_app_shortcuts(self, app_id):
        shortcuts = super()._get_sub_app_shortcuts(app_id)
        if app_id == "point_of_sale":
            shortcuts += [{
                'name': "module.display_name",
                'url': '/pos',
                'description': "module.summary",
                'icons': [{
                    'sizes': '100x100',
                    'src': "module.icon",
                    'type': 'image/png'
                }]
            }]
        return shortcuts
