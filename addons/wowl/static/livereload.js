(function () {
  let delay = 1000;

  function startLiveReload() {
    const ws = new WebSocket(`ws://${location.hostname}:8070`);
    let isOpen = false;
    ws.onopen = function () {
      delay = 1000;
      isOpen = true;
      console.log(`[livereload] connection established`);
    };

    ws.onmessage = function (evt) {
      if (evt.data === "refresh") {
        location.reload();
      } else if (evt.data === "refresh:css") {
        reloadStyles();
      }
    };

    ws.onclose = function () {
      const status = isOpen ? "closed" : "unavailable";
      console.log(`[livereload] connection ${status}... retrying...`);
      retry();
    };
  }

  function retry() {
    delay += 1000;
    setTimeout(startLiveReload, delay);
  }

  function reloadStyles() {
    const links = document.getElementsByTagName("link");
    for (let link of links) {
      if (link.getAttribute("type").indexOf("css") > -1) {
        let href = link.href.split('?')[0];
        link.href = `${href}?version=${new Date().getTime()}`;
      }
    }
  }

  startLiveReload();
})();
