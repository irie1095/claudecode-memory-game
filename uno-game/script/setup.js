UNO.Setup = (function () {
  const E = UNO.Engine;

  let mode = null; // "cpu" | "pass"
  let cpuCount = 1;
  let passCount = 2;

  function init() {
    document.getElementById("mode-cpu").addEventListener("click", () => selectMode("cpu"));
    document.getElementById("mode-pass").addEventListener("click", () => selectMode("pass"));

    const cpuStepper = document.getElementById("cpu-count-stepper");
    cpuStepper.querySelectorAll(".stepper-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        cpuCount = Number(btn.dataset.count);
        highlightStepper(cpuStepper, btn);
        document.getElementById("start-cpu").hidden = false;
      });
    });

    const passStepper = document.getElementById("pass-count-stepper");
    passStepper.querySelectorAll(".stepper-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        passCount = Number(btn.dataset.count);
        highlightStepper(passStepper, btn);
        renderNameInputs(passCount);
        document.getElementById("start-pass").hidden = false;
      });
    });

    document.getElementById("start-cpu").addEventListener("click", startCpuMatch);
    document.getElementById("start-pass").addEventListener("click", startPassMatch);
  }

  function highlightStepper(stepper, activeBtn) {
    stepper.querySelectorAll(".stepper-btn").forEach((b) => {
      b.classList.toggle("selected", b === activeBtn);
    });
  }

  function selectMode(m) {
    mode = m;
    document.getElementById("step-cpu-count").hidden = m !== "cpu";
    document.getElementById("step-pass-count").hidden = m !== "pass";
  }

  function renderNameInputs(count) {
    const container = document.getElementById("name-inputs");
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 8;
      input.placeholder = `プレイヤー${i + 1}`;
      input.id = `name-input-${i}`;
      container.appendChild(input);
    }
  }

  function startCpuMatch() {
    const seatsConfig = [{ name: "あなた", controller: "human-visible" }];
    for (let i = 1; i <= cpuCount; i++) {
      seatsConfig.push({ name: `CPU${i}`, controller: "cpu" });
    }
    E.startMatch(seatsConfig);
    UNO.UI.startGame();
  }

  function startPassMatch() {
    const seatsConfig = [];
    for (let i = 0; i < passCount; i++) {
      const input = document.getElementById(`name-input-${i}`);
      const name = (input && input.value.trim()) || `プレイヤー${i + 1}`;
      seatsConfig.push({ name, controller: "human-hidden" });
    }
    E.startMatch(seatsConfig);
    UNO.UI.startGame();
  }

  return { init };
})();
