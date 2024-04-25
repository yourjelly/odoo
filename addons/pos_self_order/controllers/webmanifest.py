from odoo.http import request
from odoo.addons.web.controllers.webmanifest import WebManifest as WebWebManifest


class WebManifest(WebWebManifest):

    def _get_scoped_app_manifest_icons(self, app_id):
        icons = super()._get_scoped_app_manifest_icons(app_id)
        if app_id == "pos_self_order":
            company = request.env.company
            company_id = request.env.company.id
            if not company.uses_default_logo:
                icon_src = '/web/image?model=res.company&id=%s&field=logo&crop=true&height=%s&width=%s' % (company_id, 192, 192)
            else:
                icon_src = '/point_of_sale/static/description/icon.svg'
            icons = [{
            'src': icon_src,
            'sizes': 'any',
            'type': 'image/png'
            }]
        return icons
