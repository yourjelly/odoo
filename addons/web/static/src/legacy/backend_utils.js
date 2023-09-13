/** @odoo-module **/

function getGlobalState(legacyControllerState) {
    const { resIds, searchPanel } = legacyControllerState;
    const globalState = {};
    if (searchPanel) {
        globalState.searchPanel = searchPanel;
    }
    if (resIds) {
        globalState.resIds = resIds;
    }
    return globalState;
}

export function mapDoActionOptionAPI(legacyOptions) {
    legacyOptions = legacyOptions || {};
    // use camelCase instead of snake_case for some keys
    Object.assign(legacyOptions, {
        additionalContext: legacyOptions.additional_context,
        clearBreadcrumbs: legacyOptions.clear_breadcrumbs,
        viewType: legacyOptions.view_type,
        onClose: legacyOptions.on_close,
        props: Object.assign({ resId: legacyOptions.res_id }, legacyOptions.props),
    });
    if (legacyOptions.controllerState) {
        legacyOptions.props.globalState = getGlobalState(legacyOptions.controllerState);
    }
    delete legacyOptions.additional_context;
    delete legacyOptions.clear_breadcrumbs;
    delete legacyOptions.view_type;
    delete legacyOptions.res_id;
    delete legacyOptions.on_close;
    return legacyOptions;
}

export function breadcrumbsToLegacy(breadcrumbs) {
    if (!breadcrumbs) {
        return;
    }
    return breadcrumbs.slice(0, -1).map((bc) => {
        return { title: bc.name, controllerID: bc.jsId };
    });
}
