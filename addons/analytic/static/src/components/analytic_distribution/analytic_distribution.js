/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService, useOwnedDialogs } from "@web/core/utils/hooks";
import { evaluateExpr } from "@web/core/py_js/py";
import { getNextTabableElement, getPreviousTabableElement } from "@web/core/utils/ui";
import { usePosition } from "@web/core/position_hook";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";
import { shallowEqual } from "@web/core/utils/arrays";
import { _t } from "@web/core/l10n/translation";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { useRecordObserver } from "@web/model/relational_model/utils";

import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { TagsList } from "@web/core/tags_list/tags_list";
import { useOpenMany2XRecord } from "@web/views/fields/relational_utils";
import { parseFloat as oParseFloat } from "@web/views/fields/parsers";
import { formatPercentage } from "@web/views/fields/formatters";
import { SelectCreateDialog } from "@web/views/view_dialogs/select_create_dialog";

import { Record } from "@web/views/record";
import { Many2ManyTagsField } from "@web/views/fields/many2many_tags/many2many_tags_field";
import { PercentageField } from "@web/views/fields/percentage/percentage_field";

const { Component, useState, useRef, useExternalListener, onWillStart, onPatched } = owl;

const PLAN_APPLICABILITY = {
    mandatory: _t("Mandatory"),
    optional: _t("Optional"),
}
const PLAN_STATUS = {
    invalid: _t("Invalid"),
    ok: _t("OK"),
}
export class AnalyticDistribution extends Component {
    setup(){
        this.orm = useService("orm");

        this.state = useState({
            showDropdown: false,
            list: {},
            formattedData: [],
        });

        this.widgetRef = useRef("analyticDistribution");
        this.dropdownRef = useRef("analyticDropdown");
        this.mainRef = useRef("mainElement");
        usePosition(() => this.widgetRef.el, {
            popper: "analyticDropdown",
        });

        this.nextId = 1;
        this.focusSelector = false;

        this.currentValue = this.props.record.data[this.props.name];

        onWillStart(this.willStart);
        useRecordObserver(this.willUpdateRecord.bind(this));
        onPatched(this.patched);

        useExternalListener(window, "click", this.onWindowClick, true);

        this.openTemplate = useOpenMany2XRecord({
            resModel: "account.analytic.distribution.model",
            activeActions: {
                create: true,
                edit: false,
                write: true,
            },
            isToMany: false,
            onRecordSaved: async (record) => {
                this.mainRef.el.focus();
            },
            onClose: () => {
                this.mainRef.el.focus();
            },
            fieldString: _t("Analytic Distribution Template"),
        });
        this.allPlans = [];
        this.lastAccount = this.props.account_field && this.props.record.data[this.props.account_field] || false;
        this.lastProduct = this.props.product_field && this.props.record.data[this.props.product_field] || false;

        this.selectCreateIsOpen = false;
        // this.addDialog = useOwnedDialogs();
        // this.onSearchMore = this._onSearchMore.bind(this);
    }

    // Lifecycle
    async willStart() {
        if (this.editingRecord) {
            await this.fetchAllPlans();
        }
        await this.formatData();
        await this.jsonToData();
    }

    async willUpdateRecord(record) {
        // Unless force_applicability, Plans need to be retrieved again as the product or account might have changed
        // and thus different applicabilities apply
        // or a model applies that contains unavailable plans
        // This should only execute when these fields have changed, therefore we use the `_field` props.
        const valueChanged =
            JSON.stringify(this.currentValue) !==
            JSON.stringify(record.data[this.props.name]);
        const currentAccount = this.props.account_field && record.data[this.props.account_field] || false;
        const currentProduct = this.props.product_field && record.data[this.props.product_field] || false;
        const accountChanged = !shallowEqual(this.lastAccount, currentAccount);
        const productChanged = !shallowEqual(this.lastProduct, currentProduct);
        if (valueChanged || accountChanged || productChanged) {
            if (!this.props.force_applicability) {
                await this.fetchAllPlans();
            }
            this.lastAccount = accountChanged && currentAccount || this.lastAccount;
            this.lastProduct = productChanged && currentProduct || this.lastProduct;
            await this.formatData();
        }
        this.currentValue = record.data[this.props.name];
    }

