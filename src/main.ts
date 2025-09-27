if (window.location.pathname.startsWith("/editor")) {
  import("./editor/initEditor").then(({ initEditor }) => {
    initEditor();
  });
} else {
  import("./gameMain").then(({ initGame }) => {
    initGame();
  });
}
