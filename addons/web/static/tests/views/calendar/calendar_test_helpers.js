/** @odoo-module **/

import { findItem, triggerEvent } from "../../helpers/dom";
import { click, nextTick } from "../../helpers/utils";
import * as helpers from "../helpers";

export async function changeScale(calendar, scale) {
  await click(calendar.el, `.o_calendar_button_${scale}`);
}

export function findDatePickerCurrentDayEl(calendar) {
  return calendar.el.querySelector(".o_calendar_date_picker .ui-datepicker-current-day");
}

export function findDatePickerDayEl(calendar, day) {
  return findItem(calendar.el, "[data-handler='selectDay']", day - 1);
}

export async function makeView(...args) {
  const view = await helpers.makeView(...args);
  await nextTick();
  return view;
}

async function selectInDayView(el, from, to) {
  const fromTarget = findItem(el, `[data-time="${from}"]`);

  fromTarget.scrollIntoView();
  let rect = fromTarget.getBoundingClientRect();
  await triggerEventAt(rect.left + rect.width / 2, rect.top + 1, "mousedown");

  const toTarget = findItem(el, `[data-time="${to}"]`);

  toTarget.scrollIntoView();
  rect = toTarget.getBoundingClientRect();
  await triggerEventAt(rect.left + rect.width / 2, rect.top, "mousemove");
  await triggerEventAt(rect.left + rect.width / 2, rect.top, "mouseup");
}

async function selectInMonthView(el, from, to) {}

async function selectInWeekView(el, from, to) {
  const [fromDate, fromTime] = from.split(" ");
  const [toDate, toTime] = to.split(" ");

  const fromHeader = findItem(el, `[data-date="${fromDate}"]`);
  const fromTarget = findItem(el, `[data-time="${fromTime}"]`);

  fromTarget.scrollIntoView();
  let headerRect = fromHeader.getBoundingClientRect();
  let targetRect = fromTarget.getBoundingClientRect();

  await triggerEventAt(headerRect.left + headerRect.width / 2, targetRect.top + 1, "mousedown");

  const toHeader = findItem(el, `[data-date="${toDate}"]`);
  const toTarget = findItem(el, `[data-time="${toTime}"]`);

  toTarget.scrollIntoView();
  headerRect = toHeader.getBoundingClientRect();
  targetRect = toTarget.getBoundingClientRect();

  await triggerEventAt(headerRect.left + headerRect.width / 2, targetRect.top, "mousemove");
  await triggerEventAt(headerRect.left + headerRect.width / 2, targetRect.top, "mouseup");
}

async function selectInYearView(el, from, to) {}

export async function select(calendar, viewType, from, to) {
  switch (viewType) {
    case "day":
      await selectInDayView(calendar.el, from, to);
      break;
    case "week":
      await selectInWeekView(calendar.el, from, to);
      break;
    case "month":
      await selectInMonthView(calendar.el, from, to);
      break;
    case "year":
      await selectInYearView(calendar.el, from, to);
      break;
  }
}

async function triggerEventAt(x, y, evType) {
  const target = document.elementFromPoint(x, y);
  await triggerEvent(target, evType, { pageX: x, pageY: y });
}
