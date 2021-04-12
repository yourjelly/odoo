
export type Scales = "day" | "week" | "month" | "year";

export interface ScaleInfo {
  unit: string;
  view: string;
  label: string;
}

export interface CalendarViewDescription {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canQuickCreate: boolean;
  displayFields: {attrs: any;};
  eventLimit: number | boolean;
  eventOpenPopup: boolean;
  fields: Record<string, any>;
  fieldMap: Record<string, string>;
  fieldNames: string[];
  filtersInfo: Record<string, CalendarFilterSectionInfo>;
  formViewId: number | false;
  hideDate: boolean;
  hideTime: boolean;
  initialDate: any; // luxon.DateTime
  scale: Scales;
  scales: Scales[];
  showUnusualDays: boolean;
}

interface CalendarViewStateFilter {
  active: boolean;
  canFold: boolean;
}

interface CalendarViewStatePopup {
  displayed: boolean;
  type?: "event-description" | "quick-create";
}

export interface CalendarViewState {
  filters: Record<string, CalendarViewStateFilter>;
  popup: CalendarViewStatePopup;
  title: string;
}

export interface CalendarModelParams {
  fields: Record<string, any>;
  fieldMap: Record<string, string>;
  fieldNames: string[];
  filterSectionsInfo: Record<string, CalendarFilterSectionInfo>;
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
export interface CalendarFilterSectionInfo {
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
  id: number | string;
  start: Date;
  title: string;
}
