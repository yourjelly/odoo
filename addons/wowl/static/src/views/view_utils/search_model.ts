import { core } from "@odoo/owl";
import { makeContext, Context } from "../../core/context";
import { IrFilter, ViewDescription } from "../../services/view_manager";
import { OdooEnv } from "../../types";
import { combineDomains, Domain, DomainListRepr } from "../../core/domain";
import { FieldDefinition, Fields, FieldType } from "../graph/view";
import { getGroupBy, GroupBy as GroupByObject } from "../view_utils/group_by";
import {
  DEFAULT_INTERVAL,
  DEFAULT_PERIOD,
  getComparisonOptions,
  getPeriodOptions,
  getIntervalOptions,
  GeneratorId,
  yearSelected,
  Option,
  OptionGenerator,
  ComparisonOptionId,
  constructDateDomain,
  IntervalId,
  rankInterval,
} from "./search_utils";
import { evaluateExpr } from "../../py/index";
import { DateTime } from "luxon";
const { EventBus } = core;

//--------------------------------------------------------------------------
// Types
//--------------------------------------------------------------------------

type SearchItemType =
  | "filter"
  | "dateFilter"
  | "groupBy"
  | "dateGroupBy"
  | "comparison"
  | "field"
  | "favorite";

interface SearchItemCommon {
  id: number;
  groupId: number;
  description: string;
}

interface FilterItem extends SearchItemCommon {
  groupNumber: number;
  invisible?: true;
  isDefault?: true;
  defaultRank?: -5;
}

interface GroupByCommon extends SearchItemCommon {
  groupNumber: number;
  invisible?: true;
  isDefault?: true;
  defaultRank?: number;

  fieldName: string;
  fieldType: FieldType;
}

interface Filter extends FilterItem {
  type: "filter";
  domain: Domain;
  context?: string;
}

interface DateFilter extends FilterItem {
  type: "dateFilter";
  defaultGeneratorId: GeneratorId;
  fieldName: string;
  fieldType: "date" | "datetime";
}

interface Comparison extends SearchItemCommon {
  type: "comparison";
  comparisonOptionId: ComparisonOptionId;
  dateFilterId: number;
}

interface Favorite extends SearchItemCommon {
  type: "favorite";
  context: Context;
  domain: Domain;
  groupBys: GroupByObject[];
  groupNumber: 1 | 2;
  orderedBy: { asc: boolean; name: string }[];
  removable?: true;
  serverSideId: number;
  userId: number | false;
  isDefault?: true;
  // comparison: of the form {comparisonId, fieldName, fieldDescription,
  //     *                      range, rangeDescription, comparisonRange, comparisonRangeDescription, }
}

interface Field extends SearchItemCommon {
  type: "field";
  invisible?: true;
  isDefault?: true;
  defaultRank?: -10;

  fieldName: string;
  fieldType: FieldType;

  context?: string;
  domain?: Domain;
  filterDomain?: Domain;
  operator?: string;

  defaultAutocompleteValue?: AutocompletValue;
}

interface GroupBy extends GroupByCommon {
  type: "groupBy";
}

interface DateGroupBy extends GroupByCommon {
  type: "dateGroupBy";
  defaultIntervalId: IntervalId;
}

export type SearchItem =
  | Filter
  | DateFilter
  | Favorite
  | GroupBy
  | DateGroupBy
  | Comparison
  | Field;

interface SearchItems {
  [id: number]: SearchItem;
}

interface QueryElementCommon {
  searchItemId: number;
}

interface DateFilterQueryElement extends QueryElementCommon {
  generatorId: GeneratorId;
}

interface DateGroupByQueryElement extends QueryElementCommon {
  intervalId: IntervalId;
}

interface AutocompletValue {
  label: string;
  value: any;
  operator: string;
}

type FieldQueryElement = QueryElementCommon & AutocompletValue;

type QueryElement =
  | QueryElementCommon
  | DateFilterQueryElement
  | DateGroupByQueryElement
  | FieldQueryElement;

type Query = QueryElement[];

type ActiveCommon = { searchItemId: number };
type ActiveDateFilter = ActiveCommon & { generatorIds: GeneratorId[] };
type ActiveDateGroupBy = ActiveCommon & { intervalIds: IntervalId[] };
type ActiveField = ActiveCommon & { autocompletValues: AutocompletValue[] };

type Active = ActiveCommon | ActiveDateFilter | ActiveDateGroupBy | ActiveField;

interface Group {
  id: number;
  activeItems: Active[];
}

export interface ModelParams {
  context: Context;
  domain: Domain;
  searchViewDescription: ViewDescription;
  modelName: string;
}

//--------------------------------------------------------------------------
// Global variables/constants
//--------------------------------------------------------------------------

const FAVORITE_PRIVATE_GROUP = 1;
const FAVORITE_SHARED_GROUP = 2;
const DISABLE_FAVORITE = "search_disable_custom_filters";

