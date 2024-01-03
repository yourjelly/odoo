# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import requests

from odoo import _, api, fields, models, SUPERUSER_ID
from odoo.exceptions import UserError

URL = "https://etims-api-sbx.kra.go.ke/etims-api/"
SAVE_STOCK_IO_URL = URL + "insertStockIO"
FETCH_STOCK_MOVE_URL = URL + "selectStockMoveList"


class StockMove(models.Model):
    _inherit = "stock.move"

    l10n_ke_oscu_flow_type_code = fields.Selection(
        selection=[
            ('01',  'Import Incoming'),
            ('02',  'Purchase Incoming'),
            ('03',  'Return Incoming'),
            ('04',  'Stock Movement Incoming'),
            ('05',  'Processing Incoming'),
            ('06',  'Adjustment Incoming'),
            ('11', 'Sale Outgoing'),
            ('12', 'Return Outgoing'),
            ('13', 'Stock Movement Outgoing'),
            ('14', 'Processing Outgoing'),
            ('15', 'Discarding Outgoing'),
            ('16', 'Adjustment Outgoing'),
        ],
        compute='_compute_l10n_ke_oscu_flow_type_code',
        string="eTIMS Category",
        store=True, readonly=False, copy=False,
    )

    l10n_ke_oscu_partner_branch_id = fields.Char(
        compute='_compute_l10n_ke_oscu_partner_branch_id',
        string="Destination Branch",
        store=True, readonly=False,
    )

    l10n_ke_oscu_sar_number = fields.Integer(string='Store and Release Number')

    @api.depends('location_id.usage', 'location_dest_id.usage', 'partner_id')
    def _compute_l10n_ke_oscu_flow_type_code(self):
        flow_mappings = {
            # Partner type, location_id.usage, location_dest_id.usage
            ('external', 'supplier',    'internal'  ): '02', # Purchase Incoming
            ('external', 'customer',    'internal'  ): '03', # Return Incoming
            ('internal', 'supplier',    'internal'  ): '04', # Stock Movement Incoming
            ('internal', 'production',  'internal'  ): '05', # Processing Incoming
            ('internal', 'inventory',   'internal'  ): '06', # Adjustment Incoming
            ('external', 'internal',    'customer'  ): '11', # Sale Outgoing
            ('external', 'internal',    'supplier'  ): '12', # Return Outgoing
            ('internal', 'internal',    'customer'  ): '13', # Stock Movement Outgoing
            ('internal', 'internal',    'production'): '14', # Processing Outgoing
            ('internal', 'internal',    'inventory' ): '16', # Adjustment Incoming
        }
        for move in self:
            if move.scrapped:
                move.l10n_ke_oscu_flow_type_code = '15'      # Discarding Outgoing
                continue

            partner_type = 'external'
            if (partner_company := move.partner_id.ref_company_ids):
                if partner_company.vat == move.company_id.vat and partner_company.l10n_ke_oscu_cmc_key:
                    partner_type = 'internal'
            elif move.is_inventory or not move.partner_id:
                partner_type = 'internal'

            move.l10n_ke_oscu_flow_type_code = flow_mappings.get((
                partner_type, move.location_id.usage, move.location_dest_id.usage
            ))

    @api.depends('l10n_ke_oscu_flow_type_code', 'partner_id')
    def _compute_l10n_ke_oscu_partner_branch_id(self):
        for move in self:
            if move.partner_id.ref_company_ids:
                move.l10n_ke_oscu_partner_branch_id = move.partner_id.ref_company_ids[0].l10n_ke_oscu_branch_code or False

    def _l10n_ke_oscu_save_stock_io_content(self):

        outgoing = self.picking_type_id.code == 'outgoing'
        customer_info = {
            'custTin':                  self.partner_id.vat if outgoing else None,   # Customer TIN
            'custNm':                   self.partner_id.name if outgoing else None,  # Customer Name
            'custBhfId':                self.l10n_ke_oscu_partner_branch_id or None, # Customer Branch ID
        }
        lines = self.move_line_ids._l10n_ke_oscu_save_stock_io_content()
        content = {
            **customer_info,
            'regTyCd':                  'M',                                         # Registration type code # TODO (if this becomes automatic, then A)
            'sarTyCd':                  self.l10n_ke_oscu_flow_type_code,            # Stored and released type code
            'ocrnDt':                   self.date.strftime('%Y%m%d'),                # Occurred date
            'regrId':                   self.env.user.id,
            'regrNm':                   self.env.user.name,
            'modrId':                   self.env.user.id,
            'modrNm':                   self.env.user.name,
            'totItemCnt':               len(lines),                                  # TODO make sure this is actually possible
            'totTaxblAmt':              sum(line['taxblAmt'] for line in lines),
            'totTaxAmt':                sum(line['taxAmt'] for line in lines),
            'totAmt':                   sum(line['totAmt'] for line in lines),
            'itemList':                 lines,
        }
        return content

    def action_l10n_ke_oscu_save_stock_master(self):

        for move in self:
            content = move._l10n_ke_oscu_save_stock_io_content()
            sequence = self.company_id.l10n_ke_oscu_seq_stock_io_id
            content.update({
                'sarNo': sequence.number_next,
                'orgSarNo': sequence.number_next,
            })
            session = self.company_id.l10n_ke_oscu_get_session()
            response = session.post(SAVE_STOCK_IO_URL, json=content)
            print(response.content)
            if response.json()['resultCd'] == '000':
                move.l10n_ke_oscu_sar_number = content['sarNo']
                sequence.next_by_id()
            else:
                print("it didn't work out")
                print(f"\n{response.json()}")

    def action_l10n_ke_oscu_fetch_stock_moves(self):
        # FIXME this response is currently empty for me
        session = self.env.company.l10n_ke_oscu_get_session()
        last_request_date = self.env['ir.config_parameter'].get_param('l10n_ke_edi_oscu.last_fetch_stock_move_request_date', '20180101000000')
        response = session.post(FETCH_STOCK_MOVE_URL, json={'lastReqDt': last_request_date})

        return response
