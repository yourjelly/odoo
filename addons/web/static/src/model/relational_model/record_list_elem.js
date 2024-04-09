import { Record } from "./record";

export class RecordListElem extends Record {
    static type = "RecordListElem";

    setup(config, data, options = {}) {
        super.setup(config, data, options);
        this.isFolded = true;
        this.children = [];
        this.indentLevel = 0;
    }

    async toggleChildren(){
        this.isFolded = !this.isFolded;
        const configChildDomain = Object.assign({}, this.model.root._config);
        configChildDomain.domain = [['parent_id', '=', this.data.id], ['is_closed', '=', false]];
        const children = await this.model._loadUngroupedList(configChildDomain);
        this.children = children.records.map((c) => this.model.root._createRecordDatapoint(c));
        for (const childId in this.children) {
            this.children[childId].indentLevel = this.indentLevel + 1;
        }
    }
}