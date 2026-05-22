const sheet = document.querySelector(".sheet");
const modeButtons = document.querySelectorAll(".mode-button");
const colorInputs = document.querySelectorAll('input[type="color"]');
const keywordInputs = document.querySelectorAll('input[data-field="keywords"]');
const imageDropZones = document.querySelectorAll(".image-drop");
const savePngButton = document.querySelector("#savePngButton");
const imageStates = new WeakMap();
const minImageScale = 1.08;

const cssVarMap = {
  left: {
    theme: "--left-theme",
    hair: "--left-hair",
    eye: "--left-eye",
  },
  right: {
    theme: "--right-theme",
    hair: "--right-hair",
    eye: "--right-eye",
  },
};

function setMode(mode) {
  sheet.classList.toggle("mode-pair", mode === "pair");
  sheet.classList.toggle("mode-single", mode === "single");

  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
}

function updateColor(input) {
  const character = input.dataset.characterInput;
  const field = input.dataset.field;
  const cssVar = cssVarMap[character]?.[field];

  if (cssVar) {
    document.documentElement.style.setProperty(cssVar, input.value);
  }
}

function updateKeywordPreview(input) {
  const character = input.dataset.characterInput;
  const characterNode = document.querySelector(`[data-character="${character}"]`);
  const preview = characterNode?.querySelector('[data-preview="keywords"]');

  if (preview) {
    preview.textContent = input.value.trim() || "성격 키워드 / 성격 키워드 / 성격 키워드...";
  }
}

function getImageState(zone) {
  if (!imageStates.has(zone)) {
    imageStates.set(zone, {
      x: 0,
      y: 0,
      scale: minImageScale,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
      isDragging: false,
      moved: false,
      suppressClick: false,
    });
  }

  return imageStates.get(zone);
}

function updateImageTransform(zone) {
  const preview = zone.querySelector("[data-image-preview]");
  const state = getImageState(zone);

  preview.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
}

function clampImagePosition(zone) {
  const state = getImageState(zone);
  const maxX = (zone.clientWidth * (state.scale - 1)) / 2;
  const maxY = (zone.clientHeight * (state.scale - 1)) / 2;

  state.x = Math.max(-maxX, Math.min(maxX, state.x));
  state.y = Math.max(-maxY, Math.min(maxY, state.y));
}

function applyImage(file, zone) {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }

  const reader = new FileReader();
  const preview = zone.querySelector("[data-image-preview]");
  const state = getImageState(zone);

  reader.addEventListener("load", () => {
    preview.src = reader.result;
    state.x = 0;
    state.y = 0;
    state.scale = minImageScale;
    clampImagePosition(zone);
    updateImageTransform(zone);
    zone.classList.add("has-image");
  });

  reader.readAsDataURL(file);
}

function resetImage(zone) {
  const input = zone.querySelector("[data-image-input]");
  const preview = zone.querySelector("[data-image-preview]");
  const state = getImageState(zone);

  input.value = "";
  preview.removeAttribute("src");
  state.x = 0;
  state.y = 0;
  state.scale = minImageScale;
  state.isDragging = false;
  state.moved = false;
  state.suppressClick = false;
  clampImagePosition(zone);
  updateImageTransform(zone);
  zone.classList.remove("has-image", "is-moving", "is-dragover");
}

