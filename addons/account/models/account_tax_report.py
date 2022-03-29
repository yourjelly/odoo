# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.osv import expression


class AccountTaxReport(models.Model): # TODO OCO virer
    _name = "account.tax.report"
    _description = 'Account Tax Report'
    _order = 'country_id, name'

    name = fields.Char(string="Name", required=True, help="Name of this tax report")
    country_id = fields.Many2one(string="Country", comodel_name='res.country', required=True, default=lambda x: x.env.company.country_id.id, help="Country for which this report is available.")
    line_ids = fields.One2many(string="Report Lines", comodel_name='account.tax.report.line', inverse_name='report_id', help="Content of this tax report")
    root_line_ids = fields.One2many(string="Root Report Lines", comodel_name='account.tax.report.line', inverse_name='report_id', domain=[('parent_id', '=', None)], help="Subset of line_ids, containing the lines at the root of the report.")


    def copy(self, default=None):
        # Overridden from regular copy, since the ORM does not manage
        # the copy of the lines hierarchy properly (all the parent_id fields
        # need to be reassigned to the corresponding copies).

        copy_default = {k:v for k, v in default.items() if k != 'line_ids'} if default else None
        copied_report = super(AccountTaxReport, self).copy(default=copy_default) #This copies the report without its lines

        lines_map = {} # maps original lines to their copies (using ids)
        lines_to_treat = list(self.line_ids.filtered(lambda x: not x.parent_id))
        while lines_to_treat:
            line = lines_to_treat.pop()
            lines_to_treat += list(line.children_line_ids)

            copy = line.copy({'parent_id': lines_map.get(line.parent_id.id, None), 'report_id': copied_report.id})
            lines_map[line.id] = copy.id

        return copied_report

    def get_lines_in_hierarchy(self): #TODO OCO sans doute à généraliser, et le flatten de las se chargera de liquider ça comme il faut
        """ Returns an interator to the lines of this tax report, were parent lines
        ar all directly followed by their children.
        """
        self.ensure_one()
        lines_to_treat = list(self.line_ids.filtered(lambda x: not x.parent_id).sorted(lambda x: x.sequence)) # Used as a stack, whose index 0 is the top
        while lines_to_treat:
            to_yield = lines_to_treat[0]
            lines_to_treat = list(to_yield.children_line_ids.sorted(lambda x: x.sequence)) + lines_to_treat[1:]
            yield to_yield


class AccountTaxReportLine(models.Model): # TODO OCO virer
    _name = "account.tax.report.line"
    _description = 'Account Tax Report Line'
    _order = 'sequence'
    _parent_store = True

    name = fields.Char(
        string="Name",
        required=True,
        help="Complete name for this report line, to be used in report.",
    )
    report_action_id = fields.Many2one(
        string="Report Action",
        comodel_name="ir.actions.act_window",
        help="The optional action to call when clicking on this line in accounting reports.",
    )
    children_line_ids = fields.One2many(
        string="Children Lines",
        comodel_name="account.tax.report.line",
        inverse_name="parent_id",
        help="Lines that should be rendered as children of this one",
    )
    parent_id = fields.Many2one(
        string="Parent Line",
        comodel_name="account.tax.report.line"
    )
    sequence = fields.Integer(
        string="Sequence",
        required=True,
        help="Sequence determining the order of the lines in the report (smaller ones come first). "
             "This order is applied locally per section "
             "(so, children of the same line are always rendered one after the other).",
    )
    parent_path = fields.Char(index=True, unaccent=False)
    report_id = fields.Many2one(
        string="Tax Report",
        comodel_name="account.tax.report",
        compute='_compute_report_id',
        required=True,
        store=True,
        readonly=False,
        recursive=True,
        ondelete="cascade",
        help="The parent tax report of this line",
    )

    # helper to create tags (positive and negative) on report line creation
    tag_name = fields.Char(
        string="Tag Name",
        help="Short name for the tax grid corresponding to this report line. "
             "Leave empty if this report line should not correspond to any such grid.",
    )

    # fields used in specific localization reports,
    # where a report line isn't simply the given by the sum of account.move.line with selected tags
    code = fields.Char(
        string="Code", help="Optional unique code to refer to this line in total formulas"
    )
    formula = fields.Char(
        string="Formula",
        help="Python expression used to compute the value of a total line. "
             "This field is mutually exclusive with tag_name, setting it turns the line to a total line. "
             "Tax report line codes can be used as variables in this expression "
             "to refer to the balance of the corresponding lines in the report. "
             "A formula cannot refer to another line using a formula.",
    )

    # fields used to carry over amounts between periods

    # The selection should be filled in localizations using the system
    carry_over_condition_method = fields.Selection(
        selection=[
            ('no_negative_amount_carry_over_condition', 'No negative amount'),
            ('always_carry_over_and_set_to_0', 'Always carry over and set to 0'),
        ],
        string="Method",
        help="The method used to determine if this line should be carried over."
    )
    carry_over_destination_line_id = fields.Many2one(
        string="Destination",
        comodel_name="account.tax.report.line",
        domain="[('report_id', '=', report_id)]",
        help="The line to which the value of this line will be carried over to if needed."
             " If left empty the line will carry over to itself."
    )
    is_carryover_persistent = fields.Boolean(
        string="Persistent",
        help="Defines how this report line creates carry over lines when performing tax closing. "
             "If true, the amounts carried over will always be added on top of each other: "
             "for example, a report line with a balance of 10 with an existing carryover of 50 "
             "will add an additional 10 to it when doing the closing, making a total carryover of 60. "
             "If false, the total carried over amount will be forced to the total of this report line: "
             "a report line with a balance of 10 with an existing carryover of 50 will create a new "
             "carryover line of -40, so that the total carryover becomes 10.",
        default=True,
    )
    is_carryover_used_in_balance = fields.Boolean(
        string="Used in line balance",
        help="If set, the carryover amount for this line will be used when calculating its balance in the report. "
             "This means that the carryover could affect other lines if they are using this one in their computation."
    )

    @api.constrains('formula', 'tag_name')
    def _validate_formula(self):
        for record in self:
            if record.formula and record.tag_name:
                raise ValidationError(_("Tag name and formula are mutually exclusive, they should not be set together on the same tax report line."))

    @api.constrains('tag_name', 'tag_ids')
    def _validate_tags(self):
        for record in self.filtered(lambda x: x.tag_ids):
            neg_tags = record.tag_ids.filtered(lambda x: x.tax_negate)
            pos_tags = record.tag_ids.filtered(lambda x: not x.tax_negate)

            if (len(neg_tags) != 1 or len(pos_tags) != 1):
                raise ValidationError(_("If tags are defined for a tax report line, only two are allowed on it: a positive and a negative one."))

            if neg_tags.name != '-'+record.tag_name or pos_tags.name != '+'+record.tag_name:
                raise ValidationError(_("The tags linked to a tax report line should always match its tag name."))
