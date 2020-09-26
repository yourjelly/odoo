import { Component } from "@odoo/owl";
import { makeEnv, OdooEnv } from "../src/env";
import { Registry } from "../src/registry";
import type { Service } from "../src/services";

export { OdooEnv } from "../src/env";

interface MountParameters {
  env: OdooEnv;
  target: HTMLElement;
}

class A {}

export async function mount<T extends typeof A>(
  C: T,
  params: MountParameters
): Promise<InstanceType<T>> {
  ((C as any) as typeof Component).env = params.env;
  const component: Component = new (C as any)(null);
  await component.mount(params.target);
  return component as any;
}

let templates: string;

export function setTemplates(xml: string) {
  templates = xml;
}

export function makeTestEnv(services?: Registry<Service>): OdooEnv {
  if (!services) {
    services = new Registry();
  }
  const env = makeEnv(templates, services);
  return env;
}
