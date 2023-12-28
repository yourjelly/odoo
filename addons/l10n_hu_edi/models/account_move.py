# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import formatLang, float_round, float_repr, cleanup_xml_node, groupby
from odoo.addons.l10n_hu_edi.models.l10n_hu_edi_transaction import _ACTIVE_STATES
from odoo.addons.l10n_hu_edi.models.l10n_hu_edi_connection import format_bool

from markupsafe import Markup
from lxml import etree
import logging

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = "account.move"

    # === Technical fields === #
    l10n_hu_invoice_chain_index = fields.Integer(
        string="(HU) Invoice Chain Index",
        help="For base invoices: the length of the chain. For modification invoices: the index in the chain.",
        copy=False,
    )
    l10n_hu_edi_transaction_ids = fields.One2many(
        comodel_name="l10n_hu_edi.transaction",
        inverse_name="invoice_id",
        string="(HU) Upload Transaction History",
        copy=False,
    )
    l10n_hu_edi_active_transaction_id = fields.Many2one(
        comodel_name="l10n_hu_edi.transaction",
        string="(HU) Active Upload Transaction",
        compute="_compute_l10n_hu_edi_active_transaction_id",
        search="_search_l10n_hu_edi_active_transaction_id",
    )
    l10n_hu_edi_credentials_mode = fields.Selection(
        related="l10n_hu_edi_active_transaction_id.credentials_mode",
    )

    # === Constraints === #

    @api.constrains("l10n_hu_edi_transaction_ids", "state")
    def _check_only_one_active_transaction(self):
        """ Enforce the constraint that posted invoices have at most one active transaction,
        and draft invoices and cancelled invoices have no active transactions.
        This means that you cannot create a transaction on an invoice if it already has an active transaction,
        and you cannot reset to draft / cancel a posted invoice if it still has an active transaction.
        """
        for move in self:
            num_active_transactions = len(move.l10n_hu_edi_transaction_ids.filtered(lambda t: t.state in _ACTIVE_STATES))
            if num_active_transactions > 1:
                raise ValidationError(_("Cannot create a new NAV transaction for an invoice while an existing transaction is active!"))
            if move.state in ["draft", "cancel"] and num_active_transactions > 0:
                raise ValidationError(_("Cannot reset to draft or cancel invoice %s because an electronic document was already sent to NAV!", move.name))

    # === Computes / Getters === #

    @api.depends("l10n_hu_edi_transaction_ids")
    def _compute_l10n_hu_edi_active_transaction_id(self):
        """ A move's active transaction is the only one in a state that still has the potential to be confirmed/rejected. """
        for move in self:
            move.l10n_hu_edi_active_transaction_id = move.l10n_hu_edi_transaction_ids.filtered(lambda t: t.state in _ACTIVE_STATES)

    @api.model
    def _search_l10n_hu_edi_active_transaction_id(self, operator, value):
        return ["&", ("l10n_hu_edi_transaction_ids", operator, value), ("l10n_hu_edi_transaction_ids.state", "in", _ACTIVE_STATES)]

    @api.depends("l10n_hu_edi_active_transaction_id.state", "state")
    def _compute_show_reset_to_draft_button(self):
        super()._compute_show_reset_to_draft_button()
        for move in self:
            if move.state == "posted" and move.l10n_hu_edi_active_transaction_id:
                if not move.l10n_hu_edi_active_transaction_id or move.l10n_hu_edi_active_transaction_id.state in ["to_send", "token_error"]:
                    move.show_reset_to_draft_button = True
                else:
                    move.show_reset_to_draft_button = False

    def _l10n_hu_get_chain_base(self):
        """ Get the base invoice of the invoice chain, or None if this is already a base invoice. """
        self.ensure_one()
        base_invoice = self
        while base_invoice.reversed_entry_id:
            base_invoice = base_invoice.reversed_entry_id
        return base_invoice if base_invoice != self else None

    def _l10n_hu_get_chain_invoices(self):
        """ Given a base invoice, get all invoices in the chain. """
        self.ensure_one()
        chain_invoices = self
        while chain_invoices != chain_invoices | chain_invoices.reversal_move_id:
            chain_invoices = chain_invoices | chain_invoices.reversal_move_id
        return chain_invoices - self

    # === Overrides === #

    @api.depends("l10n_hu_edi_active_transaction_id")
    def _compute_edi_web_services_to_process(self):
        """ Remove the HU EDI from the to_process string for moves that have no active transactions, for UI purposes """
        # EXTEND account_edi
        super()._compute_edi_web_services_to_process()
        hu_edi_format = self.env.ref("l10n_hu_edi.edi_hun_nav_3_0")
        for move in self:
            if not self.l10n_hu_edi_active_transaction_id:
                move.edi_web_services_to_process = move.edi_web_services_to_process.replace(hu_edi_format.name, "")

    def button_draft(self):
        # EXTEND account
        for move in self:
            if move.l10n_hu_edi_active_transaction_id.state in ["to_send", "token_error"]:
                move.l10n_hu_edi_active_transaction_id.abort()
        return super().button_draft()

    def action_reverse(self):
        # EXTEND account
        unconfirmed = self.filtered(lambda m: m.country_code == "HU" and m.l10n_hu_edi_active_transaction_id.state not in ["confirmed", "confimed_warning"])
        if unconfirmed:
            raise UserError(_(
                "Invoices %s have not yet been confirmed by NAV. Please wait for confirmation before issuing a modification invoice.",
                unconfirmed.mapped("name"))
            )
        return super().action_reverse()

    def _post(self, soft=True):
        to_post = self.filtered(lambda move: move.date <= fields.Date.context_today(self)) if soft else self
        to_post._l10n_hu_edi_pre_post()
        posted_moves = super()._post(soft=soft)
        posted_moves._l10n_hu_edi_post_post()
        return posted_moves

    def _l10n_hu_edi_pre_post(self):
        """ Set the l10n_hu_invoice_chain_index and l10n_hu_line_number fields at posting. """
        for move in self.filtered(lambda m: m.country_code == "HU"):
            base_invoice = move._l10n_hu_get_chain_base()
            if base_invoice is None:
                if not move.l10n_hu_invoice_chain_index:
                    # This field has a meaning only for modification invoices, however, in our implementation, we also set it
                    # on base invoices as a way of controlling concurrency, to ensure that the chain sequence is unique and gap-less.
                    move.l10n_hu_invoice_chain_index = 0
                next_line_number = 1
            else:
                if not move.l10n_hu_invoice_chain_index:
                    # If two invoices of the same chain are posted simultaneously, this will trigger a serialization error at flush,
                    # ensuring sequence integrity.
                    base_invoice.l10n_hu_invoice_chain_index += 1
                    move.l10n_hu_invoice_chain_index = base_invoice.l10n_hu_invoice_chain_index

                prev_chain_invoices = base_invoice._l10n_hu_get_chain_invoices() - move
                if prev_chain_invoices:
                    last_chain_invoice = max(prev_chain_invoices, key=lambda m: m.l10n_hu_invoice_chain_index)
                else:
                    last_chain_invoice = base_invoice
                next_line_number = max(last_chain_invoice.line_ids.mapped("l10n_hu_line_number")) + 1

            # Set l10n_hu_line_number consecutively, first on product lines, then on rounding line
            for product_line in move.invoice_line_ids.filtered(lambda l: l.display_type == "product"):
                product_line.l10n_hu_line_number = next_line_number
                next_line_number += 1
            for rounding_line in move.line_ids.filtered(lambda l: l.display_type == "rounding"):
                rounding_line.l10n_hu_line_number = next_line_number
                next_line_number += 1

    def _l10n_hu_edi_post_post(self):
        """ Create an EDI transaction at posting and render the PDF """
        for move in self.filtered(lambda m: m.country_code == "HU"):
            if not move.company_id.l10n_hu_edi_primary_credentials_id:
                raise UserError(_("Please set primary NAV credentials in the Accounting Settings!"))
            invoice_xml = move._l10n_hu_edi_generate_xml()
            invoice_attachment = self.env["ir.attachment"].create({
                "name": f"{move.name}.xml",
                "res_id": move.id,
                "res_model": move._name,
                "type": "binary",
                "raw": invoice_xml,
                "mimetype": "application/xml",
                "description": _("Hungarian invoice NAV 3.0 XML generated for %s", move.name),
            })
            transaction = self.env["l10n_hu_edi.transaction"].create({
                "invoice_id": move.id,
                "credentials_id": move.company_id.l10n_hu_edi_primary_credentials_id.id,
                "operation": "MODIFY" if self.reversed_entry_id else "CREATE",
                "attachment_id": invoice_attachment.id,
            })
            message = _("Invoice queued for upload to NAV.") + Markup("<br/>") + _("Transaction: ") + transaction._get_html_link()
            move.with_context(no_new_invoice=True).message_post(
                body=message,
                attachment_ids=transaction.attachment_id.ids,
            )
            self.env["ir.actions.report"]._render_qweb_pdf("account.report_invoice", res_ids=move.id)

    # === EDI: Flow === #

    def _l10n_hu_edi_check_invoice_for_errors(self):
        self.ensure_one()
        error_message = []

        company_partner = self.company_id.partner_id

        if not company_partner.vat:
            if self.is_sale_document(include_receipts=True):
                error_message.append(_("Please set issuer VAT number!"))
            else:
                error_message.append(_("Please set customer VAT number!"))
        if not company_partner.zip or not company_partner.city or not company_partner.street:
            if self.is_sale_document(include_receipts=True):
                error_message.append(_("Please set issuer address properly!"))
            else:
                error_message.append(_("Please set customer address properly!"))

        invoice_partner = self.partner_id.commercial_partner_id
        if invoice_partner.is_company:
            if not invoice_partner.country_id:
                error_message.append(_("Missing country for partner!"))

            else:
                eu_country_codes = set(self.env.ref("base.europe").country_ids.mapped("code"))
                if invoice_partner.country_code in eu_country_codes and not invoice_partner.vat:
                    error_message.append(_("Missing VAT number for partner!"))

        for line in self.invoice_line_ids.filtered(lambda l: l.display_type in ("product", "rounding")):
            vat_tax = line.tax_ids.filtered(lambda t: t.l10n_hu_tax_type)
            # rounding line can have no VAT, we will upload it anyway to NAV
            if len(vat_tax) == 0 and line.display_type == "product":
                error_message.append(_("You must select a VAT type of tax for line: %s!", line.name))
            if len(vat_tax) > 1:
                error_message.append(_("You should only have one VAT type of tax for line: %s!", line.name))
            if line.display_type == "rounding" and vat_tax.l10n_hu_tax_type != "ATK":
                error_message.append(_("The rounding line can only contain VAT with type ATK!"))
            non_vat_taxes = line.tax_ids - vat_tax
            if non_vat_taxes.filtered(lambda t: not t.price_include or not t.include_base_amount):
                error_message.append(_("Any non-VAT taxes must be included in the price of the product!"))
            if non_vat_taxes and not vat_tax.is_base_affected:
                error_message.append(_("Incorrect VAT tax configuration: you must set 'Affected by previous taxes' to True!"))

        return error_message

    # === EDI: XML generation === #

    def _l10n_hu_edi_generate_xml(self):
        invoice_data = self.env["ir.qweb"]._render(
            self._l10n_hu_edi_get_electronic_invoice_template(),
            self._l10n_hu_edi_get_invoice_values(),
        )
        return etree.tostring(cleanup_xml_node(invoice_data, remove_blank_nodes=False), xml_declaration=True, encoding="UTF-8")

    def _l10n_hu_edi_get_electronic_invoice_template(self):
        """This is for feature extensibility"""
        return "l10n_hu_edi.nav_online_invoice_xml_3_0"

    def _l10n_hu_edi_get_invoice_values(self):
        def get_vat_data(partner, force_vat=None):
            if partner.country_code == "HU" or force_vat:
                return {
                    "tax_number": partner.l10n_hu_group_vat or (force_vat or partner.vat),
                    "group_member_tax_number": partner.l10n_hu_group_vat and (force_vat or partner.vat),
                }
            elif partner.country_id.country_group_id == self.env.ref("base.europe"):
                return {"community_vat_number": partner.vat}
            else:
                return {"third_state_tax_id": partner.vat}

        supplier = self.company_id.partner_id
        customer = self.partner_id.commercial_partner_id

        currency_huf = self.env.ref("base.HUF")
        currency_rate = self.env["res.currency"]._get_conversion_rate(
            from_currency=self.currency_id,
            to_currency=currency_huf,
            company=self.company_id,
            date=self.invoice_date,
        )

        invoice_values = {
            "invoice": self,
            "invoiceIssueDate": fields.Date.context_today(self),
            "completenessIndicator": False,
            "modifyWithoutMaster": False,
            "base_invoice": self._l10n_hu_get_chain_base(),
            "supplier": supplier,
            "supplier_vat_data": get_vat_data(supplier, self.fiscal_position_id.foreign_vat),
            "supplier_bank_account": self.partner_bank_id or supplier.bank_ids[:1],
            "customerVatStatus": (not customer.is_company and "PRIVATE_PERSON") or (customer.country_code == "HU" and "DOMESTIC") or "OTHER",
            "customer_vat_data": get_vat_data(customer) if customer.is_company else None,
            "customer": customer,
            "customer_bank_account": customer.bank_ids[:1],
            "smallBusinessIndicator": self.company_id.l10n_hu_company_tax_arrangments == "sb",
            "exchangeRate": currency_rate,
            "shipping_partner": self.partner_shipping_id,
            "sales_partner": self.user_id,
            "mergedItemIndicator": False,
            "format_bool": format_bool,
            "float_repr": float_repr,
            "lines_values": [],
        }

        sign = self.move_type == "out_refund" and -1.0 or 1.0
        line_number_offset = min(n for n in self.invoice_line_ids.mapped("l10n_hu_line_number") if n) - 1

        for line in self.line_ids.filtered(lambda l: l.l10n_hu_line_number).sorted(lambda l: l.l10n_hu_line_number):
            line_values = {
                "line": line,
                "lineNumber": line.l10n_hu_line_number - line_number_offset,
                "lineNumberReference": line.l10n_hu_line_number,
                "lineExpressionIndicator": line.product_id and line.product_uom_id,
                "lineNatureIndicator": {False: "OTHER", "service": "SERVICE"}.get(line.product_id.type, "PRODUCT"),
                "lineDescription": line.name,
            }

            if line.display_type == "product":
                vat_tax = line.tax_ids.filtered(lambda t: t.l10n_hu_tax_type)
                price_unit_signed =  sign * line.price_unit
                price_net_signed = self.currency_id.round(price_unit_signed * line.quantity * (1 - line.discount / 100.0))
                discount_value_signed = self.currency_id.round(price_unit_signed * line.quantity - price_net_signed)
                price_total_signed = sign * line.price_total
                vat_amount_signed = self.currency_id.round(price_total_signed - price_net_signed)

                line_values.update({
                    "vat_tax": vat_tax,
                    "vatPercentage": float_round(vat_tax.amount / 100.0, 4),
                    "quantity": line.quantity,
                    "unitPrice": price_unit_signed,
                    "unitPriceHUF": currency_huf.round(price_unit_signed * currency_rate),
                    "discountValue": discount_value_signed,
                    "discountRate": line.discount / 100.0,
                    "lineNetAmount": price_net_signed,
                    "lineNetAmountHUF": currency_huf.round(price_net_signed * currency_rate),
                    "lineVatData": not self.currency_id.is_zero(vat_amount_signed),
                    "lineVatAmount": vat_amount_signed,
                    "lineVatAmountHUF": currency_huf.round(vat_amount_signed * currency_rate),
                    "lineGrossAmountNormal": price_total_signed,
                    "lineGrossAmountNormalHUF": currency_huf.round(price_total_signed * currency_rate),
                })

            elif line.display_type == "rounding":
                atk_tax = self.env["account.tax"].search([("l10n_hu_tax_type", "=", "ATK"), ("company_id", "=", self.company_id.id)], limit=1)
                if not atk_tax:
                    raise UserError(_("Please create an ATK (outside the scope of the VAT Act) type of tax!"))

                amount_huf = line.balance if self.company_id.currency_id == currency_huf else currency_huf.round(line.amount_currency * currency_rate)
                line_values.update({
                    "vat_tax": atk_tax,
                    "vatPercentage": float_round(atk_tax.amount / 100.0, 4),
                    "quantity": 1.0,
                    "unitPrice": -line.amount_currency,
                    "unitPriceHUF": -amount_huf,
                    "lineNetAmount": -line.amount_currency,
                    "lineNetAmountHUF": -amount_huf,
                    "lineVatData": False,
                    "lineGrossAmountNormal": -line.amount_currency,
                    "lineGrossAmountNormalHUF": -amount_huf,
                })

            invoice_values["lines_values"].append(line_values)

        is_company_huf = self.company_id.currency_id == currency_huf
        tax_amounts_by_tax = {
            line.tax_line_id: {
                "vatRateVatAmount": -line.amount_currency,
                "vatRateVatAmountHUF": -line.balance if is_company_huf else currency_huf.round(-line.amount_currency * currency_rate),
            }
            for line in self.line_ids.filtered(lambda l: l.tax_line_id.l10n_hu_tax_type)
        }

        invoice_values["tax_summary"] = [
            {
                "vat_tax": vat_tax,
                "vatPercentage": float_round(vat_tax.amount / 100.0, 4),
                "vatRateNetAmount": self.currency_id.round(sum(l["lineNetAmount"] for l in lines_values_by_tax)),
                "vatRateNetAmountHUF": currency_huf.round(sum(l["lineNetAmountHUF"] for l in lines_values_by_tax)),
                "vatRateVatAmount": tax_amounts_by_tax.get(vat_tax, {}).get("vatRateVatAmount", 0.0),
                "vatRateVatAmountHUF":tax_amounts_by_tax.get(vat_tax, {}).get("vatRateVatAmountHUF", 0.0),
            }
            for vat_tax, lines_values_by_tax in groupby(invoice_values["lines_values"], lambda l: l["vat_tax"])
        ]

        total_vat = self.currency_id.round(sum(tax_vals["vatRateVatAmount"] for tax_vals in invoice_values["tax_summary"]))
        total_vat_huf = currency_huf.round(sum(tax_vals["vatRateVatAmountHUF"] for tax_vals in invoice_values["tax_summary"]))

        total_gross = self.amount_total_in_currency_signed
        total_gross_huf = self.amount_total_signed if is_company_huf else currency_huf.round(self.amount_total_in_currency_signed * currency_rate)

        total_net = self.currency_id.round(total_gross - total_vat)
        total_net_huf = currency_huf.round(total_gross_huf - total_vat_huf)

        invoice_values.update({
            "invoiceNetAmount": total_net,
            "invoiceNetAmountHUF": total_net_huf,
            "invoiceVatAmount": total_vat,
            "invoiceVatAmountHUF": total_vat_huf,
            "invoiceGrossAmount": total_gross,
            "invoiceGrossAmountHUF": total_gross_huf,
        })

        return invoice_values

    # === PDF generation === #

    def _get_name_invoice_report(self):
        self.ensure_one()
        return self.country_code == "HU" and "l10n_hu_edi.report_invoice_document" or super()._get_name_invoice_report()

    def _l10n_hu_get_invoice_totals_for_report(self):
        self.ensure_one()

        currency_rate = self.env["res.currency"]._get_conversion_rate(
            from_currency=self.currency_id,
            to_currency=self.env.ref("base.HUF"),
            company=self.company_id,
            date=self.invoice_date,
        )

        tax_totals = self.tax_totals
        if not isinstance(tax_totals, dict):
            return tax_totals

        tax_totals.update(
            {
                "display_tax_base": True,
                "total_vat_amount_in_huf": 0.0,
            }
        )

        sign = 1.0
        if "refund" in self.move_type:
            sign = -1.0

        if sign < 0:
            tax_totals.update(
                {
                    "amount_total": tax_totals["amount_total"] * sign,
                    "amount_untaxed": tax_totals["amount_untaxed"] * sign,
                }
            )
            tax_totals.update(
                {
                    "formatted_amount_total": formatLang(
                        self.env, tax_totals["amount_total"], currency_obj=self.currency_id
                    ),
                    "formatted_amount_untaxed": formatLang(
                        self.env, tax_totals["amount_untaxed"], currency_obj=self.currency_id
                    ),
                }
            )

            if "formatted_amount_total_rounded" in tax_totals:
                tax_totals.update(
                    {
                        "rounding_amount": tax_totals["rounding_amount"] * sign,
                        "amount_total_rounded": tax_totals["amount_total_rounded"] * sign,
                    }
                )
                tax_totals.update(
                    {
                        "formatted_rounding_amount": formatLang(
                            self.env, tax_totals["rounding_amount"], currency_obj=self.currency_id
                        ),
                        "formatted_amount_total_rounded": formatLang(
                            self.env, tax_totals["amount_total_rounded"], currency_obj=self.currency_id
                        ),
                    }
                )

        for tax_list in tax_totals["groups_by_subtotal"].values():
            for tax in tax_list:
                if sign < 0:
                    tax.update(
                        {
                            "tax_group_amount": tax["tax_group_amount"] * sign,
                            "tax_group_base_amount": tax["tax_group_base_amount"] * sign,
                        }
                    )
                    tax.update(
                        {
                            "formatted_tax_group_amount": formatLang(
                                self.env,
                                tax["tax_group_amount"],
                                currency_obj=self.currency_id,
                            ),
                            "formatted_tax_group_base_amount": formatLang(
                                self.env,
                                tax["tax_group_base_amount"],
                                currency_obj=self.currency_id,
                            ),
                        }
                    )

                if self.currency_id != self.company_id.currency_id:
                    tax.update(
                        {
                            "tax_group_amount_company_currency": float_round(
                                tax["tax_group_amount"] * currency_rate, 0
                            ),
                            "tax_group_base_amount_company_currency": float_round(
                                tax["tax_group_base_amount"] * currency_rate, 0
                            ),
                        }
                    )
                    tax.update(
                        {
                            "formatted_tax_group_amount_company_currency": formatLang(
                                self.env,
                                tax["tax_group_amount_company_currency"],
                                currency_obj=self.company_id.currency_id,
                            ),
                            "formatted_tax_group_base_amount_company_currency": formatLang(
                                self.env,
                                tax["tax_group_base_amount_company_currency"],
                                currency_obj=self.company_id.currency_id,
                            ),
                        }
                    )

                    tax_totals["total_vat_amount_in_huf"] += tax["tax_group_amount_company_currency"]

        tax_totals["formatted_total_vat_amount_in_huf"] = formatLang(
            self.env, tax_totals["total_vat_amount_in_huf"], currency_obj=self.company_id.currency_id
        )

        if sign < 0:
            for subtotal in tax_totals["subtotals"]:
                subtotal.update(
                    {
                        "amount": subtotal["amount"] * sign,
                    }
                )
                subtotal.update(
                    {
                        "formatted_amount": formatLang(self.env, subtotal["amount"], currency_obj=self.currency_id),
                    }
                )

        return tax_totals


class AccountInvoiceLine(models.Model):
    _inherit = "account.move.line"

    # === Technical fields === #
    l10n_hu_line_number = fields.Integer(
        string="(HU) Line Number",
        help="A consecutive indexing of invoice lines within the invoice chain.",
        copy=False,
    )
