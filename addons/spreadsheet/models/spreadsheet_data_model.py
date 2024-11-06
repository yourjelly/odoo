
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class SpreadsheetDataModel(models.Model):
    _description = "Spreadsheet data model"
    _name = "spreadsheet.data.model"

    name = fields.Char()
    datasource_ids = fields.One2many(
        "spreadsheet.data.source", "data_model_id")
    global_filter_ids = fields.One2many(
        "spreadsheet.global.filter", "data_model_id")
    representation_ids = fields.One2many(
        related="datasource_ids.representation_ids")

    @api.model
    def create_data_model(self, data):
        data_model_id = self.create({"name": data.get("name")})
        data_sources = data.get("dataSources")
        data_sources_map_ids = {}
        for ds in data_sources:
            ir_model_id = self.env["ir.model"].search(
                [("model", "=", ds["model"])], limit=1
            )
            data_source_id = self.env["spreadsheet.data.source"].create(
                {
                    "ir_model_id": ir_model_id.id,
                    "data_model_id": data_model_id.id,
                }
            )
            data_sources_map_ids[ds["id"]] = data_source_id.id

        rep_map_ids = {}

        for rep in data.get("representations"):
            rep_id = self.env["spreadsheet.data.representation"].create({
                "datasource_id": data_sources_map_ids[rep["dataSourceId"]],
                "domain": rep["domain"],
                "type": rep["type"],
                "name": rep["name"],
            })
            rep_map_ids[rep["id"]] = rep_id.id

        gfs_map_ids = {}

        for gf in data.get("globalFilters"):
            if (gf.get("model")):
                ir_model_id = self.env["ir.model"].search(
                    [("model", "=", gf["model"])], limit=1
                )
            else:
                ir_model_id = False
            global_filter_id = self.env["spreadsheet.global.filter"].create(
                {
                    "ir_model_id": ir_model_id.id if ir_model_id else False,
                    "data_model_id": data_model_id.id,
                    "name": gf["name"],
                }
            )
            gfs_map_ids[gf["id"]] = global_filter_id.id

        for fm in data.get("fieldsMatching"):
            representation_id = False
            data_source_id = False
            if (fm.get("representationId")):
                rep_id = rep_map_ids[fm["representationId"]]
                representation_id = self.env["spreadsheet.data.representation"].browse(rep_id)
            else:
                data_source_id = self.env["spreadsheet.data.source"].browse(data_sources_map_ids[fm["dataSourceId"]])

            ir_model = (representation_id.datasource_id if representation_id else data_source_id).ir_model_id

            ir_model_field = self.env["ir.model.fields"].search(
                [("model_id", "=", ir_model.id), ("name", "=", fm["field"])], limit=1
            )

            self.env["spreadsheet.field.matching"].create(
                {
                    "global_filter_id": gfs_map_ids[fm["globalFilterId"]],
                    "ir_field_id": ir_model_field.id,
                    "representation_id": representation_id.id if representation_id else False,
                    "datasource_id": data_source_id.id if data_source_id else False,
                }
            )

        return True


class SpreadsheetGlobalFilter(models.Model):
    _description = "Spreadsheet global filter"
    _name = "spreadsheet.global.filter"

    name = fields.Char()
    data_model_id = fields.Many2one("spreadsheet.data.model")
    ir_model_id = fields.Many2one("ir.model")
    field_matching_ids = fields.One2many(
        "spreadsheet.field.matching", "global_filter_id")


class SpreadsheetFieldMatching(models.Model):
    _description = "Spreadsheet field matching"
    _name = "spreadsheet.field.matching"

    global_filter_id = fields.Many2one("spreadsheet.global.filter")
    ir_field_id = fields.Many2one("ir.model.fields")
    representation_id = fields.Many2one("spreadsheet.data.representation")
    datasource_id = fields.Many2one("spreadsheet.data.source")


class SpreadsheetDataSource(models.Model):
    _description = "Spreadsheet data source"
    _name = "spreadsheet.data.source"
    _rec_name = "ir_model_id"

    ir_model_id = fields.Many2one("ir.model")
    data_model_id = fields.Many2one("spreadsheet.data.model")
    representation_ids = fields.One2many(
        "spreadsheet.data.representation", "datasource_id")


class SpreadsheetDataRepresentation(models.Model):
    _description = "Spreadsheet data representation"
    _name = "spreadsheet.data.representation"

    datasource_id = fields.Many2one("spreadsheet.data.source")
    domain = fields.Char()
    type = fields.Char()
    name = fields.Char()

    # rows = fields.Char()
    # columns = fields.Char()
    # measures = fields.Char()


# class SpreadsheetDataRepresentationPivot(models.Model):
#     _description = "Spreadsheet data representation pivot"
#     _name = "spreadsheet.data.representation.pivot"
#     _inherit = "spreadsheet.data.representation"

#     rows = fields.Char()
#     columns = fields.Char()
#     measures = fields.Char()


# class SpreadsheetDataRepresentationGraph(models.Model):
#     _description = "Spreadsheet data representation graph"
#     _name = "spreadsheet.data.representation.graph"
#     _inherit = "spreadsheet.data.representation"


# class SpreadsheetDataRepresentationList(models.Model):
#     _description = "Spreadsheet data representation list"
#     _name = "spreadsheet.data.representation.list"
#     _inherit = "spreadsheet.data.representation"

#     columns = fields.Char()
