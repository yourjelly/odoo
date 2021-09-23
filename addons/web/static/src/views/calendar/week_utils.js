/** @odoo-module **/

export function calculateWeekNumber(date) {
    return luxon.DateTime.fromJSDate(date).weekNumber;
    // return moment(date).week();
}
