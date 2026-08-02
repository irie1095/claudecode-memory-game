OTH.Setup = (function () {
  const E = OTH.Engine;
  const B = OTH.Board;

  let difficulty = "normal";

  function init() {
    document.getElementById("mode-cpu").addEventListener("click", () => selectMode("cpu"));
    document.getElementById("mode-pass").addEventListener("click", () => selectMode("pass"));

    const stepper = document.getElementById("difficulty-stepper");
    stepper.querySelectorAll(".stepper-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        difficulty = btn.dataset.difficulty;
        stepper.querySelectorAll(".stepper-btn").forEach((b) => b.classList.toggle("selected", b === btn));
        document.getElementById("start-cpu").hidden = false;
      });
    });

    document.getElementById("start-cpu").addEventListener("click", startCpuMatch);
    document.getElementById("start-pass").addEventListener("click", startPassMatch);
  }

  function selectMode(m) {
    document.getElementById("step-difficulty").hidden = m !== "cpu";
    document.getElementById("step-pass-players").hidden = m !== "pass";
  }

  function startCpuMatch() {
    E.startGame([
      { name: "あなた", controller: "human", color: B.BLACK },
      { name: "CPU", controller: "cpu", color: B.WHITE, difficulty },
    ]);
    OTH.UI.startGame();
  }

  function startPassMatch() {
    const name0 = document.getElementById("name-input-0").value.trim() || "プレイヤー1";
    const name1 = document.getElementById("name-input-1").value.trim() || "プレイヤー2";
    E.startGame([
      { name: name0, controller: "human", color: B.BLACK },
      { name: name1, controller: "human", color: B.WHITE },
    ]);
    OTH.UI.startGame();
  }

  return { init };
})();
