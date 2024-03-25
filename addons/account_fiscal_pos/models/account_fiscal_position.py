from odoo import api, models, _
from odoo.exceptions import ValidationError

class AccountFiscalPosition(models.Model):
    _inherit = 'account.fiscal.position'

    @api.constrains('country_id', 'country_group_id', 'state_ids', 'foreign_vat')
    def _validate_foreign_vat_country(self):
        for record in self:
            if record.foreign_vat:
                if record.country_id == record.company_id.account_fiscal_country_id:
                    if record.foreign_vat == record.company_id.vat:
                        raise ValidationError(_("You cannot create a fiscal position within your fiscal country with the same VAT number as the main one set on your company."))

                    if not record.state_ids:
                        if record.company_id.account_fiscal_country_id.state_ids:
                            raise ValidationError(_("You cannot create a fiscal position with a foreign VAT within your fiscal country without assigning it a state."))
                        else:
                            raise ValidationError(_("You cannot create a fiscal position with a foreign VAT within your fiscal country."))

                similar_fpos_domain = [
                    ('foreign_vat', '!=', False),
                    ('company_id', '=', record.company_id.id),
                    ('id', '!=', record.id),
                ]

                if record.country_group_id:
                    foreign_vat_country_id = next(country_id for country_id in self.country_group_id.country_ids if country_id.code.upper() == self.foreign_vat[:2])
                    similar_fpos_domain += [('country_group_id', '=', record.country_group_id.id), ('country_id', '=', foreign_vat_country_id.id)]
                elif record.country_id:
                    similar_fpos_domain += [('country_id', '=', record.country_id.id), ('country_group_id', '=', False)]

                if record.state_ids:
                    similar_fpos_domain.append(('state_ids', 'in', record.state_ids.ids))
                else:
                    similar_fpos_domain.append(('state_ids', '=', False))

                similar_fpos_count = self.env['account.fiscal.position'].search_count(similar_fpos_domain)
                if similar_fpos_count:
                    raise ValidationError(_("A fiscal position with a foreign VAT already exists in this region."))

    @api.constrains('country_id', 'foreign_vat')
    def _validate_foreign_vat(self):
        for record in self:
            if not record.foreign_vat:
                continue

            if record.country_id and not record.country_group_id:
                checked_country_code = self.env['res.partner']._run_vat_test(record.foreign_vat, record.country_id)
                if checked_country_code and checked_country_code != record.country_id.code.lower():
                    raise ValidationError(_("The country detected for this foreign VAT number does not match the country on this fiscal position."))
                if not checked_country_code:
                    record.raise_vat_error_message()
            elif record.country_group_id:
                # Checks the foreign vat is a VAT Number linked to a country of the country group
                foreign_vat_country_id = next(country_id for country_id in self.country_group_id.country_ids if country_id.code.upper() == self.foreign_vat[:2])
                if not foreign_vat_country_id:
                    raise ValidationError(_("The country detected for this foreign VAT number does not match any of the countries composing the country group set on this fiscal position."))
                if not record.country_id:
                    # If no country is assigned then assign the country of the foreign vat
                    record.country_id = foreign_vat_country_id
                    checked_country_code = self.env['res.partner']._run_vat_test(record.foreign_vat, foreign_vat_country_id)
                    if not checked_country_code:
                        record.raise_vat_error_message(foreign_vat_country_id)

    def raise_vat_error_message(self, country=False):
        fp_label = _("fiscal position [%s]", self.name)
        country_code = country.code.lower() if country else self.country_id.code.lower()
        error_message = self.env['res.partner']._build_vat_error_message(country_code, self.foreign_vat, fp_label)
        raise ValidationError(error_message)
