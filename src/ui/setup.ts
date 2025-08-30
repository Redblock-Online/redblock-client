export function initUI() {
  const sensitivitySlider = document.getElementById("sensitivityRange") as HTMLInputElement | null;
  const sensitivityValue = document.getElementById("sensitivityValue");

  if (sensitivitySlider && sensitivityValue) {
    const savedSensitivity = localStorage.getItem("mouseSensitivity");
    if (savedSensitivity !== null) {
      sensitivitySlider.value = savedSensitivity;
      sensitivityValue.textContent = parseFloat(savedSensitivity).toFixed(2);
    }

    const update = () => {
      const value = parseFloat(sensitivitySlider.value);
      sensitivityValue.textContent = value.toFixed(2);
      localStorage.setItem("mouseSensitivity", value.toString());
    };

    sensitivitySlider.addEventListener("input", update);
  }

  const startScreen = document.querySelector(".startScreen");
  if (startScreen && isTouchDevice()) {
    startScreen.innerHTML = `
      <div class="mobile-warning">
        <div class="background"></div>
        <h1>This game is designed for PC</h1>
        <p>Please switch to a desktop or laptop for the best experience.</p>
      </div>
    `;
  }

  const exitButton = document.querySelector(".exit-button");
  exitButton?.addEventListener("click", exitGame);
}

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function exitGame() {
  if (confirm("Are you sure you want to exit?")) {
    window.close();
  }
}