let nextId: number = 1;
let nextGroupId: number = 1;
let nextGroupNumber: number = 1;

// class Measure {
//   constructor(descr: string, fields?: Fields) {
//     // do something, validate measure, have always a group operator when toString is called,...
//   }
// }

// new Measure("__count__");

// function useSearch() {
//   const component = Component.current!;
//   const env = component.env as OdooEnv;
//   const { model: modelName, context, domain } = component.props as ViewProps;
//   const model = new Model(env);

//   onWillStart(() => {
//     model.load({ context, domain: new Domain(domain), modelName});
//   });

//   return model;
// }

export class SearchModel extends EventBus {
  globalDomain: Domain = new Domain([]);
  globalContext: Context = {};
  modelName: string = "";
  defaultFavoriteId: number | null = null;

  searchItems: SearchItems = {};
  query: Query = [];

  referenceMoment: DateTime = DateTime.local();

  searchMenuTypes: Set<SearchItemType> = new Set(["favorite"]); // hard coded for now ---> what in future?
  comparisonOptions: { id: string; groupNumber?: number; description?: string }[];
  optionGenerators: OptionGenerator[];
  intervalOptions: Option[];
  env: OdooEnv;

  constructor(env: OdooEnv) {
    super();
    this.env = env;
    this.comparisonOptions = getComparisonOptions();
    this.optionGenerators = getPeriodOptions(this.referenceMoment);
    this.intervalOptions = getIntervalOptions();
  }

  load(params: ModelParams) {
    const { searchViewDescription, context, domain, modelName } = params;

    this.modelName = modelName;
    this.globalDomain = domain;

    this.globalContext = context;
    const searchDefaults: { [key: string]: any } = {};
    for (const key in this.globalContext) {
      const match = /^search_default_(.*)$/.exec(key);
      if (match) {
        const val = this.globalContext[key];
        if (val) {
          searchDefaults[match[1]] = val;
        }
        delete this.globalContext[key];
      }
    }

    this.processSearchViewDescription(searchViewDescription, searchDefaults);

    this.activateDefaultFilters();

    this.on("INTERNAL_UPDATE", this, this.update);
  }

  async update() {
    await this._update();
    this.trigger("UPDATE");
  }

  async _update() {}

  processSearchViewDescription(
    searchViewDescription: ViewDescription,
    searchDefaults: { [key: string]: any }
  ) {
    const { irFilters, arch, fields } = searchViewDescription;
    const parser = new DOMParser();
    const xml = parser.parseFromString(arch, "text/xml");
    this.parseXML(xml.documentElement, {
      currentTag: null,
      currentGroup: [],
      pregroupOfGroupBys: [],
      fields,
      searchDefaults,
    });
    const dateFilters = Object.values(this.searchItems).filter(
      (searchElement) => searchElement.type === "dateFilter"
    );
    if (dateFilters.length) {
      this._createGroupOfComparisons(dateFilters);
    }
    this.createGroupOfFavorites(irFilters || []);
  }

  pushGroup(
    data: {
      currentTag: string | null;
      currentGroup: any[];
      pregroupOfGroupBys: any[];
      searchDefaults: { [key: string]: any };
      fields: Fields;
    },
    tag: string | null = null
  ) {
    if (data.currentGroup.length) {
      if (data.currentTag === "groupBy") {
        data.pregroupOfGroupBys.push(...data.currentGroup);
      } else {
        this.createGroupOfSearchItems(data.currentGroup);
      }
    }
    data.currentTag = tag;
    data.currentGroup = [];
    nextGroupNumber++;
  }

