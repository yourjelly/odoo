# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os

from odoo import tools
from odoo.report import render_report
from odoo.tests import common


class ReportFrTest(common.TransactionCase):
    def test_00_create_pdf(self):
        data, report_format = render_report('l10n_fr.report_l10nfrbilan', {}, {})
        if tools.config['test_report_directory']:
            file(os.path.join(tools.config['test_report_directory'], 'l10n_fr-bilan_report.' + report_format), 'wb+').write(data)

    def test_01_create_pdf(self):
        data, report_format = render_report('l10n_fr.report_l10nfrresultat', {}, {})
        if tools.config['test_report_directory']:
            file(os.path.join(tools.config['test_report_directory'], 'l10n_fr-compute_resultant_report.' + report_format), 'wb+').write(data)