    patched() {
        this.focusToSelector();
    }

    async formatData() {
        const { record, name } = this.props;
        const data = record.data[name];
        const analytic_account_ids = Object.keys(data).map((id) => parseInt(id));
        const records = analytic_account_ids.length ? await this.fetchAnalyticAccounts([["id", "in", analytic_account_ids]]) : [];
        const widgetData = Object.assign({}, ...this.allPlans.map((plan) => ({ [plan.id]: { ...plan, distribution: [] } })));
        records.map((record) => {
            if (!widgetData[record.root_plan_id[0]]) {
                // plans might not have been retrieved
                widgetData[record.root_plan_id[0]] = { distribution: [] }
            }
            widgetData[record.root_plan_id[0]].distribution.push({
                analytic_account_id: record.id,
                percentage: data[record.id],
                id: this.nextId++,
                group_id: record.root_plan_id[0],
                analytic_account_name: record.display_name,
                color: record.color,
            });
        });

        this.state.list = widgetData;
        if (records.length < Object.keys(data).length) {
            // analytic accounts were not found for some keys in the json data, they may have been deleted
            // save the json without them
            this.save();
        }
    }

    // ORM
    fetchPlansArgs() {
        const { record, name } = this.props;
        let args = {};
        if (this.props.business_domain_compute) {
            args['business_domain'] = evaluateExpr(this.props.business_domain_compute, record.evalContext);
        }
        if (this.props.business_domain) {
            args['business_domain'] = this.props.business_domain;
        }
        if (this.props.product_field && record.data[this.props.product_field]) {
            args['product'] = record.data[this.props.product_field][0];
        }
        if (this.props.account_field && record.data[this.props.account_field]) {
            args['account'] = record.data[this.props.account_field][0];
        }
        if (this.props.force_applicability) {
            args['applicability'] = this.props.force_applicability;
        }
        const existing_account_ids = Object.keys(record.data[name]).map((i) => parseInt(i));
        if (existing_account_ids.length) {
            args['existing_account_ids'] = existing_account_ids;
        }
        if (record.data.company_id) {
            args['company_id'] = record.data.company_id[0];
        }
        return args;
    }

    async fetchAllPlans() {
        // TODO: Optimize to execute once for all records when `force_applicability` is set
        const argsPlan = this.fetchPlansArgs();
        this.allPlans = await this.orm.call("account.analytic.plan", "get_relevant_plans", [], argsPlan);
    }

    async fetchAnalyticAccounts(domain, limit=null) {
        // TODO: Fix this since it is no longer used by the Autocomplete component nor the search more (view all) dialog
        const args = {
            domain: domain,
            fields: ["id", "display_name", "root_plan_id", "color", "composition_ids"],
            context: [],
        }
        if (limit) {
            args['limit'] = limit;
        }
        if (domain.length === 1 && domain[0][0] === "id") {
            // args.domain = [...args.domain, ["composition_ids", "in", domain[0][2]]];
            //batch these orm calls
            return await this.props.record.model.orm.read("account.analytic.account", domain[0][2], args.fields, {context: {"fetch_composite_children": true}});
        } else {
            // Added this, to ensure that composite accounts are excluded, but I don't think it's used
            debugger;
            args.domain = [...args.domain, ["composition_ids", "=", false]];
        }
        return await this.orm.call("account.analytic.account", "search_read", [], args);
    }

    // Autocomplete
    sourcesAnalyticAccount(groupId) {
        return [this.optionsSourceAnalytic(groupId)];
    }

    optionsSourceAnalytic(groupId) {
        return {
            placeholder: _t("Loading..."),
            options:(searchTerm) => this.loadOptionsSourceAnalytic(groupId, searchTerm),
        };
    }

    // analyticAccountDomain(groupId=null) {
    //     let domain = [['id', 'not in', this.existingAnalyticAccountIDs]];
    //     if (this.props.record.data.company_id){
    //         domain.push(
    //             '|',
    //             ['company_id', '=', this.props.record.data.company_id[0]],
    //             ['company_id', '=', false]
    //         );
    //     }

    //     if (groupId) {
    //         domain.push(['root_plan_id', '=', groupId]);
    //     }
    //     return domain;
    // }

