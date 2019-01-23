# -*- coding: utf-8 -*-

from odoo import fields, models, api, _


class AccountMove(models.Model):
    _inherit = 'account.move'

    stock_move_id = fields.Many2one('stock.move', string='Stock Move')

    # -------------------------------------------------------------------------
    # OVERRIDE METHODS
    # -------------------------------------------------------------------------

    @api.multi
    def post(self):
        # OVERRIDE
        # Create additional COGS lines for customer invoices.
        self.env['account.move.line'].create(self._stock_account_prepare_cogs_out_lines_vals())

        # Post entries.
        res = super(AccountMove, self).post()

        # Reconcile COGS lines in case of anglo-saxon accounting with perpetual valuation.
        self._stock_account_anglo_saxon_reconcile_valuation()
        return res

    @api.multi
    def button_cancel(self):
        # OVERRIDE
        res = super(AccountMove, self).button_cancel()

        # Unlink the COGS lines generated during the 'post' method.
        self.mapped('line_ids').filtered(lambda line: line.display_type == 'cogs').unlink()
        return res

    # -------------------------------------------------------------------------
    # COGS METHODS
    # -------------------------------------------------------------------------

    @api.multi
    def _stock_account_prepare_cogs_out_lines_vals(self):
        ''' Prepare values used to create the journal items (account.move.line) corresponding to the Cost of Good Sold
        lines (COGS) for customer invoices.

        Example:

        Buy a product having a cost of 9 being a storable product and having a perpetual valuation in FIFO.
        Sell this product at a price of 10. The customer invoice's journal entries looks like:

        Account                                     | Debit | Credit
        ---------------------------------------------------------------
        200000 Product Sales                        |       | 10.0
        ---------------------------------------------------------------
        101200 Account Receivable                   | 10.0  |
        ---------------------------------------------------------------

        This method computes values used to make two additional journal items:

        ---------------------------------------------------------------
        220000 Expenses                             | 9.0   |
        ---------------------------------------------------------------
        101130 Stock Interim Account (Delivered)    |       | 9.0
        ---------------------------------------------------------------

        :return: A list of Python dictionary to be passed to env['account.move.line'].create.
        '''
        lines_vals_list = []
        for move in self.filtered(lambda move: move.type in ('out_invoice', 'out_refund', 'out_receipt')):
            for line in move.invoice_line_ids:

                # Filter out lines being not eligible for COGS.
                if line.product_id.type != 'product' or line.product_id.valuation != 'real_time':
                    continue

                # Retrieve accounts needed to generate the COGS.
                accounts = line.product_id.product_tmpl_id.get_product_accounts(fiscal_pos=move.fiscal_position_id)
                debit_interim_account = accounts['stock_output']
                credit_expense_account = accounts['expense']
                if not debit_interim_account or not credit_expense_account:
                    continue

                price_unit = line._stock_account_get_anglo_saxon_price_unit()

                # Add interim account line.
                vals = {
                    'name': line.name[:64],
                    'move_id': move.id,
                    'product_id': line.product_id.id,
                    'product_uom_id': line.product_uom_id.id,
                    'quantity': line.quantity,
                    'price_unit': -price_unit,
                    'price_subtotal': line.quantity * -price_unit,
                    'account_id': debit_interim_account.id,
                    'analytic_account_id': line.analytic_account_id.id,
                    'analytic_tag_ids': [(6, 0, line.analytic_tag_ids.ids)],
                    'display_type': 'cogs',
                }
                vals.update(line._convert_price_subtotal(
                    vals['price_subtotal'], move.type, line.currency_id, line.company_id, line.date))
                lines_vals_list.append(vals)

                # Add expense account line.
                vals = {
                    'name': line.name[:64],
                    'move_id': move.id,
                    'product_id': line.product_id.id,
                    'product_uom_id': line.product_uom_id.id,
                    'quantity': line.quantity,
                    'price_unit': price_unit,
                    'price_subtotal': line.quantity * price_unit,
                    'account_id': credit_expense_account.id,
                    'analytic_account_id': line.analytic_account_id.id,
                    'analytic_tag_ids': [(6, 0, line.analytic_tag_ids.ids)],
                    'display_type': 'cogs',
                }
                vals.update(line._convert_price_subtotal(
                    vals['price_subtotal'], move.type, line.currency_id, line.company_id, line.date))
                lines_vals_list.append(vals)
        return lines_vals_list

    def _stock_account_get_last_step_stock_moves(self):
        """ To be overridden for customer invoices and vendor bills in order to
        return the stock moves related to the invoices in self.
        """
        return self.env['stock.move']

    def _stock_account_anglo_saxon_reconcile_valuation(self, product=False):
        """ Reconciles the entries made in the interim accounts in anglosaxon accounting,
        reconciling stock valuation move lines with the invoice's.
        """
        for move in self:
            if not move.type in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund'):
                continue
            if not move.company_id.anglo_saxon_accounting:
                continue

            stock_moves = move._stock_account_get_last_step_stock_moves()

            if not stock_moves:
                continue

            products = product or move.mapped('invoice_line_ids.product_id')
            for product in products:
                if product.valuation != 'real_time':
                    continue

                # We first get the invoices move lines (taking the invoice and the previous ones into account)...
                product_accounts = product.product_tmpl_id._get_product_accounts()
                if move.type in ('out_invoice', 'out_refund'):
                    product_interim_account = product_accounts['stock_output']
                else:
                    product_interim_account = product_accounts['stock_input']

                # Search for COGS lines linked to the product in the journal entry.
                product_account_moves = move.line_ids.filtered(
                    lambda line: line.product_id == product and line.account_id == product_interim_account)

                # Search for COGS lines linked to the product in the stock moves.
                product_stock_moves = stock_moves.filtered(lambda stock_move: stock_move.product_id == product)
                product_account_moves += product_stock_moves.mapped('account_move_ids.line_ids')\
                    .filtered(lambda line: line.account_id == product_interim_account)

                # Reconcile.
                product_account_moves.reconcile()


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    display_type = fields.Selection(selection_add=[('cogs', 'Cost of Good Sold')])

    @api.multi
    def _get_computed_account(self):
        # OVERRIDE to use the stock input account by default on vendor bills when dealing
        # with anglo-saxon accounting.
        self.ensure_one()
        if self.product_id.type == 'product' \
            and self.move_id.company_id.anglo_saxon_accounting \
            and self.move_id.type in ('in_invoice', 'in_refund'):
            fiscal_position = self.move_id.fiscal_position_id
            accounts = self.product_id.product_tmpl_id.get_product_accounts(fiscal_pos=fiscal_position)
            if accounts['stock_input']:
                return accounts['stock_input']
        return super(AccountMoveLine, self)._get_computed_account()

    @api.multi
    def _stock_account_get_anglo_saxon_price_unit(self):
        self.ensure_one()
        if not self.product_id:
            return self.price_unit
        return self.product_id._stock_account_get_anglo_saxon_price_unit(uom=self.product_uom_id)