  parseXML(
    node: Element | ChildNode,
    data: {
      currentTag: string | null;
      currentGroup: any[];
      pregroupOfGroupBys: any[];
      searchDefaults: { [key: string]: any };
      fields: Fields;
    }
  ) {
    if (!(node instanceof Element)) {
      return;
    }
    if (node.nodeType === 1) {
      switch (node.tagName) {
        case "search":
          for (let child of node.childNodes) {
            this.parseXML(child, data);
          }
          this.pushGroup(data);
          if (data.pregroupOfGroupBys.length) {
            this.createGroupOfSearchItems(data.pregroupOfGroupBys);
          }
          break;
        case "group":
          this.pushGroup(data);
          for (let child of node.childNodes) {
            this.parseXML(child, data);
          }
          this.pushGroup(data);
          break;
        case "separator":
          this.pushGroup(data);
          break;
        case "field":
          this.pushGroup(data, "field");

          const preField: any = { type: "field" };

          if (node.hasAttribute("modifiers")) {
            const modifiers = JSON.parse(node.getAttribute("modifiers")!);
            if (modifiers.invisible) {
              preField.invisible = true;
            }
          }

          if (node.hasAttribute("domain")) {
            preField.domain = new Domain(node.getAttribute("domain")!);
          }
          if (node.hasAttribute("filter_domain")) {
            preField.filterDomain = new Domain(node.getAttribute("filter_domain")!);
          } else if (node.hasAttribute("operator")) {
            preField.operator = node.getAttribute("operator");
          }
          if (node.hasAttribute("context")) {
            preField.context = node.getAttribute("context");
          }

          if (node.hasAttribute("name")) {
            const name = node.getAttribute("name")!;
            preField.fieldName = name;
            preField.fieldType = data.fields[name].type;

            if (name in data.searchDefaults) {
              preField.isDefault = true;
              const value = data.searchDefaults[name];
              let operator = preField.operator;
              if (!operator) {
                let type = preField.fieldType;
                if (node.hasAttribute("widget")) {
                  type = node.getAttribute("widget")!;
                }
                // Note: many2one as a default filter will have a
                // numeric value instead of a string => we want "="
                // instead of "ilike".
                if (["char", "html", "many2many", "one2many", "text"].includes(type)) {
                  operator = "ilike";
                } else {
                  operator = "=";
                }
              }
              preField.defaultRank = -10;
              preField.defaultAutocompleteValue = {
                operator,
                value: Array.isArray(value) ? value[0] : value,
              };
            }
          }

          if (node.hasAttribute("string")) {
            preField.description = node.getAttribute("string");
          } else if (preField.fieldName) {
            preField.description = data.fields[preField.fieldName].string;
          } else {
            preField.description = "Ω";
          }

          data.currentGroup.push(preField);
          break;
        case "filter":
          const preSearchItem: any = { type: "filter" };

          if (node.hasAttribute("context")) {
            const context = node.getAttribute("context")!;
            try {
              const groupBy = makeContext(context).group_by;
              if (groupBy) {
                preSearchItem.type = "groupBy";
                const [fieldName, defaultInterval] = makeContext(context).group_by.split(":");
                preSearchItem.fieldName = fieldName;
                preSearchItem.fieldType = data.fields[fieldName].type;
                if (["date", "datetime"].includes(preSearchItem.fieldType)) {
                  preSearchItem.defaultIntervalId = defaultInterval || DEFAULT_INTERVAL;
                }
              }
            } catch (e) {}
            if (preSearchItem.type === "filter") {
              preSearchItem.context = context;
            }
          }

          if (preSearchItem.type !== data.currentTag) {
            this.pushGroup(data, preSearchItem.type);
          }

          if (preSearchItem.type === "filter") {
            if (node.hasAttribute("date")) {
              const fieldName = node.getAttribute("date")!;
              preSearchItem.type = "dateFilter";
              preSearchItem.fieldName = fieldName;
              preSearchItem.fieldType = data.fields[fieldName].type;
              preSearchItem.defaultGeneratorId = DEFAULT_PERIOD;
              if (node.hasAttribute("default_period")) {
                preSearchItem.defaultGeneratorId = node.getAttribute("default_period");
              }
            } else {
              let stringRepr = "[]";
              if (node.hasAttribute("domain")) {
                stringRepr = node.getAttribute("domain")!;
              }
              preSearchItem.domain = new Domain(stringRepr);
            }
          }

          if (node.hasAttribute("modifiers")) {
            const modifiers = JSON.parse(node.getAttribute("modifiers")!);
            if (modifiers.invisible) {
              preSearchItem.invisible = true;
              let fieldName = preSearchItem.fieldName;
              if (fieldName && !data.fields[fieldName]) {
                // In some case when a field is limited to specific groups
                // on the model, we need to ensure to discard related filter
                // as it may still be present in the view (in 'invisible' state)
                return;
              }
            }
          }

          preSearchItem.groupNumber = nextGroupNumber;

          if (node.hasAttribute("name")) {
            const name = node.getAttribute("name")!;
            if (name in data.searchDefaults) {
              preSearchItem.isDefault = true;
              if (preSearchItem.type === "groupBy") {
                const value = data.searchDefaults[name];
                preSearchItem.defaultRank = typeof value === "number" ? value : 100;
              } else {
                preSearchItem.defaultRank = -5;
              }
            }
          }

          if (node.hasAttribute("string")) {
            preSearchItem.description = node.getAttribute("string");
          } else if (preSearchItem.fieldName) {
            preSearchItem.description = data.fields[preSearchItem.fieldName].string;
          } else {
            preSearchItem.description = "Ω";
          }

          data.currentGroup.push(preSearchItem);
          break;
      }
    }
  }

  //--------------------------------------------------------------------------
  // Getters
  //--------------------------------------------------------------------------

  get activeComparison(): Comparison | null {
    for (const queryElem of this.query) {
      const searchItem = this.searchItems[queryElem.searchItemId];
      if (searchItem.type === "comparison") {
        return searchItem;
      }
    }
    return null;
  }

  get context(): Context {
    return this.getContext();
  }

  get domain(): DomainListRepr {
    const domain = combineDomains([this.globalDomain, this.getDomain()], "AND");
    return domain.toList(this.env.services.user.context);
  }

