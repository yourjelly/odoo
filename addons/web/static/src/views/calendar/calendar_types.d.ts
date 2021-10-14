import { DomainListRepr } from "@web/core/domain";

interface FieldMeta {
  type: string;
  relation?: string;
  related?: string;
}

export type Scales = "day" | "week" | "month" | "year";

export interface CalendarFilterInfo {
  avatarFieldName: string | null;
  colorFieldName: string | null;
  fieldName: string;
  filterFieldName: string | null;
  label: string;
  resModel: string;
  writeFieldName: string | null;
  writeResModel: string | null;
}

export type CalendarFilterInfoDict = Record<string, CalendarFilterInfo>;

export interface CalendarFieldMapping {
  date_start: string;
  date_delay?: string;
  date_stop?: string;
  all_day?: string;
  recurrence_update?: string;
  create_name_field?: string;
  color?: string;
}

export interface CalendarViewDescription {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  date: any;
  eventLimit: number;
  fieldMapping: CalendarFieldMapping;
  fieldNames: string[];
  filtersInfo: CalendarFilterInfoDict;
  formViewId: number | false;
  hasEditDialog: boolean;
  hasQuickCreate: boolean;
  isDateHidden: boolean;
  isTimeHidden: boolean;
  popoverFields: Record<string, any>;
  scale: Scales;
  scales: Scales[];
  showUnusualDays: boolean;
}

export type CalendarModelMeta = CalendarViewDescription & {
  domain: DomainListRepr;
  fields: Record<string, FieldMeta>;
  firstDayOfWeek: number;
  resModel: string;
};

export type CalendarFilterType = "record" | "user" | "all" | "dynamic";

export interface CalendarFilter {
  active: boolean;
  canRemove: boolean;
  colorIndex: number | null;
  hasAvatar: boolean;
  label: string;
  recordId: number | null;
  type: CalendarFilterType;
  value: any;
}

export interface CalendarFilterSection {
  avatar: {
    field: string;
    model: string;
  };
  canAddFilter: boolean;
  canCollapse: boolean;
  fieldName: string;
  filters: CalendarFilter[];
  hasAvatar: boolean;
  label: string;
  write: {
    field: string;
    model: string;
  };
}

export type CalendarFilterSectionDict = Record<number, CalendarFilterSection>;

export interface CalendarRecord {
  id: number;
  title: string;
  isAllDay: boolean;
  start: any;
  end: any;
  duration: number;
  colorIndex: number | null;
  isTimeHidden: boolean;
  rawRecord: Record<string, any>;
}

export type CalendarRecordDict = Record<number, CalendarRecord>;

export interface CalendarModelData {
  filterSections: Record<string, CalendarFilterSection>;
  hasCreateRight: boolean | null;
  range: {
    start: any;
    end: any;
  };
  records: CalendarRecordDict;
  unusualDays: string[];
}
