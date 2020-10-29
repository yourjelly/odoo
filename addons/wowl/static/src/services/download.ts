import download from "../libs/download";
import { _t } from "../core/localization";
import parse from "../libs/content-disposition";

interface DownloadFileOptionsFromForm {
  type: "form";
  form: HTMLFormElement;
}

interface DownloadFileOptionsFromParams {
  type: "params";
  url: string;
  data: Map<string, string | Blob>;
}

interface DownloadFileOptionsCallbacks {
  success?: () => void;
  error?: (error: {
    message: string;
    data: {
      name?: string;
      title: string;
    };
  }) => void;
  complete?: () => void;
}

type DownloadFileOptions = (DownloadFileOptionsFromForm | DownloadFileOptionsFromParams) &
  DownloadFileOptionsCallbacks;

// TODO change with auth logic
const csrf_token_todo = "Hello there";

/**
 * Cooperative file download implementation, for ajaxy APIs.
 *
 * Requires that the server side implements an httprequest correctly
 * setting the `fileToken` cookie to the value provided as the `token`
 * parameter. The cookie *must* be set on the `/` path and *must not* be
 * `httpOnly`.
 *
 * It would probably also be a good idea for the response to use a
 * `Content-Disposition: attachment` header, especially if the MIME is a
 * "known" type (e.g. text/plain, or for some browsers application/json
 *
 * @param {Object} options
 * @param {String} [options.url] used to dynamically create a form
 * @param {Object} [options.data] data to add to the form submission. If can be used without a form, in which case a form is created from scratch. Otherwise, added to form data
 * @param {HTMLFormElement} [options.form] the form to submit in order to fetch the file
 * @param {Function} [options.success] callback in case of download success
 * @param {Function} [options.error] callback in case of request error, provided with the error body
 * @param {Function} [options.complete] called after both ``success`` and ``error`` callbacks have executed
 * @returns {boolean} a false value means that a popup window was blocked. This
 *   mean that we probably need to inform the user that something needs to be
 *   changed to make it work.
 */
export function getFile(options: DownloadFileOptions) {
  const xhr: XMLHttpRequest = new XMLHttpRequest();

  let data: FormData;

  if (options.type === "form") {
    xhr.open(options.form.method, options.form.action);
    data = new FormData(options.form);
  } else {
    xhr.open("POST", options.url!);
    data = new FormData();
    options.data.forEach((v, k) => {
      data.append(k, v);
    });
  }

  data.append("token", "dummy-because-api-expects-one");

  // TODO change with auth logic
  if (csrf_token_todo) {
    data.append("csrf_token", csrf_token_todo);
  }

  // IE11 wants this after xhr.open or it throws
  xhr.responseType = "blob";

  xhr.onload = () => {
    const mimetype = xhr.response.type;
    if (xhr.status === 200 && mimetype !== "text/html") {
      // replace because apparently we send some C-D headers with a trailing ";"
      const header = (xhr.getResponseHeader("Content-Disposition") || "").replace(/;$/, "");
      const filename = header ? (parse(header).parameters as any).filename : null;
      download(xhr.response, filename, mimetype);
      if (options.success) {
        options.success();
      }
      return true;
    }

    if (!options.error) {
      return true;
    }

    const decoder = new FileReader();
    decoder.onload = () => {
      const contents = decoder.result as string;
      let err;
      const doc = new DOMParser().parseFromString(contents, "text/html");
      const nodes = doc.body.children.length === 0 ? doc.body.childNodes : doc.body.children;
      try {
        // Case of a serialized Odoo Exception: It is Json Parsable
        const node = nodes[1] || nodes[0];
        err = JSON.parse(node.textContent!);
      } catch (e) {
        // Arbitrary uncaught python side exception
        err = {
          message: nodes.length > 1 ? nodes[1].textContent : "",
          data: {
            name: String(xhr.status),
            title: nodes.length > 0 ? nodes[0].textContent : "",
          },
        };
      }
      options.error?.(err);
    };
    decoder.readAsText(xhr.response);
  };

  xhr.onerror = () => {
    options.error?.({
      message: _t(
        "Something happened while trying to contact the server, check that the server is online and that you still have a working network connection."
      ),
      data: { title: _t("Could not connect to the server") },
    });
  };

  xhr.onloadend = () => {
    options.complete?.();
  };

  xhr.send(data);
  return true;
}
