/* @odoo-module */

import { x2ManyCommands } from "@web/core/orm_service";
import { DataPoint } from "./datapoint";

let nextId = 0;
function getNextVirtualId() {
    return `virtual_${++nextId}`;
}

export class StaticList extends DataPoint {
    setup(params) {
        this._parent = params.parent;
        this._onChange = params.onChange;
        this.orderBy = params.orderBy || [];
        this.limit = params.limit || 40;
        this.offset = params.offset || 0;
        this.resIds = params.data.map((r) => r.id);
        this.records = params.data
            .slice(this.offset, this.limit)
            .map((r) => this._createRecordDatapoint(r));
        this._commands = [];
        this.count = this.resIds.length;
        this.context = {}; // FIXME: should receive context (remove this when it does, see datapoint.js)
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    get currentIds() {
        return this.records.map((r) => r.resId);
    }

    get editedRecord() {
        return this.records.find((record) => record.isInEdition);
    }

    get evalContext() {
        return {
            parent: this._parent.evalContext,
        };
    }

    // -------------------------------------------------------------------------
    // Public
    // -------------------------------------------------------------------------

    async addNew(params) {
        const values = await this.model._loadNewRecord({
            resModel: this.resModel,
            activeFields: this.activeFields,
            context: Object.assign(this.context, params.context),
        });
        const record = this._createRecordDatapoint(values, "edit");
        if (params.position === "bottom") {
            this.records.push(record);
        } else {
            this.records.unshift(record);
        }
        this._commands.push([x2ManyCommands.CREATE, getNextVirtualId(), record]);
        this._onChange();
    }

    canResequence() {
        return false;
    }

    load({ limit, offset }) {
        limit = limit !== undefined ? limit : this.limit;
        offset = offset !== undefined ? offset : this.offset;
        this.model.mutex.exec(() => this._load({ limit, offset }));
    }

    unselectRecord() {
        if (this.editedRecord) {
            this.editedRecord.switchMode("readonly");
        }
        return true;
    }

    // -------------------------------------------------------------------------
    // Protected
    // -------------------------------------------------------------------------

    _applyCommands(commands) {
        for (const command of commands) {
            switch (command[0]) {
                case x2ManyCommands.CREATE: {
                    const record = this._createRecordDatapoint(command[2]);
                    this.records.push(record);
                    this._commands.push([x2ManyCommands.CREATE, getNextVirtualId(), record]);
                    break;
                }
                case x2ManyCommands.UPDATE: {
                    const existingCommand = this._commands.find((c) => c[1] === command[1]);
                    let record;
                    if (existingCommand) {
                        record = existingCommand[2];
                    } else {
                        record = this.records.find((record) => record.resId === command[1]);
                        if (!record) {
                            throw new Error(`Can't find record ${command[1]}`);
                        }
                        this._commands.push([x2ManyCommands.UPDATE, command[1], record]);
                    }
                    record._applyChanges(record._applyServerValues(command[2], record.data));
                    break;
                }
                case x2ManyCommands.DELETE: {
                    // TODO
                    break;
                }
                case x2ManyCommands.FORGET: {
                    // TODO
                    break;
                }
                case x2ManyCommands.LINK_TO: {
                    // TODO (needs unity + onchange2)
                    // const record = this._createRecordDatapoint(command[2]);
                    // this.records.push(record);
                    // this._commands.push([command[0], command[1]]);
                    break;
                }
                case x2ManyCommands.DELETE_ALL: {
                    // TODO
                    this.records = [];
                    break;
                }
                case x2ManyCommands.REPLACE_WITH: {
                    // TODO (needs unity + onchange2)
                    break;
                }
            }
        }
    }

    _createRecordDatapoint(data, mode = "readonly") {
        return new this.model.constructor.Record(this.model, {
            context: this.context,
            activeFields: this.activeFields,
            resModel: this.resModel,
            fields: this.fields,
            parentRecord: this._parent,
            data,
            mode,
            onChange: this._onChange,
        });
    }

    _getCommands() {
        // TODO: encapsulate commands in a class?
        return this._commands.map((c) => {
            if (c[2]) {
                return [c[0], c[1], c[2]._getChanges()];
            }
            return [c[0], c[1]];
        });
    }

    async _load({ limit, offset }) {
        const resIds = this.resIds.slice(offset, offset + limit);
        const records = await this.model._loadRecords({
            activeFields: this.activeFields,
            context: this.context,
            fields: this.fields,
            resIds,
            resModel: this.resModel,
        });
        // FIXME: might need to keep references to the records of previous page (for changes)
        this.records = records.map((r) => this._createRecordDatapoint(r));
        this.offset = offset;
        this.limit = limit;
    }
}
StaticList.DEFAULT_LIMIT = 40;
