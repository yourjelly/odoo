from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10ntr_area_id = fields.Many2one(comodel_name='l10n_tr.area', compute="_compute_l10ntr_area_id", readonly=False,
                                     domain="[('district_id','=?',l10ntr_district_id),"
                                            "('district_id.state_id','=?',state_id)]")
    l10ntr_district_id = fields.Many2one(comodel_name='l10n_tr.district', compute="_compute_l10ntr_district_id",
                                         readonly=False, domain="[('state_id','=?',state_id)]")
    l10ntr_neighborhood_id = fields.Many2one(comodel_name='l10n_tr.neighborhood',
                                             domain="[('area_id','=?',l10ntr_area_id),"
                                                    "('area_id.district_id','=?',l10ntr_district_id),"
                                                    "('area_id.district_id.state_id','=?',state_id)]"
                                             )
    l10ntr_tax_office_id = fields.Many2one(comodel_name='l10n_tr.tax_office', domain="[('state_id','=?',state_id)]")

    @api.model
    def _address_fields(self):
        return super()._address_fields() + ['l10ntr_area_id', 'l10ntr_district_id', 'l10ntr_neighborhood_id',
                                            'l10ntr_tax_office_id']

    @api.model
    def _commercial_fields(self):
        return super()._commercial_fields() + ['l10ntr_tax_office_id']

    def _prepare_display_address(self, without_company=False):
        address_format, args = super()._prepare_display_address(without_company=without_company)

        args.update({
            'district_name': self.l10ntr_district_id.name or '',
            'area_name': self.l10ntr_area_id.name or '',
            'neighborhood_name': self.l10ntr_neighborhood_id.name or '',
        })
        return address_format, args

    def _display_address_depends(self):
        # Not sure if it works properly
        return super()._display_address_depends() + [
            'l10ntr_district_id', 'l10ntr_area_id', 'l10ntr_neighborhood_id'
        ]

    # logic: if state, district or area are not set, setting neighborhood will set them respectfully
    # if any of them is filled, the domains are limited by them
    @api.onchange('l10ntr_district_id', 'l10ntr_area_id')
    def _update_city(self):
        area = self.l10ntr_area_id.name or ''
        district = self.l10ntr_district_id.name or ''
        self.city = district if area == district else f"{area} {district}"
        if self.l10ntr_area_id:
            self.zip = self.l10ntr_area_id.zipcode
        if self.l10ntr_district_id:
            self.state_id = self.l10ntr_district_id.state_id

    @api.depends("l10ntr_area_id")
    def _compute_l10ntr_district_id(self):
        for rec in self:
            if rec.l10ntr_area_id and rec.l10ntr_district_id != rec.l10ntr_area_id.district_id:
                rec.l10ntr_district_id = rec.l10ntr_area_id.district_id

    @api.depends('l10ntr_neighborhood_id')
    def _compute_l10ntr_area_id(self):
        for rec in self:
            if rec.l10ntr_neighborhood_id and rec.l10ntr_area_id != rec.l10ntr_neighborhood_id.area_id:
                rec.l10ntr_area_id = rec.l10ntr_neighborhood_id.area_id
