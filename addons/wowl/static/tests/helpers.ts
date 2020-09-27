import { Component } from "@odoo/owl";
import { makeEnv, OdooEnv } from "../src/env";
import { Registries } from "../src/registries";
import { Registry } from "../src/registry";
import { Type } from "../src/types";

export { OdooEnv } from "../src/env";

interface MountParameters {
  env: OdooEnv;
  target: HTMLElement;
}

export async function mount<T extends Type<Component>>(
  C: T,
  params: MountParameters
): Promise<InstanceType<T>> {
  ((C as any) as typeof Component).env = params.env;
  const component: Component = new C(null);
  await component.mount(params.target);
  return component as any;
}

let templates: string;

export function setTemplates(xml: string) {
  templates = xml;
}

interface TestEnvParam {
  services?: Registries["services"];
  Components?: Registries["Components"];
}

export function makeTestEnv(params: TestEnvParam = {}): OdooEnv {
  let registries: Registries = {
    services: params.services || new Registry(),
    Components: params.Components || new Registry(),
  };

  return makeEnv(templates, registries);
}

export function getFixture(): HTMLElement {
  return document.querySelector("#qunit-fixture") as HTMLElement;
}
