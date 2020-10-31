# -*- coding: utf-8 -*-

from odoo import models, fields, api


class AccountMove(models.Model):
    _inherit = "account.move"

    @api.model
    def _get_tax_grouping_key_from_tax_line(self, tax_line):
        res = super()._get_tax_grouping_key_from_tax_line(tax_line)
        #Add base_line_ref in the group key to seperate the tax lines
        res.update({
            'base_line_ref': tax_line.ref,
        })
        return res

    @api.model
    def _get_tax_grouping_key_from_base_line(self, base_line, tax_vals):
        res = super()._get_tax_grouping_key_from_base_line(base_line, tax_vals)
        # if lines are being created, keep it's virtualID ref to link matching
        # base/tax lines, otherwise, use base line's ID.
        ref = base_line._origin.id or base_line.id.ref
        base_line.base_line_ref = ref
        res.update({
            'base_line_ref': ref,
        })
        return res

    @api.model
    def _get_tax_key_for_group_add_base(self, line):
        tax_key = super(AccountMove, self)._get_tax_key_for_group_add_base(line)
        tax_key += [
            line.id,
        ]
        return tax_key

class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    #it would be good to use the many2one fields instead of char, but required
    #related tax lines so it would be ok as of now.
    #framework fix for onchnage/create, we just need the referance to search the
    base_line_ref = fields.Char('Matching Ref',
        help='Technical field to map invoice base line with its tax lines.'
    )

    def _update_base_line_ref(self):
        #search for the invoice lines on which the taxes applied
        base_lines = self.filtered(lambda ln: ln.tax_ids)
        for line in base_lines:
            #filters the tax lines related to the base lines and replace virtual_id with the database id
            tax_lines = self.filtered(lambda ln: ln.base_line_ref == line.base_line_ref and not ln.tax_ids)
            tax_lines += line
            tax_lines.write({
                'base_line_ref': line.id,
            })
        return base_lines

    @api.model_create_multi
    def create(self, vals_list):
        lines = super().create(vals_list)
        lines._update_base_line_ref()
        return lines
