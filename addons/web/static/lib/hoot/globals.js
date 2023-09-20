/** @odoo-module */

// Import initial Window object to prevent them from being patched
export const Boolean = window.Boolean;
export const clearInterval = window.clearInterval;
export const clearTimeout = window.clearTimeout;
export const console = window.console;
export const CustomEvent = window.CustomEvent;
export const Date = window.Date;
export const document = window.document;
export const Error = window.Error;
export const EventTarget = window.EventTarget;
export const history = window.history;
export const JSON = window.JSON;
export const localStorage = window.localStorage;
export const location = window.location;
export const Map = window.Map;
export const matchMedia = window.matchMedia;
export const navigator = window.navigator;
export const Number = window.Number;
export const Object = window.Object;
export const ontouchstart = window.ontouchstart;
export const Promise = window.Promise;
export const Proxy = window.Proxy;
export const RegExp = window.RegExp;
export const sessionStorage = window.sessionStorage;
export const Set = window.Set;
export const setInterval = window.setInterval;
export const setTimeout = window.setTimeout;
export const String = window.String;
export const URL = window.URL;
export const URLSearchParams = window.URLSearchParams;
