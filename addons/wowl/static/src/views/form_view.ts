import { Component, tags } from "@odoo/owl";
import { View } from "./types";
const { xml } = tags;

class FormRenderer extends Component {
  static template = xml`<div>form view</div>`;
}

export const FormView: View = {
  name: "form",
  type: "form",
  Component: FormRenderer,
};