  get domains(): DomainListRepr[] {
    return [this.domain]; /** for comparisons @todo  to adapt */
  }

  get groupBy(): GroupByObject[] {
    return this.getGroupBy();
  }

  get orderedBy(): { asc: boolean; name: string }[] {
    return this.getOrderedBy();
  }

  /**
   * Return an array containing enriched copies of the searchElements of the provided type.
   */
  getSearchItems(predicate: (searchItem: SearchItem) => boolean) {
    const searchItems: any[] = [];
    Object.values(this.searchItems).forEach((searchItem) => {
      if ((!predicate || predicate(searchItem)) && !searchItem.invisible) {
        const enrichedSearchitem = this.enrichItem(searchItem);
        if (enrichedSearchitem) {
          searchItems.push(enrichedSearchitem);
        }
      }
    });
    if (searchItems.some((f) => f.type === "favorite")) {
      searchItems.sort((f1, f2) => f1.groupNumber - f2.groupNumber);
    }
    return searchItems;
  }

  //--------------------------------------------------------------------------
  // "Actions"
  //--------------------------------------------------------------------------

  /**
   * Activate a filter of type 'field' with given filterId with
   * 'autocompleteValues' value, label, and operator.
   * @param {Object}
   */
  addAutoCompletionValues(searchItemId: number, autocompleteValue: AutocompletValue) {
    const searchItem = this.searchItems[searchItemId];
    if (searchItem.type !== "field") {
      return;
    }
    const { label, value, operator } = autocompleteValue;
    const queryElem = this.query.find(
      (queryElem) =>
        queryElem.searchItemId === searchItemId &&
        "value" in queryElem &&
        queryElem.value === value &&
        queryElem.operator === operator
    );
    if (!queryElem) {
      this.query.push({ searchItemId, label, value, operator });
    } else {
      (queryElem as FieldQueryElement).label = label;
    }
  }

  /**
   * Remove all the query elements from query.
   */
  clearQuery() {
    this.query = [];
  }

  /**
   * Create new search items of type 'filter' and activate them.
   * A new group containing only those filters is created.
   */
  createNewFilters(prefilters: any[]) {
    if (!prefilters.length) {
      return [];
    }
    prefilters.forEach((preFilter) => {
      const filter = Object.assign(preFilter, {
        groupId: nextGroupId,
        groupNumber: nextGroupNumber,
        id: nextId,
        type: "filter",
      });
      this.searchItems[nextId] = filter as Filter;
      this.query.push({ searchItemId: nextId });
      nextId++;
    });
    nextGroupId++;
    nextGroupNumber++;
  }

  /**
   * Create a new filter of type 'groupBy' and activate it.
   * It is added to the unique group of groupbys.
   */
  createNewGroupBy(field: FieldDefinition & { name: string }) {
    const { name: fieldName, string, type: fieldType } = field;
    const firstGroupBy = Object.values(this.searchItems).find((f) => f.type === "groupBy");
    const preSearchItem = {
      description: string || fieldName,
      fieldName,
      fieldType,
      groupId: firstGroupBy ? firstGroupBy.groupId : nextGroupId++,
      groupNumber: nextGroupNumber,
      id: nextId,
    } as DateGroupBy | GroupBy;
    if (["date", "datetime"].includes(field.type)) {
      this.searchItems[nextId] = Object.assign(
        { type: "dateGroupBy", defaultInterval: DEFAULT_INTERVAL },
        preSearchItem
      );
      this.toggleDateGroupBy(nextId);
    } else {
      this.searchItems[nextId] = Object.assign({ type: "groupBy" }, preSearchItem);
      this.toggleDateGroupBy(nextId);
    }
    nextGroupNumber++;
    nextId++;
  }

  /**
   * Deactivate a group with provided groupId, i.e. delete the query elements
   * with given groupId.
   */
  deactivateGroup(groupId: number) {
    this.query = this.query.filter((queryElem) => {
      const searchItem = this.searchItems[queryElem.searchItemId];
      return searchItem.groupId !== groupId;
    });
    this.checkComparisonStatus();
  }

  /**
   * Delete a filter of type 'favorite' with given filterId server side and
   * in control panel model. Of course the filter is also removed
   * from the search query.
   */
  async deleteFavorite(favoriteId: number) {
    const searchItem = this.searchItems[favoriteId];
    if (searchItem.type !== "favorite") {
      return;
    }
    const { serverSideId } = searchItem;
    await this.env.services
      .model("ir.filters")
      .unlink([
        serverSideId,
      ]); /** @todo we should maybe expose some method in view_manager: before, the filter cache was invalidated */
    const index = this.query.findIndex((queryElem) => queryElem.searchItemId === favoriteId);
    delete this.searchItems[favoriteId];
    if (index >= 0) {
      this.query.splice(index, 1);
    }
    this.trigger("UPDATE");
  }

