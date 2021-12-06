
import logging
from odoo import api, fields, models, tools, SUPERUSER_ID, _, Command

_logger = logging.getLogger(__name__)


class Worst(models.Model):
    """ User class. A res.users record models an OpenERP user and is different
        from an employee.

        res.users class now inherits from res.partner. The partner model is
        used to store the data related to the partner: lang, name, address,
        avatar, ... The user model is now dedicated to technical data.
    """
    _name = "worst.case"
    _description = 'Worst case model'

    field_0 = fields.Char()
    field_1 = fields.Char()
    field_2 = fields.Char()
    field_3 = fields.Char()
    field_4 = fields.Char()
    field_5 = fields.Char()
    field_6 = fields.Char()
    field_7 = fields.Char()
    field_8 = fields.Char()
    field_9 = fields.Char()
    field_10 = fields.Char()
    field_11 = fields.Char()
    field_12 = fields.Char()
    field_13 = fields.Char()
    field_14 = fields.Char()
    field_15 = fields.Char()
    field_16 = fields.Char()
    field_17 = fields.Char()
    field_18 = fields.Char()
    field_19 = fields.Char()
    field_20 = fields.Char()
    field_21 = fields.Char()
    field_22 = fields.Char()
    field_23 = fields.Char()
    field_24 = fields.Char()
    field_25 = fields.Char()
    field_26 = fields.Char()
    field_27 = fields.Char()
    field_28 = fields.Char()
    field_29 = fields.Char()
    field_30 = fields.Char()
    field_31 = fields.Char()
    field_32 = fields.Char()
    field_33 = fields.Char()
    field_34 = fields.Char()
    field_35 = fields.Char()
    field_36 = fields.Char()
    field_37 = fields.Char()
    field_38 = fields.Char()
    field_39 = fields.Char()
    field_40 = fields.Char()
    field_41 = fields.Char()
    field_42 = fields.Char()
    field_43 = fields.Char()
    field_44 = fields.Char()
    field_45 = fields.Char()
    field_46 = fields.Char()
    field_47 = fields.Char()
    field_48 = fields.Char()
    field_49 = fields.Char()
    field_50 = fields.Char()
    field_51 = fields.Char()
    field_52 = fields.Char()
    field_53 = fields.Char()
    field_54 = fields.Char()
    field_55 = fields.Char()
    field_56 = fields.Char()
    field_57 = fields.Char()
    field_58 = fields.Char()
    field_59 = fields.Char()
    field_60 = fields.Char()
    field_61 = fields.Char()
    field_62 = fields.Char()
    field_63 = fields.Char()
    field_64 = fields.Char()
    field_65 = fields.Char()
    field_66 = fields.Char()
    field_67 = fields.Char()
    field_68 = fields.Char()
    field_69 = fields.Char()
    field_70 = fields.Char()
    field_71 = fields.Char()
    field_72 = fields.Char()
    field_73 = fields.Char()
    field_74 = fields.Char()
    field_75 = fields.Char()
    field_76 = fields.Char()
    field_77 = fields.Char()
    field_78 = fields.Char()
    field_79 = fields.Char()
    field_80 = fields.Char()
    field_81 = fields.Char()
    field_82 = fields.Char()
    field_83 = fields.Char()
    field_84 = fields.Char()
    field_85 = fields.Char()
    field_86 = fields.Char()
    field_87 = fields.Char()
    field_88 = fields.Char()
    field_89 = fields.Char()
    field_90 = fields.Char()
    field_91 = fields.Char()
    field_92 = fields.Char()
    field_93 = fields.Char()
    field_94 = fields.Char()
    field_95 = fields.Char()
    field_96 = fields.Char()
    field_97 = fields.Char()
    field_98 = fields.Char()
    field_99 = fields.Char()

    def _populate(self, size):
        from itertools import cycle
        batch_size_possibility = cycle(([1] * 10) + ([3] * 10) + ([5] * 10) + ([10] * 10) + ([101] * 10) + ([1000] * 10))
        batch_size = next(batch_size_possibility)
        min_size = 50000

        record_count = 0
        create_values = []

        records_batches = []
        while record_count <= min_size:
            values = {
                f'field_{record_count % batch_size % 100}': str(record_count)
            }
            create_values.append(values)
            record_count += 1
            if len(create_values) >= batch_size:
                _logger.info('Batch: %s/%s', record_count, min_size)
                records_batches.append(self.create(create_values))
                create_values = []
                batch_size = next(batch_size_possibility)

        if create_values:
            records_batches.append(self.create(create_values))
        return self.concat(*records_batches)