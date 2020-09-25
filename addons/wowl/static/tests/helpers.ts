import { Component } from "@odoo/owl";
import { OdooEnv } from "../src/env";

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
