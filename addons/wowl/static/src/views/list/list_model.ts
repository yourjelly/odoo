import { DomainListRepr } from "../../core/domain";
import { ModelBuilder } from "../../services/model";
import { ViewData } from "../view_utils/hooks";

interface LoadOptions {
  limit?: number;
}

export class ListModel {
  _model: ModelBuilder;
  records: any[] = [];
  info: ViewData;
  fields: any[];
  columns: string[];

  constructor(model: ModelBuilder, info: ViewData, fields: any[]) {
    this._model = model;
    this.info = info;
    this.fields = fields;
    this.columns = this.fields
      .filter((f) => !f.invisible && f.optional !== "hide")
      .map((f) => f.name);
  }

  async load(domain: DomainListRepr, options: LoadOptions = {}) {
    const { modelName } = this.info;
    const fields = this.fields
      .filter((f) => !f.invisible && f.optional !== "hide")
      .map((f) => f.name);
    const result = await this._model(modelName).webSearchRead(domain, fields, {
      limit: options.limit,
    });
    this.records = result.records;
  }
}
