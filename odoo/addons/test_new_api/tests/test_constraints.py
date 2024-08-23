from odoo.tests import TransactionCase


class TestConstraints(TransactionCase):

    def test_cyclic_constraint_in_computed_field(self):
        record = self.env['test_new_api.cyclic.compute_validation'].create({})
        record.invalidate_recordset()

        # Changing the name invalidates 'company_id'.
        # It triggers `_validate_country` first.
        # It calls `_compute_country_id`.
        # When accessing 'company_id', it calls '_compute_company_id'.
        # Because of:
        #
        # def _compute_field_value(self, field):
        #     fields.determine(field.compute, self)
        #
        #     if field.store and any(self._ids):
        #         # check constraints of the fields that have been computed
        #         fnames = [f.name for f in self.pool.field_computed[field]]
        #         self.filtered('id')._validate_fields(fnames)
        #
        # '_validate_country' is triggered again. However, 'country_id' is protected.
        # Therefore, 'False' is returned and the constraint fails.
        record.name = 'turlututu'