function setupImageControls(zone) {
  const input = zone.querySelector("[data-image-input]");
  const resetButton = zone.querySelector(".image-reset");
  const state = getImageState(zone);

  input.addEventListener("change", () => applyImage(input.files[0], zone));

  resetButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  resetButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetImage(zone);
  });

  zone.addEventListener("click", (event) => {
    if (event.target.closest(".image-reset")) {
      return;
    }

    if (event.target.closest(".image-text-note")) {
      return;
    }

    if (zone.classList.contains("has-image")) {
      event.preventDefault();
      return;
    }

    if (state.suppressClick) {
      event.preventDefault();
      state.suppressClick = false;
      return;
    }

    input.click();
  });

  zone.addEventListener("dragstart", (event) => event.preventDefault());

  zone.addEventListener("dblclick", (event) => {
    if (event.target.closest(".image-text-note")) {
      return;
    }

    if (!zone.classList.contains("has-image")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    input.click();
  });

  zone.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".image-reset") || event.target.closest(".image-text-note")) {
      return;
    }

    if (!zone.classList.contains("has-image") || event.button !== 0) {
      return;
    }

    event.preventDefault();
    state.isDragging = true;
    state.moved = false;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = state.x;
    state.originY = state.y;
    zone.classList.add("is-moving");
    zone.setPointerCapture(event.pointerId);
  });

  zone.addEventListener("pointermove", (event) => {
    if (!state.isDragging) {
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    state.x = state.originX + dx;
    state.y = state.originY + dy;
    clampImagePosition(zone);
    state.moved = state.moved || Math.abs(dx) + Math.abs(dy) > 4;
    updateImageTransform(zone);
  });

  function stopDragging(event) {
    if (!state.isDragging) {
      return;
    }

    state.isDragging = false;
    zone.classList.remove("is-moving");

    if (zone.hasPointerCapture(event.pointerId)) {
      zone.releasePointerCapture(event.pointerId);
    }

    if (state.moved) {
      state.suppressClick = true;
    }
  }

  zone.addEventListener("pointerup", stopDragging);
  zone.addEventListener("pointercancel", stopDragging);

  zone.addEventListener(
    "wheel",
    (event) => {
      if (!zone.classList.contains("has-image")) {
        return;
      }

      event.preventDefault();
      const nextScale = state.scale + (event.deltaY > 0 ? -0.08 : 0.08);
      state.scale = Math.min(4, Math.max(minImageScale, nextScale));
      clampImagePosition(zone);
      updateImageTransform(zone);
    },
    { passive: false },
  );
}

function syncFormState(source, clone) {
  const sourceFields = source.querySelectorAll("input, textarea, select");
  const cloneFields = clone.querySelectorAll("input, textarea, select");

  sourceFields.forEach((sourceField, index) => {
    const cloneField = cloneFields[index];

    if (!cloneField) {
      return;
    }

    if (sourceField.type === "file") {
      cloneField.remove();
      return;
    }

    if (sourceField.type === "checkbox" || sourceField.type === "radio") {
      cloneField.checked = sourceField.checked;
      cloneField.toggleAttribute("checked", sourceField.checked);
      return;
    }

    cloneField.value = sourceField.value;
    cloneField.setAttribute("value", sourceField.value);

    if (sourceField.tagName === "TEXTAREA") {
      cloneField.textContent = sourceField.value;
    }
  });
}

function getStylesForExport() {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch (error) {
        return "";
      }
    })
    .join("\n");
}

function createExportClone(source) {
  const clone = source.cloneNode(true);
  const rootStyles = getComputedStyle(document.documentElement);
  const cssVars = [
    "--bg",
    "--ink",
    "--muted",
    "--line",
    "--panel",
    "--panel-soft",
    "--accent",
    "--left-theme",
    "--left-hair",
    "--left-eye",
    "--right-theme",
    "--right-hair",
    "--right-eye",
  ];

  clone.classList.add("capture-frame");
  cssVars.forEach((name) => clone.style.setProperty(name, rootStyles.getPropertyValue(name)));
  syncFormState(source, clone);

  return clone;
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

async function saveAsPng() {
  const source = document.querySelector(".app-shell");
  const width = Math.ceil(source.scrollWidth);
  const height = Math.ceil(source.scrollHeight);
  const clone = createExportClone(source);
  const styles = getStylesForExport();
  const serializedClone = new XMLSerializer().serializeToString(clone);
  const markup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${styles}</style>
          ${serializedClone}
        </div>
      </foreignObject>
    </svg>
  `;
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();

  savePngButton.disabled = true;
  savePngButton.textContent = "저장 중...";

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    const scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext("2d");
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f4f2ec";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);

    downloadDataUrl(canvas.toDataURL("image/png"), "commission-sheet.png");
  } catch (error) {
    alert("PNG 저장 중 문제가 생겼습니다. 입력한 사진이 너무 크면 용량을 줄인 뒤 다시 시도해 주세요.");
  } finally {
    URL.revokeObjectURL(svgUrl);
    savePngButton.disabled = false;
    savePngButton.textContent = "PNG 저장";
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

colorInputs.forEach((input) => {
  updateColor(input);
  input.addEventListener("input", () => updateColor(input));
});

keywordInputs.forEach((input) => {
  updateKeywordPreview(input);
  input.addEventListener("input", () => updateKeywordPreview(input));
});

imageDropZones.forEach((zone) => {
  setupImageControls(zone);

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("is-dragover");
  });

  zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("is-dragover");
    applyImage(event.dataTransfer.files[0], zone);
  });
});

savePngButton.addEventListener("click", saveAsPng);
