# ViewLoader service

| Technical name | Dependencies |
| -------------- | ------------ |
| `view_loader`  | `model`      |

## Overview

The `view_loader` service is a low level service that helps with loading view
informations (such as the arch, the `id` and other view informations).

## API

The `view_loader` service provide a single method:

- `loadView(model: string, type: ViewType, viewId?: number | false): Promise<ViewDefinition>`
  This method loads from the server the description for a view.

A `ViewDefinition` object contains the following information:

    - `arch (string)`
    - `type (ViewType)`
    - `viewId (number)`
