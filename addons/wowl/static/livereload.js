(function () {
  let delay = 1000;

  function startLiveReload() {
    const ws = new WebSocket("ws://localhost:8070");
    let isOpen = false;
    ws.onopen = function () {
      delay = 1000;
      isOpen = true;
      console.log(`[livereload] connection established`);
    };

    ws.onmessage = function (evt) {
      if (evt.data === "refresh") {
        location.reload();
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

  startLiveReload();
})();
