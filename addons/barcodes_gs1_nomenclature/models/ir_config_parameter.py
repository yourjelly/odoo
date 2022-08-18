# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.exceptions import ValidationError


class IrConfigParameter(models.Model):
    _inherit = 'ir.config_parameter'

    @api.constrains('value')
    def _check_gs1_value(self):
        if any(param.key == 'barcodes_gs1_nomenclature.gs1_separators_encodings' and any(not isinstance(item, tuple) for item in param.value) for param in self):
            raise ValidationError("The encoding of the system parameter 'gs1_separators_encodings' is incorrect. This is supposed to be a list of keys groups. "
                                  "Here are some examples of keys groups:"
                                  "\n\t- ('F8') for the key F8"
                                  "\n\t- ('Alt', '0', '2', '9') for the keys Alt+029"
                                  "\nAnd here is an example of a list with these groups:"
                                  "\n\t- [('F8'), ('Alt', '0', '2', '9')]")
