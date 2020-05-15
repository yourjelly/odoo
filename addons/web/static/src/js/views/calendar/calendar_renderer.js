odoo.define('web.CalendarRenderer', function (require) {
"use strict";

const AbstractRenderer = require('web.AbstractRendererOwl');
const CalendarPopover = require('web.CalendarPopover');
const core = require('web.core');
const Dialog = require('web.Dialog');
const patchMixin = require('web.patchMixin');
const FieldManagerMixin = require('web.FieldManagerMixin');
const relational_fields = require('web.relational_fields');
const session = require('web.session');
const utils = require('web.utils');
const Widget = require('web.Widget');
const { ComponentAdapter } = require('web.OwlCompatibility');

const _t = core._t;

const { useRef } = owl.hooks;

const scales = {
    day: 'timeGridDay',
    week: 'timeGridWeek',
    month: 'dayGridMonth',
    year: 'dayGridYear',
};

const SidebarFilterM2O = relational_fields.FieldMany2One.extend({
    _getSearchBlacklist: function () {
        return this._super.apply(this, arguments).concat(this.filter_ids || []);
    },
});

// TODO: convert with future Field API
const SidebarFilter = Widget.extend(FieldManagerMixin, {
    template: 'CalendarView.sidebar.filter',
    custom_events: _.extend({}, FieldManagerMixin.custom_events, {
        field_changed: '_onFieldChanged',
    }),
    /**
     * @constructor
     * @param {Widget} parent
     * @param {Object} options
     * @param {string} options.fieldName
     * @param {Object[]} options.filters A filter is an object with the
     *   following keys: id, value, label, active, avatar_model, color,
     *   can_be_removed
     * @param {Object} [options.favorite] this is an object with the following
     *   keys: fieldName, model, fieldModel
     */
    init: function (parent, options) {
        this._super.apply(this, arguments);
        FieldManagerMixin.init.call(this);
        this._resetFields(options);
    },
    /**
     * @override
     */
    willStart: function () {
        return Promise.all([
            this._super(...arguments),
            this._updateSidebarFilterM2O()
        ]);

    },
    /**
     * @override
     */
    start: function () {
        this._super();
        this._render();
    },

    render() {
        this.$('.o_calendar_filter_item').popover('dispose');
        this.renderElement();
        this._render();
    },
    update(options) {
        this._resetFields(options);
        return this._updateSidebarFilterM2O();
    },
    _render() {
        if (this.many2one) {
            this.many2one.appendTo(this.$el);
            this.many2one.filter_ids = _.without(_.pluck(this.filters, 'value'), 'all');
        }
        this.$el.on('click', '.o_remove', this._onFilterRemove.bind(this));
        this.$el.on('click', '.o_calendar_filter_items input', this._onFilterActive.bind(this));

        // Show popovers
        if (this.avatar_field) {
            for (const filter of this.filters) {
                if (!['all', false].includes(filter.value)) {
                    const selector = `.o_calendar_filter_item[data-value=${filter.value}]`;
                    this.$(selector).popover({
                        animation: false,
                        trigger: 'hover',
                        html: true,
                        placement: 'top',
                        title: filter.label,
                        delay: {show: 300, hide: 0},
                        content: () => $('<img>', {
                            src: `/web/image/${this.avatar_model}/${filter.value}/${this.avatar_field}`,
                            class: 'mx-auto',
                        }),
                    });
                }
            }
        }
    },
    _resetFields(options) {
        this.title = options.title;
        this.fields = options.fields;
        this.fieldName = options.fieldName;
        this.write_model = options.write_model;
        this.write_field = options.write_field;
        this.avatar_field = options.avatar_field;
        this.avatar_model = options.avatar_model;
        this.filters = options.filters;
        this.label = options.label;
        this.getColor = options.getColor;
    },
    _updateSidebarFilterM2O() {
        if (this.many2one) {
            this.many2one.destroy();
        }
        if (this.write_model || this.write_field) {
            return this.model.makeRecord(this.write_model, [{
                name: this.write_field,
                relation: this.fields[this.fieldName].relation,
                type: 'many2one',
            }]).then((recordID) => {
                this.many2one = new SidebarFilterM2O(this,
                    this.write_field,
                    this.model.get(recordID),
                    {
                        mode: 'edit',
                        attrs: {
                            string: _t(this.fields[this.fieldName].string),
                            placeholder: "+ " + _.str.sprintf(_t("Add %s"), this.title),
                            can_create: false
                        },
                    });
            });
        }
        return Promise.resolve();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} event
     */
    _onFieldChanged: function (event) {
        var self = this;
        event.stopPropagation();
        var createValues = {'user_id': session.uid};
        var value = event.data.changes[this.write_field].id;
        createValues[this.write_field] = value;
        this._rpc({
                model: this.write_model,
                method: 'create',
                args: [createValues],
            })
            .then(function () {
                self.trigger_up('changeFilter', {
                    'fieldName': self.fieldName,
                    'value': value,
                    'active': true,
                });
            });
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onFilterActive: function (e) {
        var $input = $(e.currentTarget);
        this.trigger_up('changeFilter', {
            'fieldName': this.fieldName,
            'value': $input.closest('.o_calendar_filter_item').data('value'),
            'active': $input.prop('checked'),
        });
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onFilterRemove: function (e) {
        var self = this;
        var $filter = $(e.currentTarget).closest('.o_calendar_filter_item');
        Dialog.confirm(this, _t("Do you really want to delete this filter from favorites ?"), {
            confirm_callback: function () {
                self._rpc({
                        model: self.write_model,
                        method: 'unlink',
                        args: [[$filter.data('id')]],
                    })
                    .then(function () {
                        self.trigger_up('changeFilter', {
                            'fieldName': self.fieldName,
                            'id': $filter.data('id'),
                            'active': false,
                            'value': $filter.data('value'),
                        });
                    });
            },
        });
    },
});

class SidebarFilterAdapter extends ComponentAdapter {
    constructor(parent, props) {
        props.Component = SidebarFilter;
        super(...arguments);
    }
    get widgetArgs() {
        return [this.props.options];
    }
    updateWidget(nextProps) {
        return this.widget.update(nextProps.options);
    }
    renderWidget() {
        this.widget.render();
    }
    __patch(target, vnode) {
        owl.Component.prototype.__patch.call(this, ...arguments);
        this.renderWidget();
        vnode.elm = this.widget.el;
    }
}

class CalendarRenderer extends AbstractRenderer {
    /**
     * @constructor
     */
    constructor() {
        super(...arguments);
        this.colorMap = {};
        this.targetDate = null;
        this.calendar = null;
        this.calendarRef = useRef('calendar');
        this.calendarMiniRef = useRef('calendar-mini');
        this._isInDOM = false;
    }
    /**
     * @override
     */
    mounted() {
        if (this._isInDOM) {
            return;
        }
        this._isInDOM = true;
        this._initCalendar();
        this._initCalendarMini();
        this.calendar.render();
        this._render();
    }
    patched() {
        this._render();
    }
    /**
     * @override
     */
    willUnmount() {
        this._isInDOM = false;
        if (this.calendar) {
            this.calendar.destroy();
        }
        if (this.$calendarMini) {
            this.$calendarMini.datepicker('destroy');
            const datepicker = document.querySelector('#ui-datepicker-div:empty');
            if (datepicker) {
                datepicker.remove();
            }
        }
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     *
     * @param {any} key
     * @returns {integer}
     */
    getColor(key) {
        if (!key) {
            return;
        }
        if (this.colorMap[key]) {
            return this.colorMap[key];
        }
        // check if the key is a css color
        if (typeof key === 'string' && key.match(/^((#[A-F0-9]{3})|(#[A-F0-9]{6})|((hsl|rgb)a?\(\s*(?:(\s*\d{1,3}%?\s*),?){3}(\s*,[0-9.]{1,4})?\))|)$/i)) {
            this.colorMap[key] = key;
        } else if (typeof key === 'number' && !(key in this.colorMap)) {
            this.colorMap[key] = key;
        } else {
            this.colorMap[key] = 1 + ((Object.keys(this.colorMap).length + 1) * 5) % 24;
        }
        return this.colorMap[key];
    }
    /**
     * @override
     */
    getLocalState() {
        const fcScroller = this.calendarRef.el.querySelector('.fc-scroller');
        return {
            scrollPosition: fcScroller.scrollTop,
        };
    }
    /**
     * @override
     */
    setLocalState(localState) {
        if (localState.scrollPosition) {
            const fcScroller = this.calendarRef.el.querySelector('.fc-scroller');
            fcScroller.scrollTop = localState.scrollPosition;
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Convert the new format of Event from FullCalendar V4 to a Event FullCalendar V3
     * @param fc4Event
     * @return {Object} FullCalendar V3 Object Event
     * @private
     */
    _convertEventToFC3Event(fc4Event) {
        let event = fc4Event;
        if (!moment.isMoment(fc4Event.start)) {
            event = {
                id: fc4Event.id,
                title: fc4Event.title,
                start: moment(fc4Event.start).utcOffset(0, true),
                end: fc4Event.end && moment(fc4Event.end).utcOffset(0, true),
                allDay: fc4Event.allDay,
                color: fc4Event.color,
            };
            if (fc4Event.extendedProps) {
                event = Object.assign({}, event, {
                    r_start: fc4Event.extendedProps.r_start &&
                        moment(fc4Event.extendedProps.r_start).utcOffset(0, true),
                    r_end: fc4Event.extendedProps.r_end &&
                        moment(fc4Event.extendedProps.r_end).utcOffset(0, true),
                    record: fc4Event.extendedProps.record,
                    attendees: fc4Event.extendedProps.attendees,
                });
            }
        }
        return event;
    }
    /**
     * @param {any} event
     * @returns {string} the html for the rendered event
     */
    _eventRender(event) {
        const qwebContext = {
            event: event,
            record: event.extendedProps.record,
            color: this.getColor(event.extendedProps.color_index),
        };
        if (!qwebContext.record || !Object.entries(qwebContext.record).length) {
            return '';
        } else {
            return this.env.qweb.renderToString("web.CalendarRenderer.event", qwebContext);
        }
    }
    /**
     * Returns the time format from database parameters (only hours and minutes).
     * FIXME: this looks like a weak heuristic...
     *
     * @private
     * @returns {string}
     */
    _getDbTimeFormat() {
        return this.env._t.database.parameters.time_format.search('%H') !== -1 ?
            'HH:mm' : 'hh:mm a';
    }
    /**
     * Return the Object options for FullCalendar
     *
     * @private
     * @param {Object} fcOptions
     * @return {Object}
     */
    _getFullCalendarOptions(fcOptions) {
        return Object.assign({}, this.props.fc_options, {
            plugins: [
                'moment',
                'interaction',
                'dayGrid',
                'timeGrid',
                FullCalendar.createPlugin({
                    views: {
                        dayGridYear: class extends FullCalendar.View {
                            initialize() {
                                this.renderSkeleton();
                                this.subCalendars = [];
                                for (let i = 0; i < 12; i++) {
                                    const subCalendar = new FullCalendar.Calendar(this.el.querySelector(`[month-cell-index="${i}"]`), {
                                        plugins: [
                                            'moment',
                                            'interaction',
                                            'dayGrid',
                                            'timeGrid',
                                        ],
                                        defaultDate: (new Date()).setMonth(i),
                                        defaultView: 'dayGridMonth',
                                        header: false,
                                    });
                                    this.subCalendars.push(subCalendar);
                                }
                            }
                            destroy() {
                                for (const subCalendar of this.subCalendars) {
                                    subCalendar.destroy();
                                }
                                this.el.remove();
                            }
                            renderSkeleton() {
                                const containerEl = document.createElement('div');
                                this.el.appendChild(containerEl);
                                for (let i = 0; i < 12; i++) {
                                    const monthCellEl = document.createElement('div');
                                    containerEl.appendChild(monthCellEl);
                                    monthCellEl.setAttribute('month-cell-index', i);
                                    Object.assign(monthCellEl.style, {
                                        flex: '25%',
                                    });
                                }
                                Object.assign(containerEl.style, {
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    flex: '1',
                                });
                            }
                            renderDates() {
                                for (const subCalendar of this.subCalendars) {
                                    subCalendar.render();
                                }
                            }
                        }
                    }
                })
            ],
            eventDrop: ({ event }) => {
                event = this._convertEventToFC3Event(event);
                this.trigger('dropRecord', event);
            },
            eventResize: ({ event }) => {
                this._unselectEvent();
                event = this._convertEventToFC3Event(event);
                this.trigger('updateRecord', event);
            },
            eventClick: ({ el, event }) => {
                this._unselectEvent();
                const eventEls = this.calendarRef.el.querySelectorAll(`[data-event-id="${event.id}"]`);
                for (const el of eventEls) {
                    el.classList.add('o_cw_custom_highlight');
                }
                this._renderEventPopover(event, el);
            },
            select: ({ start, end, allDay }) => {
                // Clicking on the view, dispose any visible popover. Otherwise create a new event.
                if (this.el.querySelector('.o_cw_popover')) {
                    this._unselectEvent();
                } else {
                    const data = { start, end, allDay };
                    if (this.props.context.default_name) {
                        data.title = this.props.context.default_name;
                    }
                    this.trigger('openCreate', this._convertEventToFC3Event(data));
                }
                this.calendar.unselect();
            },
            eventRender: ({ el, event, view }) => {
                const eventEl = utils.stringToElement(this._eventRender(event));
                if (eventEl) {
                    const fcContentEl = el.querySelector('.fc-content');
                    fcContentEl.innerHTML = eventEl.innerHTML;
                    el.classList.add(...eventEl.classList);
                    el.setAttribute('data-event-id', event.id);

                    // Add background if doesn't exist
                    if (!el.querySelector('.fc-bg')) {
                        const fcBgEl = document.createElement('div');
                        fcBgEl.className = 'fc-bg';
                        fcContentEl.parentElement.insertBefore(fcBgEl, fcContentEl.nextSibling);
                    }
                }

                if (view.type === 'dayGridMonth' && event.extendedProps.record) {
                    const start = event.extendedProps.r_start || event.start;
                    const end = event.extendedProps.r_end || event.end;
                    // Detect if the event occurs in just one day
                    // note: add & remove 1 min to avoid issues with 00:00
                    const isSameDayEvent = moment(start).clone().add(1, 'minute')
                        .isSame(moment(end).clone().subtract(1, 'minute'), 'day');
                    if (!event.extendedProps.record.allday && isSameDayEvent) {
                        // For month view: do not show background for non allday, single day events
                        el.classList.add('o_cw_nobg');
                        if (event.extendedProps.showTime && !this.props.hideTime) {
                            const displayTime = moment(start).clone()
                                .format(this._getDbTimeFormat());
                            el.querySelector('.fc-content .fc-time')
                                .innerText = displayTime;
                        }
                    }
                }

                // On double click, edit the event
                el.addEventListener('dblclick', () => {
                    this.trigger('edit-event', {id: event.id});
                });
            },
            datesRender: ({ view }) => {
                // compute mode from view.type which is either
                // 'dayGridMonth', 'timeGridWeek' or 'timeGridDay'
                const mode = view.type === 'dayGridMonth' ?
                    'month' :
                    (view.type === 'timeGridWeek' ? 'week' : 'day');
                this.trigger('viewUpdated', {
                    mode: mode,
                    title: view.title,
                });
            },
            // Add/Remove a class on hover to style multiple days events.
            // The css ":hover" selector can't be used because these events
            // are rendered using multiple elements.
            eventMouseEnter: ({ event }) => {
                const eventEls = this.calendarRef.el.querySelectorAll(`[data-event-id="${event.id}"]`);
                for (const el of eventEls) {
                    el.classList.add('o_cw_custom_hover');
                }
            },
            eventMouseLeave: ({ event }) => {
                if (!event.id) {
                    return;
                }
                const eventEls = this.calendarRef.el.querySelectorAll(`[data-event-id="${event.id}"]`);
                for (const el of eventEls) {
                    el.classList.remove('o_cw_custom_hover');
                }
            },
            eventDragStart: ({ event }) => {
                const eventEls = this.calendarRef.el.querySelectorAll(`[data-event-id="${event.id}"]`);
                for (const el of eventEls) {
                    el.classList.add('o_cw_custom_hover');
                }
                this._unselectEvent();
            },
            eventResizeStart: ({ event }) => {
                const eventEls = this.calendarRef.el.querySelectorAll(`[data-event-id="${event.id}"]`);
                for (const el of eventEls) {
                    el.classList.add('o_cw_custom_hover');
                }
                this._unselectEvent();
            },
            eventLimitClick: () => {
                this._unselectEvent();
                return 'popover';
            },
            windowResize: () => {
                this._render();
            },
            views: {
                timeGridDay: {
                    columnHeaderFormat: 'LL'
                },
                timeGridWeek: {
                    columnHeaderFormat: 'ddd D'
                },
                dayGridMonth: {
                    columnHeaderFormat: 'dddd'
                }
            },
            height: 'parent',
            unselectAuto: false,
            dir: this.env._t.database.parameters.direction,
        }, fcOptions);
    }
    /**
     * Prepare context to display in the popover.
     *
     * @private
     * @param {Object} eventData
     * @returns {Object} context
     */
    _getPopoverContext(eventData) {
        const context = {
            hideDate: this.props.hideDate,
            hideTime: this.props.hideTime,
            eventTime: {},
            eventDate: {},
            fields: this.props.fields,
            displayFields: this.props.displayFields,
            event: eventData,
            modelName: this.props.model,
            canDelete: this.props.canDelete,
        };

        const start = moment((eventData.extendedProps && eventData.extendedProps.r_start) || eventData.start);
        const end = moment((eventData.extendedProps && eventData.extendedProps.r_end) || eventData.end);
        const isSameDayEvent = start.clone().add(1, 'minute').isSame(end.clone().subtract(1, 'minute'), 'day');

        // Do not display timing if the event occur across multiple days. Otherwise use user's timing preferences
        if (!this.props.hideTime && !eventData.extendedProps.record.allday && isSameDayEvent) {
            const dbTimeFormat = this._getDbTimeFormat();

            context.eventTime.time = `${start.clone().format(dbTimeFormat)} - ${end.clone().format(dbTimeFormat)}`;

            // Calculate duration and format text
            const durationHours = moment.duration(end.diff(start)).hours();
            const durationHoursKey = (durationHours === 1) ? 'h' : 'hh';
            const durationMinutes = moment.duration(end.diff(start)).minutes();
            const durationMinutesKey = (durationMinutes === 1) ? 'm' : 'mm';

            const localeData = moment.localeData(); // i18n for 'hours' and "minutes" strings
            context.eventTime.duration = (durationHours > 0 ? localeData.relativeTime(durationHours, true, durationHoursKey) : '')
                    + (durationHours > 0 && durationMinutes > 0 ? ', ' : '')
                    + (durationMinutes > 0 ? localeData.relativeTime(durationMinutes, true, durationMinutesKey) : '');
        }

        if (!this.props.hideDate) {
            if (!isSameDayEvent && start.isSame(end, 'month')) {
                // Simplify date-range if an event occurs into the same month (eg. '4-5 August 2019')
                context.eventDate.date = start.clone().format('MMMM D') + '-' + end.clone().format('D, YYYY');
            } else {
                context.eventDate.date = isSameDayEvent ? start.clone().format('dddd, LL') : start.clone().format('LL') + ' - ' + end.clone().format('LL');
            }

            if (eventData.extendedProps.record.allday && isSameDayEvent) {
                context.eventDate.duration = this.env._t("All day");
            } else if (eventData.extendedProps.record.allday && !isSameDayEvent) {
                const daysLocaleData = moment.localeData();
                const days = moment.duration(end.diff(start)).days();
                context.eventDate.duration = daysLocaleData.relativeTime(days, true, 'dd');
            }
        }

        return context;
    }
    /**
     * Prepare the parameters for the popover.
     * This allow the parameters to be extensible.
     *
     * @private
     * @param {Object} eventData
     */
    _getPopoverParams(eventData) {
        return {
            animation: false,
            delay: {
                show: 50,
                hide: 100
            },
            trigger: 'manual',
            html: true,
            title: eventData.extendedProps.record.display_name,
            template: this.env.qweb.renderToString('web.CalendarRenderer.event.popover.placeholder', {
                color: this.getColor(eventData.extendedProps.color_index)
            }),
            container: eventData.allDay ? '.fc-view' : '.fc-scroller',
        };
    }
    /**
     * 
     * @param {string} filterKey
     * @private
     */
    _getSidebarFilterProps(filterKey) {
        return {
            options: Object.assign({}, this.props.filters[filterKey], {
                fields: this.props.fields,
                getColor: this.getColor.bind(this),
            }),
        };
    }
    /**
     * Initialize the main calendar
     *
     * @private
     */
    _initCalendar() {
        const locale = moment.locale();
        const fcOptions = this._getFullCalendarOptions({
            locale: locale, // reset locale when fullcalendar has already been instanciated before now
        });
        this.calendar = new FullCalendar.Calendar(this.calendarRef.el, fcOptions);
    }
    /**
     * Initialize the mini calendar in the sidebar
     *
     * @private
     */
    _initCalendarMini() {
        this.$calendarMini = $(this.calendarMiniRef.el);
        this.$calendarMini.datepicker({
            'onSelect': (datum, obj) => {
                this.trigger('changeDate', {
                    date: moment(new Date(+obj.currentYear , +obj.currentMonth, +obj.currentDay)),
                });
            },
            'showOtherMonths': true,
            'dayNamesMin' : this.props.fc_options.dayNamesShort,
            'monthNames': this.props.fc_options.monthNamesShort,
            'firstDay': this.props.fc_options.firstDay,
        });
    }
    /**
     * Finalise the popover
     *
     * @param {Element} popoverElement
     * @param {web.CalendarPopover} calendarPopover
     * @private
     */
    _onPopoverShown(popoverElement, calendarPopover) {
        popoverElement.querySelector('.o_cw_popover_close')
            .addEventListener('click', () => {
                this._unselectEvent();
                calendarPopover.destroy();
                $('.o_cw_popover').popover('dispose');
            });
    }
    /**
     * Render the calendar view, this is the main entry point.
     *
     * @override method from AbstractRenderer
     * @private
     */
    _render() {
        if (this._isInDOM) {
            this._renderCalendar();
        }
        this.$calendarMini.datepicker("setDate", this.props.highlight_date.toDate())
            .find('.o_selected_range')
            .removeClass('o_color o_selected_range');
        let $a;
        switch (this.props.scale) {
            case 'month': $a = this.$calendarMini.find('td'); break;
            case 'week': $a = this.$calendarMini.find('tr:has(.ui-state-active)'); break;
            case 'day': $a = this.$calendarMini.find('a.ui-state-active'); break;
        }
        if ($a) {
            $a.addClass('o_selected_range');
            setTimeout(function () {
                $a.not('.ui-state-active').addClass('o_color');
            });
        }
    }
    /**
     * Render the specific code for the FullCalendar when it's in the DOM
     *
     * @private
     */
    _renderCalendar() {
        this.calendar.unselect();
        if (scales[this.props.scale] !== this.calendar.view.type) {
            this.calendar.changeView(scales[this.props.scale]);
        }

        if (this.targetDate !== this.props.target_date.toString()) {
            this.calendar.gotoDate(moment(this.props.target_date).toDate());
            this.targetDate = this.props.target_date.toString();
        }

        this._unselectEvent();
        this._renderEvents();
    }
    /**
     * Render event popover
     *
     * @private
     * @param {Object} eventData
     * @param {Element} eventElement
     */
    _renderEventPopover(eventData, eventElement) {
        // Initialize popover widget
        const CalendarPopover = this.constructor.components.CalendarPopover;
        const calendarPopover = new ComponentAdapter(this, {
            Component: CalendarPopover,
            widgetArgs: [this._getPopoverContext(eventData)],
        });
        const $popover = $(eventElement).popover(
            this._getPopoverParams(eventData)
        );
        $popover.on('shown.bs.popover', async () => {
            const popoverTip = $popover.data('bs.popover').tip;
            await calendarPopover.mount(popoverTip.querySelector('.o_cw_body'));
            this._onPopoverShown(popoverTip, calendarPopover);
        }).popover('show');
    }
    /**
     * Render all events
     *
     * @private
     */
    _renderEvents() {
        this.calendar.removeAllEvents();
        this.calendar.addEventSource(this.props.data);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Remove highlight classes and dispose of popovers
     *
     * @private
     */
    _unselectEvent() {
        const selectedEvents = this.el.querySelectorAll('.fc-event.o_cw_custom_highlight');
        for (const selectedEvent of selectedEvents) {
            selectedEvent.classList.remove('o_cw_custom_highlight');
        }
        $(this.el).find('.o_cw_popover').popover('dispose');
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onEditEvent(ev) {
        this._unselectEvent();
        this.trigger('openEvent', {
            _id: ev.detail.id,
            title: ev.detail.title,
        });
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onDeleteEvent(ev) {
        this._unselectEvent();
        this.trigger('deleteRecord', {id: parseInt(ev.detail.id, 10)});
    }
}
CalendarRenderer.template = 'web.CalendarRenderer';
CalendarRenderer.components = {
    CalendarPopover,
    SidebarFilterAdapter,
};

return patchMixin(CalendarRenderer);

});