  /**
   * Activate or deactivate the simple filter with given filterId, i.e.
   * add or remove a corresponding query element.
   */
  toggleSearchItem(searchItemId: number) {
    const searchItem = this.searchItems[searchItemId];
    switch (searchItem.type) {
      case "dateFilter":
      case "dateGroupBy":
        return;
    }
    const index = this.query.findIndex((queryElem) => queryElem.searchItemId === searchItemId);
    if (index >= 0) {
      this.query.splice(index, 1);
    } else {
      if (searchItem.type === "favorite") {
        this.query = [];
      } else if (searchItem) {
        // make sure only one comparison can be active
        this.query = this.query.filter((queryElem) => {
          const { type } = this.searchItems[queryElem.searchItemId];
          return type !== "comparison";
        });
      }
      this.query.push({ searchItemId });
    }
  }

  toggleDateGroupBy(searchItemId: number, intervalId?: IntervalId) {
    const searchItem = this.searchItems[searchItemId];
    if (searchItem.type !== "dateGroupBy") {
      return;
    }
    intervalId = intervalId || searchItem.defaultIntervalId;
    const index = this.query.findIndex(
      (queryElem) =>
        queryElem.searchItemId === searchItemId &&
        "intervalId" in queryElem &&
        queryElem.intervalId === intervalId
    );
    if (index >= 0) {
      this.query.splice(index, 1);
    } else {
      this.query.push({ searchItemId, intervalId });
    }
  }

  /**
   * Used to toggle a query element.
   * This can impact the query in various form, e.g. add/remove other query elements
   * in case the filter is of type 'filter'.
   */
  toggleDateFilter(searchItemId: number, generatorId?: GeneratorId) {
    const searchItem = this.searchItems[searchItemId];
    if (searchItem.type !== "dateFilter") {
      return;
    }
    generatorId = generatorId || searchItem.defaultGeneratorId;
    const index = this.query.findIndex(
      (queryElem) =>
        queryElem.searchItemId === searchItemId &&
        "generatorId" in queryElem &&
        queryElem.generatorId === generatorId
    );
    if (index >= 0) {
      this.query.splice(index, 1);
      if (!yearSelected(this.getSelectedGeneratorIds(searchItemId))) {
        // This is the case where generatorId was the last option
        // of type 'year' to be there before being removed above.
        // Since other options of type 'month' or 'quarter' do
        // not make sense without a year we deactivate all options.
        this.query = this.query.filter((queryElem) => queryElem.searchItemId !== searchItemId);
      }
    } else {
      this.query.push({ searchItemId, generatorId });
      if (!yearSelected(this.getSelectedGeneratorIds(searchItemId))) {
        // Here we add 'this_year' as options if no option of type
        // year is already selected.
        const { defaultYearId } = this.optionGenerators.find((o) => o.id === generatorId)!;
        this.query.push({ searchItemId, generatorId: defaultYearId });
      }
    }
    this.checkComparisonStatus();
  }

  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  /**
   * If a comparison is active, check if it should become inactive.
   * The comparison should become inactive if the corresponding date filter has become
   * inactive.
   */
  private checkComparisonStatus() {
    const activeComparison = this.activeComparison;
    if (!activeComparison) {
      return;
    }
    const { dateFilterId, id } = activeComparison;
    const dateFilterIsActive = this.query.some(
      (queryElem) => queryElem.searchItemId === dateFilterId
    );
    if (!dateFilterIsActive) {
      this.query = this.query.filter((queryElem) => queryElem.searchItemId !== id);
    }
  }

  /**
   * Starting from a date filter id, returns the array of option ids currently selected
   * for the corresponding date filter.
   */
  private getSelectedGeneratorIds(dateFilterId: number): GeneratorId[] {
    const selectedOptionIds: GeneratorId[] = [];
    for (const queryElem of this.query) {
      if (queryElem.searchItemId === dateFilterId && "generatorId" in queryElem) {
        selectedOptionIds.push(queryElem.generatorId);
      }
    }
    return selectedOptionIds;
  }

  /**
   * Activate the default favorite (if any) or all default filters.
   */
  private activateDefaultFilters() {
    const activateFavorite =
      DISABLE_FAVORITE in this.globalContext ? this.globalContext[DISABLE_FAVORITE] : true;
    if (activateFavorite && this.defaultFavoriteId) {
      // Activate default favorite
      this.toggleSearchItem(this.defaultFavoriteId);
    } else {
      // Activate default filters
      Object.values(this.searchItems)
        .filter((f) => f.isDefault && f.type !== "favorite")
        .sort((f1, f2) => (f1.defaultRank || 100) - (f2.defaultRank || 100))
        .forEach((f) => {
          if (f.type === "dateFilter") {
            this.toggleDateFilter(f.id);
          } else if (f.type === "dateGroupBy") {
            this.toggleDateGroupBy(f.id);
          } else if (f.type === "field") {
            //     let { operator, label, value } = f.defaultAutocompleteValue;
            //     this.addAutoCompletionValues({
            //         filterId: f.id,
            //         value,
            //         operator,
            //         label,
            //     });
          } else {
            this.toggleSearchItem(f.id);
          }
        });
    }
  }

