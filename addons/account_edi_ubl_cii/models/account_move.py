# -*- coding: utf-8 -*-
from odoo import api, fields, models


class AccountMove(models.Model):
    _inherit = 'account.move'

    ubl_cii_xml_id = fields.Many2one(
        comodel_name='ir.attachment',
        string="Attachment",
        compute=lambda self: self._compute_linked_attachment_id('ubl_cii_xml_id', 'ubl_cii_xml_file'),
        depends=['ubl_cii_xml_id']
    )
    ubl_cii_xml_file = fields.Binary(
        attachment=True,
        string="UBL/CII File",
        copy=False,
    )

    # -------------------------------------------------------------------------
    # EDI
    # -------------------------------------------------------------------------

    @api.model
    def _get_ubl_cii_builder_from_xml_tree(self, tree):
        customization_id = tree.find('{*}CustomizationID')
        if tree.tag == '{urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100}CrossIndustryInvoice':
            return self.env['account.edi.xml.cii']
        ubl_version = tree.find('{*}UBLVersionID')
        if ubl_version is not None:
            if ubl_version.text == '2.0':
                return self.env['account.edi.xml.ubl_20']
            if ubl_version.text == '2.1':
                return self.env['account.edi.xml.ubl_21']
        if customization_id is not None:
            if 'xrechnung' in customization_id.text:
                return self.env['account.edi.xml.ubl_de']
            if customization_id.text == 'urn:cen.eu:en16931:2017#compliant#urn:fdc:nen.nl:nlcius:v1.0':
                return self.env['account.edi.xml.ubl_nl']
            if customization_id.text == 'urn:cen.eu:en16931:2017#conformant#urn:fdc:peppol.eu:2017:poacc:billing:international:aunz:3.0':
                return self.env['account.edi.xml.ubl_a_nz']
            if customization_id.text == 'urn:cen.eu:en16931:2017#conformant#urn:fdc:peppol.eu:2017:poacc:billing:international:sg:3.0':
                return self.env['account.edi.xml.ubl_sg']
            if 'urn:cen.eu:en16931:2017' in customization_id.text:
                return self.env['account.edi.xml.ubl_bis3']

    def _get_edi_decoder(self, file_data, new=False):
        # EXTENDS 'account'
        if file_data['type'] == 'xml':
            ubl_cii_xml_builder = self._get_ubl_cii_builder_from_xml_tree(file_data['xml_tree'])
            if ubl_cii_xml_builder is not None:
                return ubl_cii_xml_builder._import_invoice_ubl_cii

        return super()._get_edi_decoder(file_data, new=new)

    def _prepare_edi_tax_details_fixed_tax(self, grouping_key_generator):
        self.ensure_one()

        tmp_product = self.env['product.product']
        base_lines = []
        sign = -1 if self.is_inbound(include_receipts=True) else 1
        for line in self.line_ids.filtered(lambda x: x.display_type == 'product'):
            if 'fixed' in line.tax_ids.mapped('amount_type'):
                fixed_tax = line.tax_ids.filtered(lambda t: t.amount_type == 'fixed')

                vals = line._convert_to_tax_base_line_dict()
                # There is only 2 taxes in this special case
                other_tax = vals['taxes'] - fixed_tax

                # 1. Pretend the fixed tax is not present on this line
                vals['taxes'] = other_tax
                base_lines.append(vals)

                # 2. Pretend there is another product line with amount = the amount of the fixed tax
                vals2 = vals.copy()

                # Should this new line have a tax ?
                tax = self.env['account.tax'].search(
                    [('amount', '=', 0), ('amount_type', '=', 'percent'), ('active', '=', False)], limit=1)

                if fixed_tax.sequence < other_tax.sequence and fixed_tax.include_base_amount and other_tax.is_base_affected:
                    tax = other_tax

                if not tax:
                    tax = self.env['account.tax'].create({
                        'name': "0 %",
                        'amount': 0,
                        'amount_type': 'percent',
                        'active': False,
                    })

                tmp_product = self.env['product.product'].create({'name': fixed_tax.name})
                vals2.update({
                    'record': 'FIXED_TAX_SIMULATED_AML',
                    'taxes': tax,
                    'product': tmp_product,
                    'price_unit': fixed_tax.amount,
                    'price_subtotal': fixed_tax.amount * sign,
                    'rate': 1.0,  # TODO
                })
                base_lines.append(vals2)
            else:
                base_lines.append(line._convert_to_tax_base_line_dict())

        to_process = []
        for base_line in base_lines:
            to_update_vals, tax_values_list = self.env['account.tax']._compute_taxes_for_single_line(base_line)
            to_process.append((base_line, to_update_vals, tax_values_list))

        vals = self.env['account.tax']._aggregate_taxes(
            to_process,
            grouping_key_generator=grouping_key_generator,
        )

        # Cleaning
        tmp_product.unlink()

        return vals