    // searchAnalyticDomain(searchTerm) {
    //     return [
    //         '|',
    //         ["name", "ilike", searchTerm],
    //         '|',
    //         ['code', 'ilike', searchTerm],
    //         ['partner_id', 'ilike', searchTerm],
    //     ];
    // }

    // async loadOptionsSourceAnalytic(groupId, searchTerm) {
    //     const searchLimit = 6;

    //     const records = await this.fetchAnalyticAccounts([
    //         ...this.analyticAccountDomain(groupId),
    //         ...this.searchAnalyticDomain(searchTerm)], searchLimit + 1);

    //     let options = records.map((result) => ({
    //         value: result.id,
    //         label: result.display_name,
    //         group_id: result.root_plan_id[0],
    //         color: result.color,
    //     }));

    //     if (searchLimit < records.length) {
    //         options.push({
    //             label: _t("Search More..."),
    //             action: (editedTag) => this.onSearchMore(searchTerm, editedTag),
    //             classList: "o_m2o_dropdown_option o_m2o_dropdown_option_search_more",
    //         });
    //     }

    //     if (!options.length) {
    //         options.push({
    //             label: _t("No Analytic Accounts for this plan"),
    //             classList: "o_m2o_no_result",
    //             unselectable: true,
    //         });
    //     }

    //     return options;
    // }

    // async _onSearchMore(searchTerm, editedTag) {
    //     let dynamicFilters = [];
    //     if (searchTerm.length) {
    //         dynamicFilters = [
    //             {
    //                 description: _t("Quick search: %s", searchTerm),
    //                 domain: this.searchAnalyticDomain(searchTerm),
    //             },
    //         ];
    //     }
    //     this.selectCreateIsOpen = true;
    //     this.addDialog(SelectCreateDialog, {
    //         title: _t("Search: Analytic Account"),
    //         noCreate: true,
    //         multiSelect: true,
    //         resModel: 'account.analytic.account',
    //         context: {
    //             tree_view_ref: "analytic.view_account_analytic_account_list_select",
    //         },
    //         domain: this.analyticAccountDomain(editedTag.group_id),
    //         dynamicFilters: dynamicFilters,
    //         onSelected: async (resIds) => {
    //             const analytic_accounts = await this.fetchAnalyticAccounts([["id", "in", resIds]]);
    //             // modify the edited tag
    //             editedTag.analytic_account_id = analytic_accounts[0].id;
    //             editedTag.analytic_account_name = analytic_accounts[0].display_name;
    //             this.setFocusSelector(`.tag_${editedTag.id} .o_analytic_percentage`);
    //             if (analytic_accounts.length > 1) {
    //                 const planId = editedTag.group_id;
    //                 // remove the autofill line
    //                 this.list[planId].distribution = this.list[planId].distribution.filter((t) => !!t.analytic_account_id);
    //                 for (const account of analytic_accounts.slice(1)) {
    //                     // add new tags
    //                     const tag = this.newTag(planId);
    //                     tag.analytic_account_id = account.id;
    //                     tag.analytic_account_name = account.display_name;
    //                     this.list[planId].distribution.push(tag);
    //                 }
    //             }
    //             this.autoFill();
    //         },
    //         onCreateEdit: () => {},
    //     }, {
    //         onClose: () => {
    //             if (!editedTag.analytic_account_id) {
    //                 this.setFocusSelector(`.tag_${editedTag.id} .o_analytic_account_name`);
    //                 this.focusToSelector();
    //             }
    //             this.selectCreateIsOpen = false;
    //         },
    //     });
    // }

    // autoCompleteInputChanged(distTag, inputValue) {
    //     if (inputValue === "" && distTag.analytic_account_id) {
    //         this.deleteTag(distTag.id, distTag.group_id);
    //     }
    // }

    // Editing Distributions
    // async onSelect(option, params, tag) {
    //     if (option.action) {
    //         return option.action(tag);
    //     }
    //     const selected_option = Object.getPrototypeOf(option);
    //     tag.analytic_account_id = parseInt(selected_option.value);
    //     tag.analytic_account_name = selected_option.label;
    //     tag.color = selected_option.color;
    //     this.setFocusSelector(`.tag_${tag.id} .o_analytic_percentage`);
    //     this.autoFill();
    // }