  /**
   * Starting from the array of date filters, create the filters of type
   * 'comparison'.
   * @private
   * @param {Object[]} dateFilters
   */
  _createGroupOfComparisons(dateFilters: DateFilter[]) {
    const preSearchItem = [];
    for (const dateFilter of dateFilters) {
      for (const comparisonOption of this.comparisonOptions) {
        const { id: dateFilterId, description } = dateFilter;
        const preFilter = {
          type: "comparison",
          comparisonOptionId: comparisonOption.id,
          description: `${description}: ${comparisonOption.description}`,
          dateFilterId,
        };
        preSearchItem.push(preFilter);
      }
    }
    this.createGroupOfSearchItems(preSearchItem);
  }

  /**
   * Add filters of type 'favorite' determined by the array this.favoriteFilters.
   */
  private createGroupOfFavorites(irFilters: IrFilter[]) {
    this.defaultFavoriteId = null;
    irFilters.forEach((irFilter) => {
      const favorite = this.irFilterToFavorite(irFilter);
      this.createGroupOfSearchItems([favorite]);
      if (favorite.isDefault) {
        this.defaultFavoriteId = favorite.id;
      }
    });
  }

  /**
   * Using a list (a 'pregroup') of 'prefilters', create new filters in `searchItems`
   * for each prefilter. The new filters belong to a same new group.
   */
  private createGroupOfSearchItems(pregroup: {}[]) {
    pregroup.forEach((preSearchItem) => {
      const searchItem = Object.assign(preSearchItem, {
        groupId: nextGroupId,
        id: nextId,
      }) as SearchItem;
      this.searchItems[nextId] = searchItem;
      // if (!this.defaultFavoriteId && filter.isDefault && filter.type === 'field') {
      //     this._prepareDefaultLabel(filter);
      // }
      nextId++;
    });
    nextGroupId++;
  }

  /**
   * Returns null or a copy of the provided filter with additional information
   * used only outside of the control panel model, like in search bar or in the
   * various menus. The value null is returned if the filter should not appear
   * for some reason.
   */
  private enrichItem(searchItem: SearchItem): object | null {
    const queryElements = this.query.filter(
      (queryElem) => queryElem.searchItemId === searchItem.id
    );
    const isActive = Boolean(queryElements.length);
    const i = Object.assign({ isActive }, searchItem) as any;

    function _enrichOptions(options: Option[], selectedIds: (IntervalId | GeneratorId)[]) {
      return options.map((o) => {
        const { description, id, groupNumber } = o;
        const isActive = selectedIds.some((optionId) => optionId === id);
        return { description, id, groupNumber, isActive };
      });
    }

    switch (i.type) {
      // case 'comparison': {
      //     const { dateFilterId } = filter;
      //     const dateFilterIsActive = this.query.some(
      //         queryElem => queryElem.filterId === dateFilterId
      //     );
      //     if (!dateFilterIsActive) {
      //         return null;
      //     }
      //     break;
      // }
      case "dateFilter":
        i.options = _enrichOptions(
          this.optionGenerators,
          queryElements.map((queryElem) => (queryElem as DateFilterQueryElement).generatorId)
        );
        break;
      case "dateGroupBy":
        i.options = _enrichOptions(
          this.intervalOptions,
          queryElements.map((queryElem) => (queryElem as DateGroupByQueryElement).intervalId)
        );
        break;
      // case 'field':
      //     f.autoCompleteValues = queryElements.map(
      //         ({ label, value, operator }) => ({ label, value, operator })
      //     );
      //     break;
    }
    return i;
  }

  /**
   * Construct a single context from the contexts of
   * filters of type 'filter', 'favorite', and 'field'.
   * @private
   * @returns {Object}
   */
  getContext() {
    const groups = this.getGroups();
    const groupContexts = [];
    for (const group of groups) {
      for (const activeItem of group.activeItems) {
        groupContexts.push(this.getSearchItemContext(activeItem));
      }
    }
    // const evaluationContext = this.env.services.user.context;
    try {
      return {};
      // return pyUtils.eval('contexts', groupContexts, evaluationContext);
    } catch (err) {
      throw new Error(
        `${this.env._t("Failed to evaluate search context")}:\n${JSON.stringify(err)}`
      );
    }
  }

