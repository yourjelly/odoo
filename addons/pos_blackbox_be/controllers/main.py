# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os

from openerp import http
from openerp.http import request

class GovCertificationController(http.Controller):
    @http.route('/fdm_source', auth='public')
    def handler(self):
        data = {'files': []}
        relative_file_paths_to_show = [
            "data/pos_blackbox_be_data.xml",
            "models/pos_blackbox_be.py",
            "security/ir.model.access.csv",
            "security/pos_blackbox_be_security.xml",
            "static/lib/sha1.js",
            "static/src/css/pos_blackbox_be.css",
            "static/src/js/pos_blackbox_be.js",
            "static/src/xml/pos_blackbox_be.xml",
            "views/pos_blackbox_be_assets.xml",
            "views/pos_blackbox_be_views.xml",
            "controllers/main.py",
        ]

        for relative_file_path in relative_file_paths_to_show:
            absolute_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, relative_file_path))
            size_in_bytes = os.path.getsize(absolute_file_path)

            with open(absolute_file_path, 'r') as f:
                data['files'].append({
                    'name': relative_file_path,
                    'size_in_bytes': size_in_bytes,
                    'contents': f.read()
                })

        return request.render('pos_blackbox_be.fdm_source', data)
