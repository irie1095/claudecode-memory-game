MJ.Main = (function () {
  function newGameFlow() {
    MJ.Game.newGame();
    MJ.Game.setOnChange(MJ.UI.render);
    MJ.Game.startHand();
  }

  function init() {
    MJ.UI.bindStaticButtons();
    newGameFlow();
  }

  function restart() {
    newGameFlow();
  }

  return { init, restart };
})();

document.addEventListener("DOMContentLoaded", MJ.Main.init);