    // async percentageChanged(dist_tag, ev) {
    //     dist_tag.percentage = this.parse(ev.target.value);
    //     if (dist_tag.percentage == 0) {
    //         this.deleteTag(dist_tag.id, dist_tag.group_id);
    //     }
    //     this.autoFill();
    // }

    deleteTag(id, fromGroup) {
        // find the next tag to focus to before deleting the tag
        const allTags = this.listFlat;
        const currentTagIndex = allTags.findIndex((t) => t.id === id);
        const nextTag = allTags[(currentTagIndex + 1) % allTags.length];
        // remove the tag from the groups distribution
        this.list[fromGroup].distribution = this.list[fromGroup].distribution.filter((dist_tag) => dist_tag.id != id);
        if (!this.isDropdownOpen){
            this.save();
        } else {
            this.setFocusSelector(`.tag_${nextTag.id} .o_analytic_account_name`);
            this.autoFill();
        }
    }

    // Getters
    get planSummary() {
        const planTotals = {};
        this.state.formattedData.map((line) => {
            line.analyticAccounts.map((a) => {
                planTotals[a.accountRootPlan[0]] = (planTotals[a.accountRootPlan[0]] || 0) + line.percentage * 100;
            });
        });
        return this.allPlans.map((group) => ({
            id: group.id,
            text: `${group.name} ${this.formatPercentage(planTotals[group.id])}`,
            colorIndex: group.color,
        }));
    }

    async jsonToData() {
        // this converts the field value to an array of objects
        // it keeps the order, breaks composite accounts into the respective accounts etc
        // it is the replacement of formatData which updated `list` in the state to look something like
        // {
        //     [plan.id]: {
        //         "id": plan.id,
        //         "name": plan.name,
        //         "color": plan.color,
        //         "applicability": plan._get_applicability(**kwargs) if plan in root_plans else 'optional',
        //         "all_account_count": plan.all_account_count,
        //         distribution: [{
        //                 analytic_account_id: record.id,
        //                 percentage: data[record.id],
        //                 id: this.nextId++,
        //                 group_id: record.root_plan_id[0],
        //                 analytic_account_name: record.display_name,
        //                 color: record.color,
        //             }...
        //         ]
        //     }
        // }
        // We can now simplify it since we don't need to maintain the order of plans etc
        const jsonFieldValue = this.props.record.data[this.props.name];
        const analyticAccountIds = Object.keys(jsonFieldValue).map((id) => parseInt(id));
        const records = analyticAccountIds.length ? await this.fetchAnalyticAccounts([["id", "in", analyticAccountIds]]) : [];
        // move this line to fetchAnalyticAccounts
        const analyticAccountDict = Object.assign({}, ...records.map((r) => {
            const {id, ...rest} = r;
            return {[r.id]: rest};
        }));
        let distribution = [];

        for (const [accountId, percentage] of Object.entries(jsonFieldValue)) {
            // TODO: an account may not be found (if it was deleted)
            const account = analyticAccountDict[parseInt(accountId)];
            if (account.composition_ids.length) {
                let compositionAccounts = [];
                for (const comp of account.composition_ids) {
                    let a = analyticAccountDict[comp];
                    compositionAccounts.push({
                        accountId: comp,
                        accountDisplayName: a.display_name,
                        accountColor: a.color,
                        accountRootPlan: a.root_plan_id
                    })
                }
                distribution.push({
                    analyticAccounts: compositionAccounts,
                    percentage: percentage/100,
                });
            } else {
                // const account = analyticAccountDict[parseInt(accountId)];
                distribution.push({
                    analyticAccounts: [{
                        accountId: accountId,
                        accountDisplayName: account.display_name,
                        accountColor: account.color,
                        accountRootPlan: account.root_plan_id
                    }],
                    percentage: percentage/100,
                });
            }
        }
        this.state.formattedData = distribution;
        this.addLine();
        console.log(distribution);
    }

    addLine() {
        this.state.formattedData.push({
            analyticAccounts: [],
            percentage: 1,
        });
    }