  /**
   * Return the context of the provided (active) filter.
   */
  getSearchItemContext(activeItem: Active): Context {
    const { searchItemId } = activeItem;
    const searchItem = this.searchItems[searchItemId];
    switch (searchItem.type) {
      case "comparison":
      case "dateFilter":
      case "dateGroupBy":
      case "groupBy":
        return {};
      case "field":
        // for <field> nodes, a dynamic context (like context="{'field1': self}")
        // should set {'field1': [value1, value2]} in the context
        let context: Context = {};
        if (searchItem.context) {
          try {
            const self = (activeItem as ActiveField).autocompletValues.map(
              (autocompleValue) => autocompleValue.value
            );
            context = evaluateExpr(searchItem.context || "{}", { self });
          } catch (err) {
            throw new Error(
              `${this.env._t("Failed to evaluate field context")}:\n${JSON.stringify(err)}`
            );
          }
        }
        // the following code aims to remodel this:
        // https://github.com/odoo/odoo/blob/12.0/addons/web/static/src/js/views/search/search_inputs.js#L498
        // this is required for the helpdesk tour to pass
        // this seems weird to only do that for m2o fields, but a test fails if
        // we do it for other fields (my guess being that the test should simply
        // be adapted)
        if (searchItem.isDefault && searchItem.fieldType === "many2one") {
          context[`default_${searchItem.fieldName}`] = searchItem.defaultAutocompleteValue!.value;
        }
        return context;
      case "favorite":
      case "filter":
        return makeContext(searchItem.context);
    }
  }

  /**
   * Return a domain created by combinining appropriately (with an 'AND') the domains
   * coming from the active groups of type 'filter', 'dateFilter', 'favorite', and 'field'.
   */
  private getDomain(): Domain {
    const groups = this.getGroups();
    const groupDomains: Domain[] = [];
    for (const group of groups) {
      const groupDomains = group.activeItems.map((activeItem) =>
        this.getSearchItemDomain(activeItem)
      );
      const groupDomain = combineDomains(groupDomains, "OR");
      groupDomains.push(groupDomain);
    }
    try {
      return combineDomains(groupDomains, "AND");
    } catch (err) {
      throw new Error(`${this.env._t("Failed to evaluate domain")}:/n${JSON.stringify(err)}`);
    }
  }

  /**
   * Return the domain of the provided filter.
   */
  private getSearchItemDomain(activeItem: Active): Domain {
    const { searchItemId } = activeItem;
    const searchItem = this.searchItems[searchItemId];
    switch (searchItem.type) {
      case "comparison":
      case "groupBy":
      case "dateGroupBy":
        return new Domain([]);
      case "field":
        return this.getAutoCompletionFilterDomain(
          searchItem,
          (activeItem as ActiveField).autocompletValues
        );
      case "dateFilter":
        const { dateFilterId } = this.activeComparison || {};
        if (this.searchMenuTypes.has("comparison") && dateFilterId === searchItemId) {
          return new Domain([]);
        }
        return this.getDateFilterDomain(
          searchItem,
          (activeItem as ActiveDateFilter).generatorIds
        ) as Domain;
      case "filter":
      case "favorite":
        return searchItem.domain;
    }
  }

  /**
   * Compute the string representation or the description of the current domain associated
   * with a date filter starting from its corresponding query elements.
   */
  private getDateFilterDomain(
    dateFilter: DateFilter,
    generatorIds: GeneratorId[],
    key: "domain" | "description" = "domain"
  ): Domain | string {
    const { fieldName, fieldType } = dateFilter;
    const { direction } = this.env.services.user;
    const dateFilterRange = constructDateDomain(
      this.referenceMoment,
      fieldName,
      fieldType,
      generatorIds,
      direction
    );
    return dateFilterRange[key];
  }

  /**
   * Return the domain resulting from the combination of the auto-completion
   * values of a filter of type 'field'.
   * @private
   * @param {Object} filter
   * @param {Object[]} filterQueryElements
   * @returns {string}
   */
  private getAutoCompletionFilterDomain(field: Field, autocompleteValues: AutocompletValue[]) {
    const domains = autocompleteValues.map(({ label, value, operator }) => {
      let domain: DomainListRepr;
      if (field.filterDomain) {
        domain = field.filterDomain.toList({ self: label, raw_value: value });
      } else {
        domain = [[field.fieldName, operator, value]];
      }
      return new Domain(domain);
    });
    return combineDomains(domains, "OR");
  }

  /**
   * Return the concatenation of groupBys comming from the active filters of
   * type 'favorite' and 'groupBy'.
   * The result respects the appropriate logic: the groupBys
   * coming from an active favorite (if any) come first, then come the
   * groupBys comming from the active filters of type 'groupBy' in the order
   * defined in this.query. If no groupBys are found, one tries to
   * find some grouBys in this.globalContext.
   */
  private getGroupBy(): GroupByObject[] {
    const groups = this.getGroups();
    const groupBys: GroupByObject[] = [];
    for (const group of groups) {
      const groupGroupBys: GroupByObject[] = [];
      for (const activeItem of group.activeItems) {
        groupGroupBys.push(...this.getSearchItemGroupBys(activeItem));
      }
      groupBys.push(...groupGroupBys);
    }
    const groupBy = groupBys.length ? groupBys : this.globalContext.group_by || []; // globalContext.group_by camelcased???
    return typeof groupBy === "string" ? [groupBy] : groupBy;
  }

