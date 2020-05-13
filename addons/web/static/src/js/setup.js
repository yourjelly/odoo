odoo.define('web.setup', function (require) {
    "use strict";

    const { Apps, AppsUpdates } = require('web.apps'); // backend
    const AjaxService = require('web.AjaxService'); // common
    const basicFields = require('web.basic_fields'); // backend
    const basicFieldsOwl = require('web.basic_fields_owl'); // backend
    const ChangePassword = require('web.ChangePassword'); // backend
    const crashManager = require('web.CrashManager'); // common
    const FieldRegistry = require('web.FieldRegistry'); // backend
    const framework = require('web.framework'); // backend
    const LocalStorageService = require('web.LocalStorageService'); // common
    const NotificationService = require('web.NotificationService'); // common
    const OwlFieldRegistry = require('web.OwlFieldRegistry'); // backend
    // const PublicCrashManager = require('web.PublicCrashManager'); // frontend
    const Registry = require('web.Registry');
    const ReportClientAction = require('web.ReportClientAction'); // backend
    const ReportService = require('web.ReportService'); // backend
    const relationalFields = require('web.relational_fields'); // backend
    const SessionStorageService = require('web.SessionStorageService'); // common
    const specialFields = require('web.special_fields'); // backend

    // TODO:
    //  - viewRegistry
    //  - kanbanExamplesRegistry

    /**
     * actionRegistry
     *
     * Contains client actions (can be either functions or specializations of
     * AbstractAction)
     */
    const actionRegistry = new Registry();

    actionRegistry
        .add("apps", Apps)
        .add("apps.updates", AppsUpdates)
        .add("change_password", ChangePassword)
        .add('display_notification', framework.displayNotification)
        .add('home', framework.Home)
        .add('login', framework.login)
        .add('logout', framework.logout)
        .add('reload', framework.Reload)
        .add('reload_context', framework.ReloadContext)
        .add('report.client_action', ReportClientAction);


    /**
     * crashRegistry
     *
     * Contains rpc error handlers (must be object-like structures with a
     * 'display' function, that is executed when the corresponding error occurs)
     */
    const crashRegistry = new Registry();

    crashRegistry.add('odoo.exceptions.RedirectWarning', crashManager.RedirectWarningHandler);
    crashRegistry.add('odoo.http.SessionExpiredException', crashManager.onSessionExpired);
    crashRegistry.add('werkzeug.exceptions.Forbidden', crashManager.onSessionExpired);
    crashRegistry.add('504', crashManager.onError504);


    /**
     * errorDialogRegistry
     *
     * Contains dialogs to display errors (specializations of CrashManagerDialog)
     */

    const errorDialogRegistry = new Registry();


    /**
     * fieldRegistry
     *
     * Contains field widgets (specializations of the AbstractField widget)
     */
    const fieldRegistry = new FieldRegistry();

    fieldRegistry
        // basic fields
        .add('input', basicFields.InputField)
        .add('integer', basicFields.FieldInteger)
        .add('boolean', basicFields.FieldBoolean)
        .add('date', basicFields.FieldDate)
        .add('datetime', basicFields.FieldDateTime)
        .add('daterange', basicFields.FieldDateRange)
        .add('remaining_days', basicFields.RemainingDays)
        .add('domain', basicFields.FieldDomain)
        .add('text', basicFields.FieldText)
        .add('list.text', basicFields.ListFieldText)
        .add('html', basicFields.FieldText)
        .add('float', basicFields.FieldFloat)
        .add('char', basicFields.FieldChar)
        .add('link_button', basicFields.LinkButton)
        .add('handle', basicFields.HandleWidget)
        .add('email', basicFields.FieldEmail)
        .add('phone', basicFields.FieldPhone)
        .add('url', basicFields.UrlWidget)
        .add('CopyClipboardText', basicFields.TextCopyClipboard)
        .add('CopyClipboardChar', basicFields.CharCopyClipboard)
        .add('image', basicFields.FieldBinaryImage)
        .add('kanban.image', basicFields.KanbanFieldBinaryImage)
        .add('binary', basicFields.FieldBinaryFile)
        .add('pdf_viewer', basicFields.FieldPdfViewer)
        .add('monetary', basicFields.FieldMonetary)
        .add('percentage', basicFields.FieldPercentage)
        .add('priority', basicFields.PriorityWidget)
        .add('attachment_image', basicFields.AttachmentImage)
        .add('label_selection', basicFields.LabelSelection)
        .add('kanban_label_selection', basicFields.LabelSelection) // deprecated, use label_selection
        .add('state_selection', basicFields.StateSelectionWidget)
        .add('kanban_state_selection', basicFields.StateSelectionWidget) // deprecated, use state_selection
        .add('boolean_favorite', basicFields.FavoriteWidget)
        .add('boolean_toggle', basicFields.BooleanToggle)
        .add('statinfo', basicFields.StatInfo)
        .add('percentpie', basicFields.FieldPercentPie)
        .add('float_time', basicFields.FieldFloatTime)
        .add('float_factor', basicFields.FieldFloatFactor)
        .add('float_toggle', basicFields.FieldFloatToggle)
        .add('progressbar', basicFields.FieldProgressBar)
        .add('toggle_button', basicFields.FieldToggleBoolean)
        .add('dashboard_graph', basicFields.JournalDashboardGraph)
        .add('ace', basicFields.AceEditor)
        .add('color', basicFields.FieldColor)
        .add('many2one_reference', basicFields.FieldInteger)
        .add('color_picker', basicFields.FieldColorPicker)
        // relational fields
        .add('selection', relationalFields.FieldSelection)
        .add('radio', relationalFields.FieldRadio)
        .add('selection_badge', relationalFields.FieldSelectionBadge)
        .add('many2one', relationalFields.FieldMany2One)
        .add('many2one_barcode', relationalFields.Many2oneBarcode)
        .add('list.many2one', relationalFields.ListFieldMany2One)
        .add('kanban.many2one', relationalFields.KanbanFieldMany2One)
        .add('many2one_avatar', relationalFields.Many2OneAvatar)
        .add('many2many', relationalFields.FieldMany2Many)
        .add('many2many_binary', relationalFields.FieldMany2ManyBinaryMultiFiles)
        .add('many2many_tags', relationalFields.FieldMany2ManyTags)
        .add('many2many_tags_avatar', relationalFields.FieldMany2ManyTagsAvatar)
        .add('form.many2many_tags', relationalFields.FormFieldMany2ManyTags)
        .add('kanban.many2many_tags', relationalFields.KanbanFieldMany2ManyTags)
        .add('many2many_checkboxes', relationalFields.FieldMany2ManyCheckBoxes)
        .add('one2many', relationalFields.FieldOne2Many)
        .add('statusbar', relationalFields.FieldStatus)
        .add('reference', relationalFields.FieldReference)
        .add('font', relationalFields.FieldSelectionFont)
        // special fields
        .add('timezone_mismatch', specialFields.FieldTimezoneMismatch)
        .add('report_layout', specialFields.FieldReportLayout);


    /**
     * owlFieldRegistry
     *
     * Contains field components (specializations of the AbstractField component)
     */
    const owlFieldRegistry = new OwlFieldRegistry();

    owlFieldRegistry
        .add('badge', basicFieldsOwl.FieldBadge)
        .add('boolean', basicFieldsOwl.FieldBoolean);


    /**
     * serviceRegistry
     *
     * Contains services (specializations of AbstractService)
     */

    const serviceRegistry = new Registry();

    serviceRegistry
        .add('ajax', AjaxService)
        .add('crash_manager', crashManager.CrashManager)
        .add('local_storage', LocalStorageService)
        .add('notification', NotificationService)
        .add('report', ReportService)
        .add('session_storage', SessionStorageService);

    return {
        actionRegistry,
        crashRegistry,
        errorDialogRegistry,
        fieldRegistry,
        owlFieldRegistry,
        serviceRegistry,
    };
});