    dataToJson() {
        const result = {};
        this.state.formattedData.filter((line) => line.analyticAccounts.length).map((line) => {
            result[line.analyticAccounts.map((a) => a.accountId)] = line.percentage * 100;
        });
        return result;
    }

    getRecordDomain(accountIds) {
        // This provides the domain for the many2many autocomplete
        // It excludes all accounts from plans that have already been selected - You can only cross one account from a plan
        // Also excludes composite accounts
        // TODO: Rename everything: method name and variables
        const usedPlanIds = Object.values(accountIds).map((account) => account.data.plan_id[0]);
        const remainingPlans = this.allPlans.filter((p) => p.all_account_count > 0 && !usedPlanIds.includes(p.id)).map((p) => p.id);
        return [["plan_id", "in", remainingPlans], ["composition_ids", "=", false]];
    }

    recordProps(line) {
        const analyticAccountFields = {
            id: { type: "int"},
            display_name: { type: "char" },
            color: { type: "int" },
            plan_id: { type: "many2one" },
            root_plan_id: { type: "many2one" },
        };
        const recordFields = {
            analytic_account_ids: {
                string: _t("Analytic Account"),
                relation: "account.analytic.account",
                type: "many2many",
                related: {
                    fields: analyticAccountFields,
                    activeFields: analyticAccountFields,
                },
            },
            percentage: {
                string: _t("Percentage"),
                type: "float",
            }
        };

        return {
            fields: recordFields,
            values: {
                analytic_account_ids: line.analyticAccounts.map((a) => parseInt(a.accountId)),
                // this.currentValu
                percentage: line.percentage,
            },
            activeFields: recordFields,
            onRecordChanged: (record, changes) => this.lineChanged(record, changes, line),
        };
    }

    lineChanged(record, changes, line) {
        line.analyticAccounts = record.data.analytic_account_ids.records.map((r) => ({
            accountId: r.data.id,
            accountDisplayName: r.data.display_name,
            accountColor: r.data.color,
            accountRootPlan: [r.data.root_plan_id[0], r.data.root_plan_id[1]]}));
        line.percentage = record.data.percentage;
        console.log(line);
    }

    get compositeTags() {
        // This replaces the tags getter (used to display the tags on the line)
        // TODO: onClick & onDelete
        return this.state.formattedData.filter((line) => line.analyticAccounts.length).map((line, idx) => ({
            id: idx,
            text: `${this.formatPercentage(line.percentage * 100)} ${line.analyticAccounts.map((a) => a.accountDisplayName).join(" | ")}`,
            colorIndex: line.analyticAccounts.length == 1 ? line.analyticAccounts[0].accountColor : 0,
            onClick: (ev) => {},
            onDelete: () => this.deleteLine(idx),
        }));
    }

    deleteLine(index) {
        this.state.formattedData.splice(index, 1);
    }

    // get tags() {
    //     return this.listReady.map((dist_tag) => ({
    //         id: dist_tag.id,
    //         text: `${dist_tag.percentage > 99.99 && dist_tag.percentage < 100.01 ? "" : this.formatPercentage(dist_tag.percentage) + " "}${dist_tag.analytic_account_name}`,
    //         colorIndex: dist_tag.color,
    //         group_id: dist_tag.group_id,
    //         onClick: (ev) => this.tagClicked(ev, dist_tag.id),
    //         onDelete: this.editingRecord ? () => this.deleteTag(dist_tag.id, dist_tag.group_id) : undefined
    //     }));
    // }

    get listForJson() {
        let res = {};
        this.listReady.map(({analytic_account_id, percentage}) => {
            res[parseInt(analytic_account_id)] = percentage;
        });
        return res;
    }

    get firstIncompletePlanId() {
        for (const group_id in this.list) {
            if (this.groupStatus(group_id) == "invalid") {
                return group_id;
            }
        }
        return 0;
    }

    get existingAnalyticAccountIDs() {
        return this.listFlat.filter((i) => !!i.analytic_account_id).map((i) => i.analytic_account_id);
    }

    get listReady() {
        return this.listFlat.filter((dist_tag) => this.tagIsReady(dist_tag));
    }

    get listFlat() {
        return Object.values(this.list).flatMap((g) => g.distribution);
    }

    get list() {
        return this.state.list;
    }