  /**
   * @returns {string[]}
   */
  getOrderedBy(): { asc: boolean; name: string }[] {
    const groups = this.getGroups();
    const orderedBy = [];
    for (const group of groups) {
      for (const activeItem of group.activeItems) {
        const { searchItemId } = activeItem;
        const searchItem = this.searchItems[searchItemId];
        if (searchItem.type === "favorite") {
          orderedBy.push(...searchItem.orderedBy);
        }
      }
    }
    return orderedBy;
  }

  /**
   * Return the groupBys of the provided filter.
   * @private
   * @param {Object} filter
   * @param {Object[]} filterQueryElements
   * @returns {string[]} groupBys
   */
  private getSearchItemGroupBys(activeItem: Active): GroupByObject[] {
    const { searchItemId } = activeItem;
    const searchItem = this.searchItems[searchItemId];
    if ("intervalIds" in activeItem) {
      const { fieldName } = searchItem as DateGroupBy;
      return activeItem.intervalIds.map((intervalId) => getGroupBy(`${fieldName}:${intervalId}`));
    } else if (searchItem.type === "groupBy") {
      return [getGroupBy(searchItem.fieldName)];
    } else if (searchItem.type === "favorite") {
      return searchItem.groupBys;
    }
    return [];
  }

  /**
   * Reconstruct the (active) groups from the query elements.
   * @private
   * @returns {Object[]}
   */
  private getGroups(): Group[] {
    const preGroups: { id: number; queryElements: Query }[] = [];
    for (const queryElem of this.query) {
      let preGroup = preGroups.find((group) => group.id === nextGroupId);
      if (!preGroup) {
        preGroup = { id: nextGroupId, queryElements: [] };
        preGroups.push(preGroup);
      }
      preGroup.queryElements.push(queryElem);
    }

    const groups: Group[] = [];
    for (const preGroup of preGroups) {
      const { queryElements, id } = preGroup;
      let activeItems: Active[] = [];
      for (const queryElem of queryElements) {
        const { searchItemId } = queryElem;
        let activeItem = activeItems.find(({ searchItemId: id }) => id === searchItemId);
        if ("generatorId" in queryElem) {
          if (!activeItem) {
            activeItem = { searchItemId, generatorIds: [] };
            activeItems.push(activeItem);
          }
          (activeItem as ActiveDateFilter).generatorIds.push(queryElem.generatorId);
        } else if ("intervalId" in queryElem) {
          if (!activeItem) {
            activeItem = { searchItemId, intervalIds: [] };
            activeItems.push(activeItem);
          }
          (activeItem as ActiveDateGroupBy).intervalIds.push(queryElem.intervalId);
        } else {
          if (!activeItem) {
            activeItem = { searchItemId };
            activeItems.push(activeItem);
          }
        }
      }
      for (const activeItem of activeItems) {
        if ("intervalIds" in activeItem) {
          activeItem.intervalIds.sort((g1, g2) => rankInterval(g1) - rankInterval(g2));
        }
      }
      groups.push({ id, activeItems });
    }
    return groups;
  }

  private irFilterToFavorite(irFilter: IrFilter): Favorite {
    let userId: number | false = false;
    if (Array.isArray(irFilter.user_id)) {
      userId = irFilter.user_id[0];
    }
    const groupNumber = userId ? FAVORITE_PRIVATE_GROUP : FAVORITE_SHARED_GROUP;
    const context = evaluateExpr(irFilter.context, this.env.services.user.context);
    let groupBys: GroupByObject[] = [];
    if (context.group_by) {
      groupBys = (context.group_by as string[]).map((str) => getGroupBy(str));
      delete context.group_by;
    }
    // let comparison;
    // if (context.comparison) {
    //     comparison = context.comparison;
    //     delete context.comparison;
    // }
    let sort: string[];
    try {
      sort = JSON.parse(irFilter.sort);
    } catch (err) {
      if (err instanceof SyntaxError) {
        sort = [];
      } else {
        throw err;
      }
    }
    const orderedBy = sort.map((order) => {
      let fieldName;
      let asc;
      const sqlNotation = order.split(" ");
      if (sqlNotation.length > 1) {
        // regex: \fieldName (asc|desc)?\
        fieldName = sqlNotation[0];
        asc = sqlNotation[1] === "asc";
      } else {
        // legacy notation -- regex: \-?fieldName\
        fieldName = order[0] === "-" ? order.slice(1) : order;
        asc = order[0] === "-" ? false : true;
      }
      return {
        asc: asc,
        name: fieldName,
      };
    });
    const favorite: Favorite = {
      context,
      description: irFilter.name,
      domain: new Domain(irFilter.domain),
      groupBys,
      groupNumber,
      orderedBy,
      removable: true,
      serverSideId: irFilter.id,
      type: "favorite",
      userId,
    } as Favorite;
    if (irFilter.is_default) {
      favorite.isDefault = irFilter.is_default;
    }
    // if (comparison) {
    //     favorite.comparison = comparison;
    // }
    return favorite;
  }
}
