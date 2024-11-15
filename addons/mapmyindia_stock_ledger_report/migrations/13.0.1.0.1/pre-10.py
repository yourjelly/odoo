import logging
import os

from odoo import SUPERUSER_ID, api
from odoo.addons.mapmyindia_stock_ledger_report.migrations import util

_logger = logging.getLogger(__name__)


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})

    # query = "INSERT INTO ir_module_module (name, state, latest_version) VALUES ('mapmyindia_stock_ledger_report', 'installed', '14.0.0.0.1');"
    # raise Exception("You need first to execute this query in staging and production : \n%s" % query)

    if "ODOO_STAGE" in os.environ and os.environ["ODOO_STAGE"] == "dev":
        _logger.info("Exit migration script : dev env database !")
        return ""

    _logger.info("######################### Begin pre_10 #########################")

    _logger.info("----------RENAME MODELS----------")

    to_rename_models = (("x_wizard_stock_ledger", "wizard.stock.ledger", True),)

    for model in to_rename_models:
        _logger.info("rename model : %s -> %s" % (model[0], model[1]))

        cr.execute("UPDATE ir_model SET state='base' WHERE model LIKE %s", [model[0]])
        util.rename_model(cr, model[0], model[1], rename_table=model[2])

    _logger.info("----------RENAME FIELDS----------")

    to_rename_fields = (
        ("wizard.stock.ledger", "x_datas", "datas"),
        ("wizard.stock.ledger", "x_datas_fname", "datas_fname"),
        ("wizard.stock.ledger", "x_name", "name"),
        ("wizard.stock.ledger", "x_from_date", "from_date"),
        ("wizard.stock.ledger", "x_to_date", "to_date"),
        ("wizard.stock.ledger", "x_location_ids", "location_ids"),
        ("wizard.stock.ledger", "x_product_categ_ids", "product_categ_ids"),
        ("wizard.stock.ledger", "x_product_ids", "product_ids"),
        ("wizard.stock.ledger", "x_based_on", "based_on"),
        ("wizard.stock.ledger", "x_report_type", "report_type"),
    )

    for field in to_rename_fields:
        _logger.info("rename field : %s -> %s on model %s" % (field[1], field[2], field[0]))

        cr.execute(
            "UPDATE ir_model_fields SET state='base' WHERE name LIKE %s AND model LIKE %s", [field[1], field[0]]
        )
        util.rename_field(cr, field[0], field[1], field[2])

    _logger.info("----------REMOVE VIEW----------")
