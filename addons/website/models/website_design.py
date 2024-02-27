from odoo import models, fields, api

NOT_DESIGN_FIELDS = ['id', 'display_name', 'create_uid', 'create_date', 'write_uid', 'write_date', 'website_id',
                     'forced_logo_height']


class WebsiteDesign(models.Model):
    _name = 'website.design'
    _description = 'Website Design'
    website_id = fields.Many2one('website', string='Website', ondelete='cascade')

    # DESIGN VARIABLES

    paragraph_margin_top = fields.Char(string='Paragraph Margin Top', default='0')
    paragraph_margin_bottom = fields.Char(string='Paragraph Margin Bottom', default='16px')

    display_1_font_size = fields.Char(string='Display 1 Font Size', default='5rem')
    display_2_font_size = fields.Char(string='Display 2 Font Size', default='4.5rem')
    display_3_font_size = fields.Char(string='Display 3 Font Size', default='4rem')
    display_4_font_size = fields.Char(string='Display 4 Font Size', default='3.5rem')

    btn_primary_outline_border_width = fields.Char(string='Primary Button Outline Border Width', default='0.06rem')
    btn_secondary_outline_border_width = fields.Char(string='Secondary Button Outline Border Width', default='0.06rem')
    btn_padding_y = fields.Char(string='Button Padding Y', default='0.4rem')
    btn_padding_x = fields.Char(string='Button Padding X', default='1rem')
    btn_font_size = fields.Char(string='Button Font Size', default='1rem')
    btn_padding_y_sm = fields.Char(string='Button Padding Y SM', default='0.06rem')
    btn_padding_x_sm = fields.Char(string='Button Padding X SM', default='0.5rem')
    btn_font_size_sm = fields.Char(string='Button Font Size SM', default='0.8rem')
    btn_padding_y_lg = fields.Char(string='Button Padding Y LG', default='1rem')
    btn_padding_x_lg = fields.Char(string='Button Padding X LG', default='3rem')
    btn_font_size_lg = fields.Char(string='Button Font Size LG', default='1.3rem')
    btn_border_radius = fields.Char(string='Button Border Radius', default='1rem')
    btn_border_radius_sm = fields.Char(string='Button Border Radius SM', default='0.3rem')
    btn_border_radius_lg = fields.Char(string='Button Border Radius LG', default='2rem')
    # btn-border-width is not customizable via the theme option but there are themes that use it.
    # Shouldn't we delete it ?

    input_padding_y = fields.Char(string='Input Padding Y', default='6px')
    input_padding_x = fields.Char(string='Input Padding X', default='12px')
    input_font_size = fields.Char(string='Input Font Size', default='16px')
    input_padding_y_sm = fields.Char(string='Input Padding Y SM', default='4px')
    input_padding_x_sm = fields.Char(string='Input Padding X SM', default='8px')
    input_font_size_sm = fields.Char(string='Input Font Size SM', default='12px')
    input_padding_y_lg = fields.Char(string='Input Padding Y LG', default='8px')
    input_padding_x_lg = fields.Char(string='Input Padding X LG', default='16px')
    input_font_size_lg = fields.Char(string='Input Font Size LG', default='20px')
    input_border_width = fields.Char(string='Input Border Width', default='1px')
    input_border_radius = fields.Char(string='Input Border Radius', default='6.4px')
    input_border_radius_sm = fields.Char(string='Input Border Radius SM', default='4.8px')
    input_border_radius_lg = fields.Char(string='Input Border Radius LG', default='9.6px')

    headings_line_height = fields.Char(string='Headings Line Height', default='1.2')
    headings_margin_top = fields.Char(string='Headings Margin Top', default='0')
    headings_margin_bottom = fields.Char(string='Headings Margin Bottom', default='0.5rem')

    body_line_height = fields.Char(string='Body Line Height', default='1.5')
    # Logo height requires two fields because it can be computed based on the
    # base font size or forced to a specific value.
    logo_height = fields.Char(
        string='Logo Height',
        compute='_compute_logo_height',
        inverse='_inverse_logo_height',
        default='null',
    )
    forced_logo_height = fields.Char(string='Forced Logo Height', default='null')
    font_size_base = fields.Char(string='Font Size Base', default='1rem')

    sidebar_width = fields.Char(string='Sidebar Width', default='18.75rem')

    def write(self, vals):
        res = super().write(vals)
        for record in self:
            record._customize_design_variables(vals)
        return res

    @api.model_create_multi
    def create(self, vals):
        records = super().create(vals)
        for record in records:
            default_style_vals = {field: record[field] for field in record._fields}
            record._customize_design_variables(default_style_vals)
        return records

    def _customize_design_variables(self, vals):
        """
        Customizes design variables.

        :param vals: dict of design variables to customize. The keys are the
            field names / SCSS variable names and the values are the new values.
        """
        if self.env.context.get('skip_customize_scss'):
            return
        vals = self._filter_design_variables(vals)
        self.env['web_editor.assets']\
            .with_context(website_id=self.website_id.id)\
            .make_scss_customization('/website/static/src/scss/options/user_values.scss', vals)

    def _filter_design_variables(self, vals):
        """
        Removes the keys in vals that are not design variables and replaces _
        by - in the keys to match the SCSS variable names.

        :param vals: dict of design variables to filter.
        :return: dict with only the keys that are design ones.
        """
        res = {}
        for key in vals:
            if key in NOT_DESIGN_FIELDS:
                continue
            # As python variable names cannot contains dashes, we replace them
            # by double underscores.
            res[key.replace('_', '-')] = vals[key]
        return res

    # Variables specific functions

    @api.depends('forced_logo_height', 'font_size_base')
    def _compute_logo_height(self):
        """
        Computes the logo height based on the font size or the forced height.
        """
        for record in self:
            if record.forced_logo_height != 'null':
                record.with_context(skip_customize_scss=True).logo_height = record.forced_logo_height
                return
            font_size_base = float(record.font_size_base.replace('rem', ''))
            # $font-size-base * $line-height-base + $nav-link-padding-y * 2;
            record.with_context(skip_customize_scss=True).logo_height = str(font_size_base * 1.5 + 0.5 * 2) + 'rem'

    def _inverse_logo_height(self):
        """Sets the forced logo height to the current logo height."""
        for record in self:
            record.with_context(skip_customize_scss=True).forced_logo_height = record.logo_height
