# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
import json
import pytz
import markupsafe

from collections import defaultdict
from markupsafe import Markup

from odoo import models, fields, api, _
from odoo.tools import html_escape, float_is_zero, float_compare
from odoo.exceptions import AccessError, ValidationError
from odoo.addons.iap import jsonrpc
import logging

_logger = logging.getLogger(__name__)

class AccountEdiFormat(models.Model):
    _inherit = "account.edi.format"

    @api.model
    def _get_l10n_in_base_tags(self):
        return (
           self.env.ref('l10n_in.tax_tag_base_sgst').ids
           + self.env.ref('l10n_in.tax_tag_base_cgst').ids
           + self.env.ref('l10n_in.tax_tag_base_igst').ids
           + self.env.ref('l10n_in.tax_tag_base_cess').ids
           + self.env.ref('l10n_in.tax_tag_zero_rated').ids
           + self.env.ref("l10n_in.tax_tag_exempt").ids
           + self.env.ref("l10n_in.tax_tag_nil_rated").ids
           + self.env.ref("l10n_in.tax_tag_non_gst_supplies").ids
        )

    @api.model
    def _l10n_in_edi_get_iap_buy_credits_message(self, company):
        base_url = "https://iap-sandbox.odoo.com/iap/1/credit" if not company.sudo().l10n_in_edi_production_env else ""
        url = self.env["iap.account"].get_credits_url(service_name="l10n_in_edi", base_url=base_url)
        return markupsafe.Markup("""<p><b>%s</b></p><p>%s <a href="%s">%s</a></p>""") % (
            _("You have insufficient credits to send this document!"),
            _("Please buy more credits and retry: "),
            url,
            _("Buy Credits")
        )

    @api.model
    def _l10n_in_validate_partner(self, partner):
        message = []
        if not re.match("^.{3,100}$", partner.street or ""):
            message.append(_("\n- Street required min 3 and max 100 characters"))
        if partner.street2 and not re.match("^.{3,100}$", partner.street2):
            message.append(_("\n- Street2 should be min 3 and max 100 characters"))
        if not re.match("^.{3,100}$", partner.city or ""):
            message.append(_("\n- City required min 3 and max 100 characters"))
        if not re.match("^.{3,50}$", partner.state_id.name or ""):
            message.append(_("\n- State required min 3 and max 50 characters"))
        if partner.country_id.code == "IN" and not re.match("^[0-9]{6,}$", partner.zip or ""):
            message.append(_("\n- Zip code required 6 digits"))
        if partner.phone and not re.match("^[0-9]{10,12}$",
            self._l10n_in_edi_extract_digits(partner.phone)
        ):
            message.append(_("\n- Mobile number should be minimum 10 or maximum 12 digits"))
        if partner.email and (
            not re.match(r"^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$", partner.email)
            or not re.match("^.{6,100}$", partner.email)
        ):
            message.append(_("\n- Email address should be valid and not more then 100 characters"))
        if message:
            message.insert(0, _("Partner %s is not valid. Please check below points:") % (partner.name))
        return message

    @api.model
    def _l10n_in_round_value(self, amount, precision_digits=2):
        """
            This method is call for rounding.
            If anything is wrong with rounding then we quick fix in method
        """
        value = round(amount, precision_digits)
        # avoid -0.0
        return value if value else 0.0

    @api.model
    def _l10n_in_edi_extract_digits(self, string):
        if not string:
            return string
        matches = re.findall(r"\d+", string)
        result = "".join(matches)
        return result

    @api.model
    def _get_l10n_in_tax_details_by_line_code(self, tax_details):
        l10n_in_tax_details = {}
        for tax_detail in tax_details.values():
            if tax_detail["tax"].l10n_in_reverse_charge:
                l10n_in_tax_details.setdefault("is_reverse_charge", True)
            l10n_in_tax_details.setdefault("%s_rate" % (tax_detail["line_code"]), tax_detail["tax"].amount)
            l10n_in_tax_details.setdefault("%s_amount" % (tax_detail["line_code"]), 0.00)
            l10n_in_tax_details.setdefault("%s_amount_currency" % (tax_detail["line_code"]), 0.00)
            l10n_in_tax_details["%s_amount" % (tax_detail["line_code"])] += tax_detail["tax_amount"]
            l10n_in_tax_details["%s_amount_currency" % (tax_detail["line_code"])] += tax_detail["tax_amount_currency"]
        return l10n_in_tax_details

    @api.model
    def _l10n_in_prepare_edi_tax_details(self, move, in_foreign=False, filter_invl_to_apply=None):
        def l10n_in_grouping_key_generator(base_line, tax_values):
            invl = base_line['record']
            tax = tax_values['tax_repartition_line'].tax_id
            tags = tax_values['tax_repartition_line'].tag_ids
            line_code = "other"
            if not invl.currency_id.is_zero(tax_values['tax_amount_currency']):
                if any(tag in tags for tag in self.env.ref("l10n_in.tax_tag_cess")):
                    if tax.amount_type != "percent":
                        line_code = "cess_non_advol"
                    else:
                        line_code = "cess"
                elif any(tag in tags for tag in self.env.ref("l10n_in.tax_tag_state_cess")):
                    if tax.amount_type != "percent":
                        line_code = "state_cess_non_advol"
                    else:
                        line_code = "state_cess"
                else:
                    for gst in ["cgst", "sgst", "igst"]:
                        if any(tag in tags for tag in self.env.ref("l10n_in.tax_tag_%s"%(gst))):
                            line_code = gst
            return {
                "tax": tax,
                "base_product_id": invl.product_id,
                "tax_product_id": invl.product_id,
                "base_product_uom_id": invl.product_uom_id,
                "tax_product_uom_id": invl.product_uom_id,
                "line_code": line_code,
            }

        def l10n_in_filter_to_apply(base_line, tax_values):
            if base_line['record'].display_type == 'rounding':
                return False
            return True

        return move._prepare_edi_tax_details(
            filter_to_apply=l10n_in_filter_to_apply,
            grouping_key_generator=l10n_in_grouping_key_generator,
            filter_invl_to_apply=filter_invl_to_apply,
        )

    def _indian_timezone_to_odoo_utc(self, str_date, format="%Y-%m-%d %H:%M:%S"):
        """
            This method is used to convert date from Indian timezone to UTC
        """
        tz = pytz.timezone("Asia/Kolkata")
        local_time = tz.localize(fields.Datetime.to_datetime(str_date, format=format))
        utc_time = local_time.astimezone(pytz.utc)
        return fields.Datetime.to_string(utc_time)