    get sortedList() {
        return Object.values(this.list).sort((a, b) => {
            const aApp = a.applicability,
                  bApp = b.applicability;
            return aApp > bApp ? 1 : aApp < bApp ? -1 : 0;
        });
    }

    get allowSave() {
        if (this.firstIncompletePlanId > 0) {
            return false;
        }
        return this.props.allow_save;
    }

    get editingRecord() {
        return !this.props.readonly;
    }

    get isDropdownOpen() {
        return this.state.showDropdown && !!this.dropdownRef.el;
    }

    statusDescription(group_id) {
        const group = this.list[group_id];
        const applicability = PLAN_APPLICABILITY[group.applicability];
        const status = PLAN_STATUS[this.groupStatus(group_id)];
        return `${applicability} - ${status} ${this.formatPercentage(this.sumByGroup(group_id))}`;
    }

    groupStatus(id) {
        const group = this.list[id];
        if (group.applicability === 'mandatory') {
            const sum = this.sumByGroup(id);
            if (sum < 99.99 || sum >= 100.01) {
                return 'invalid';
            }
        }
        return 'ok';
    }

    listReadyByGroup(id) {
        return this.list[id].distribution.filter((tag) => this.tagIsReady(tag));
    }

    tagIsReady({analytic_account_id, percentage}) {
        return !!analytic_account_id && !!percentage;
    }

    sumByGroup(id) {
        return this.listReadyByGroup(id).reduce((prev, next) => prev + (parseFloat(next.percentage) || 0), 0);
    }

    remainderByGroup(id) {
        return 100 - Math.min(this.sumByGroup(id), 100);
    }

    // actions
    newTag(group_id) {
        return {
            id: this.nextId++,
            group_id: group_id,
            analytic_account_id: null,
            analytic_account_name: "",
            percentage: this.remainderByGroup(group_id),
            color: this.list[group_id].color,
        }
    }

    /**
     * This method is typically called when opening the popup and after any change to the distribution.
     * The remainder, will be placed in the first tag with 0%.
     * It adds an empty tag allowing users to continue the distribution (replaced 'Add a Line').
     * Where an empty tag exists, the percentage is updated.
     */
    autoFill() {
        for (const group of this.allPlans.filter((p) => p.all_account_count > 0)) {
            // update the first unmodified tag containing 0%
            const tagToUpdate = this.list[group.id].distribution.find((t) => t.percentage == 0);
            if (tagToUpdate) {
                tagToUpdate.percentage = this.remainderByGroup(group.id);
            }
            // a tag with no analytic account must always be added / updated
            const emptyTag = this.list[group.id].distribution.find((t) => !t.analytic_account_id);
            if (emptyTag) {
                emptyTag.percentage = this.remainderByGroup(group.id);
            } else {
                this.list[group.id].distribution.push(this.newTag(group.id));
            }
        }
    }

    cleanUp() {
        for (const group_id in this.list){
            this.list[group_id].distribution = this.listReadyByGroup(group_id);
        }
    }

    async save() {
        // const currentDistribution = this.listForJson;
        await this.props.record.update({ [this.props.name]: this.dataToJson() });
    }

    onSaveNew() {
        this.openTemplate({ resId: false, context: {
            'default_analytic_distribution': this.listForJson,
        }});
        this.closeAnalyticEditor();
    }

    forceCloseEditor() {
        // focus to the main Element but the dropdown should not open
        this.preventOpen = true;
        this.closeAnalyticEditor();
        this.mainRef.el.focus();
        this.preventOpen = false;
    }

    closeAnalyticEditor() {
        this.cleanUp();
        this.save();
        this.state.showDropdown = false;
    }

    async openAnalyticEditor() {
        if (!this.allPlans.length) {
            await this.fetchAllPlans();
            await this.formatData();
        }
        this.autoFill();
        const incompletePlan = this.firstIncompletePlanId;
        this.setFocusSelector(incompletePlan ? `#plan_${incompletePlan} .incomplete`: ".analytic_json_popup");
        this.state.showDropdown = true;
    }

