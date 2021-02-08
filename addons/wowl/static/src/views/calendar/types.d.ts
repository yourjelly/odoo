
export type Scales = "day" | "week" | "month" | "year";

export interface CalendarViewDescription {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canQuickCreate: boolean;
  disableQuickCreate: boolean;
  displayFields: {attrs: any;};
  eventLimit: number | boolean;
  eventOpenPopup: boolean;
  fields: Record<string, any>;
  fieldMap: Record<string, string>;
  fieldNames: string[];
  filtersInfo: Record<string, CalendarFilterInfo>;
  formViewId: number | false;
  hideDate: boolean;
  hideTime: boolean;
  initialDate: any; // luxon.DateTime
  quickAddPop: boolean;
  scale: Scales;
  scales: Scales[];
  showUnusualDays: boolean;
}

export interface CalendarViewState {
  title: string;
}

export interface CalendarModelProps {
  fields: Record<string, any>;
  fieldMap: Record<string, string>;
  fieldNames: string[];
  filtersInfo: Record<string, CalendarFilterInfo>;
  initialDate: any; // luxon.DateTime
  modelName: string;
  scale: Scales;
  scales: Scales[];
}

export interface CalendarModelState {
  date: any;
  events: CalendarEvent[];
  filters: {
    [fieldName: string]: {
      [id: number]: CalendarFilter;
      [key: string]: CalendarFilter;
    };
  };
  scale: Scales;
  range: {
    start: any;
    end: any;
  };
  weekRange: {
    start: number;
    end: number;
  };
}

interface CalendarFilterField {
  field?: string;
  model?: string;
}
export interface CalendarFilterInfo {
  avatar: CalendarFilterField;
  color: CalendarFilterField;
  fieldName: string;
  title: string;
  write: CalendarFilterField;
}

export type CalendarFilterType = "record" | "user" | "all" | "undefined";
export type CalendarFilterValue = string | number;

export interface CalendarFilter {
  active: boolean;
  colorIndex: number | false;
  label: string;
  recordId: number | false;
  type: CalendarFilterType;
  value: CalendarFilterValue;
}

export interface CalendarEvent {
  allDay: boolean;
  end: Date;
  extendedProps: {
    record: any;
  };
  id: number;
  start: Date;
  title: string;
}