    tagClicked(ev, id) {
        if (this.editingRecord && !this.isDropdownOpen) {
            this.openAnalyticEditor();
        }
        if (this.isDropdownOpen) {
            this.setFocusSelector(`.tag_${id} .o_analytic_percentage`);
            this.focusToSelector();
            ev.stopPropagation();
        }
    }

    // Focus
    onMainElementFocus(ev) {
        if (!this.isDropdownOpen && !this.preventOpen) {
            this.openAnalyticEditor();
        }
    }

    focusToSelector() {
        if (!!this.focusSelector && this.isDropdownOpen) {
            this.focus(this.adjacentElementToFocus("next", this.dropdownRef.el.querySelector(this.focusSelector)));
        }
        this.focusSelector = false;
    }

    setFocusSelector(selector) {
        this.focusSelector = selector;
    }

    adjacentElementToFocus(direction, el = null) {
        if (!this.isDropdownOpen) {
            return null;
        }
        if (!el) {
            el = this.dropdownRef.el;
        }
        return direction == "next" ? getNextTabableElement(el) : getPreviousTabableElement(el);
    }

    focusAdjacent(direction) {
        const elementToFocus = this.adjacentElementToFocus(direction);
        if (elementToFocus){
            this.focus(elementToFocus);
            return true;
        }
        return false;
    }

    focus(el) {
        if (!el) return;
        el.focus();
        if (["INPUT", "TEXTAREA"].includes(el.tagName)) {
            if (el.selectionStart) {
                el.selectionStart = 0;
                el.selectionEnd = el.value.length;
            }
            el.select();
        }
    }

    // Keys and Clicks
    onWidgetKeydown(ev) {
        if (!this.editingRecord) {
            return;
        }
        const hotkey = getActiveHotkey(ev);
        switch (hotkey) {
            case "enter":
            case "tab": {
                if (this.isDropdownOpen) {
                    this.focusAdjacent("next") || this.forceCloseEditor();
                    break;
                };
                return;
            }
            case "shift+tab": {
                if (this.isDropdownOpen) {
                    this.focusAdjacent("previous") || this.forceCloseEditor();
                    break;
                };
                return;
            }
            case "escape": {
                if (this.isDropdownOpen) {
                    this.forceCloseEditor();
                    break;
                }
            }
            case "arrowdown": {
                if (!this.isDropdownOpen) {
                    this.onMainElementFocus();
                    break;
                }
                return;
            }
            default: {
                return;
            }
        }
        ev.preventDefault();
        ev.stopPropagation();
    }

    onWindowClick(ev) {
        // remove selectCreateIsOpen (it's taken car of by the many2many)
        if (this.isDropdownOpen
            && this.dropdownRef.el && !this.dropdownRef.el.contains(ev.target)
            && !this.widgetRef.el.contains(ev.target)
            && !this.selectCreateIsOpen) {
            this.forceCloseEditor();
        }
    }

    // formatters and parsers
    parse(value) {
        try {
            return typeof value === 'string' || value instanceof String ? oParseFloat(value.replace('%', '')) : value;
        } catch {
            return 0;
        }
    }

    formatPercentage(value) {
        return formatPercentage(value / 100, { digits: [false, this.props.record.data.analytic_precision || 2] });
    }
}
AnalyticDistribution.template = "analytic.AnalyticDistribution";
AnalyticDistribution.components = {
    AutoComplete,
    TagsList,
    Many2ManyTagsField,
    Record,
    PercentageField,
}

AnalyticDistribution.props = {
    ...standardFieldProps,
    business_domain: { type: String, optional: true },
    account_field: { type: String, optional: true },
    product_field: { type: String, optional: true },
    business_domain_compute: { type: String, optional: true },
    force_applicability: { type: String, optional: true },
    allow_save: { type: Boolean, optional: true },
}

export const analyticDistribution = {
    component: AnalyticDistribution,
    supportedTypes: ["char", "text"],
    fieldDependencies: [{ name:"analytic_precision", type: "integer" }],
    extractProps: ({ attrs, options }) => ({
        business_domain: options.business_domain,
        account_field: options.account_field,
        product_field: options.product_field,
        business_domain_compute: attrs.business_domain_compute,
        force_applicability: options.force_applicability,
        allow_save: !options.disable_save,
    }),
};

registry.category("fields").add("analytic_distribution", analyticDistribution);
