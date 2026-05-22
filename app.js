const sheet = document.querySelector(".sheet");
const modeButtons = document.querySelectorAll(".mode-button");
const colorInputs = document.querySelectorAll('input[type="color"]');
const keywordInputs = document.querySelectorAll('input[data-field="keywords"]');
const imageDropZones = document.querySelectorAll(".image-drop");
const savePngButton = document.querySelector("#savePngButton");
const imageStates = new WeakMap();
const minImageScale = 1.08;
const mobileCanvasWidth = 1460;

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

  requestAnimationFrame(updateScaledLayoutHeight);
}

function updateScaledLayoutHeight() {
  const source = document.querySelector(".app-shell");

  if (window.matchMedia("(max-width: 1100px)").matches) {
    const scale = Math.max(0.1, (window.innerWidth - 16) / mobileCanvasWidth);
    document.body.style.minHeight = `${source.scrollHeight * scale + 24}px`;
  } else {
    document.body.style.minHeight = "";
  }
}

function refreshImageLayouts() {
  imageDropZones.forEach((zone) => {
    if (!zone.classList.contains("has-image")) {
      return;
    }

    updateImageTransform(zone);
    clampImagePosition(zone);
    updateImageTransform(zone);
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

  if (preview.naturalWidth && preview.naturalHeight && zone.clientWidth && zone.clientHeight) {
    const zoneRatio = zone.clientWidth / zone.clientHeight;
    const imageRatio = preview.naturalWidth / preview.naturalHeight;
    let baseWidth = zone.clientWidth;
    let baseHeight = zone.clientHeight;

    if (imageRatio > zoneRatio) {
      baseHeight = zone.clientHeight;
      baseWidth = baseHeight * imageRatio;
    } else {
      baseWidth = zone.clientWidth;
      baseHeight = baseWidth / imageRatio;
    }

    preview.style.width = `${baseWidth}px`;
    preview.style.height = `${baseHeight}px`;
    preview.style.left = `${(zone.clientWidth - baseWidth) / 2}px`;
    preview.style.top = `${(zone.clientHeight - baseHeight) / 2}px`;
  }

  preview.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
}

function clampImagePosition(zone) {
  const preview = zone.querySelector("[data-image-preview]");
  const state = getImageState(zone);
  const baseWidth = parseFloat(preview.style.width) || zone.clientWidth;
  const baseHeight = parseFloat(preview.style.height) || zone.clientHeight;
  const maxX = Math.max(0, (baseWidth * state.scale - zone.clientWidth) / 2);
  const maxY = Math.max(0, (baseHeight * state.scale - zone.clientHeight) / 2);

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
    updateImageTransform(zone);
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
  updateImageTransform(zone);
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
      updateImageTransform(zone);
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
      const staticCheckbox = document.createElement("span");
      staticCheckbox.className = "export-checkbox";
      staticCheckbox.textContent = sourceField.checked ? "✓" : "";
      cloneField.replaceWith(staticCheckbox);
      return;
    }

    if (sourceField.type === "color") {
      const staticColor = document.createElement("span");
      staticColor.className = "export-color";
      staticColor.style.backgroundColor = sourceField.value;
      cloneField.replaceWith(staticColor);
      return;
    }

    if (sourceField.tagName === "TEXTAREA") {
      const staticText = document.createElement("div");
      staticText.className = `${sourceField.className} export-static-field export-static-textarea`.trim();
      staticText.textContent = sourceField.value.trim() || sourceField.placeholder || "";
      cloneField.replaceWith(staticText);
      return;
    }

    if (sourceField.type === "text") {
      const staticText = document.createElement("div");
      staticText.className = "export-static-field";
      staticText.textContent = sourceField.value.trim() || sourceField.placeholder || "";
      cloneField.replaceWith(staticText);
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

function colorIsVisible(color) {
  return color && color !== "transparent" && !color.endsWith(", 0)") && color !== "rgba(0, 0, 0, 0)";
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getElementRect(element, rootRect) {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left - rootRect.left,
    y: rect.top - rootRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function getFont(style) {
  return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function wrapText(ctx, text, maxWidth) {
  const normalized = text.replace(/\r/g, "");
  const result = [];

  function pushWrappedToken(token, prefix = "") {
    let current = prefix;

    Array.from(token).forEach((char) => {
      const next = current + char;

      if (current && ctx.measureText(next).width > maxWidth) {
        result.push(current.trimEnd());
        current = char;
      } else {
        current = next;
      }
    });

    return current;
  }

  normalized.split("\n").forEach((line) => {
    const words = line.split(/(\s+)/).filter(Boolean);
    let current = "";

    words.forEach((word) => {
      const next = current + word;

      if (ctx.measureText(word).width > maxWidth) {
        current = pushWrappedToken(word.trimStart(), current);
      } else if (current && ctx.measureText(next).width > maxWidth) {
        result.push(current.trimEnd());
        current = word.trimStart();
      } else {
        current = next;
      }
    });

    result.push(current || "");
  });

  return result;
}

function drawTextBlock(ctx, text, rect, style, options = {}) {
  const content = (text || "").trim();

  if (!content) {
    return;
  }

  const fontSize = parseFloat(style.fontSize) || 14;
  const rawLineHeight = Number.parseFloat(style.lineHeight);
  const lineHeight = Number.isFinite(rawLineHeight) ? rawLineHeight : fontSize * 1.35;
  const paddingX = options.paddingX ?? 12;
  const paddingY = options.paddingY ?? 10;
  const maxWidth = Math.max(1, rect.width - paddingX * 2);

  ctx.save();
  ctx.font = options.font || getFont(style);
  ctx.fillStyle = options.color || (colorIsVisible(style.color) ? style.color : "#252525");
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = options.align || style.textAlign || "left";

  const lines = wrapText(ctx, content, maxWidth);
  const maxLines = Math.max(1, Math.floor((rect.height - paddingY * 2) / lineHeight));
  const visibleLines = lines.slice(0, maxLines);
  const textHeight = visibleLines.length * lineHeight;
  let y = rect.y + paddingY + fontSize;

  if (options.verticalCenter) {
    y = rect.y + Math.max(fontSize, (rect.height - textHeight) / 2 + fontSize * 0.8);
  }

  let x = rect.x + paddingX;
  if (ctx.textAlign === "center") {
    x = rect.x + rect.width / 2;
  } else if (ctx.textAlign === "right") {
    x = rect.x + rect.width - paddingX;
  }

  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();

  visibleLines.forEach((line) => {
    ctx.fillText(line, x, y);
    y += lineHeight;
  });

  ctx.restore();
}

async function drawImageDrop(ctx, element, rect) {
  const image = element.querySelector("[data-image-preview]");

  if (!image?.src || !element.classList.contains("has-image")) {
    return;
  }

  if (!image.complete) {
    await image.decode();
  }

  const state = getImageState(element);
  const scale = state.scale || minImageScale;
  const rectRatio = rect.width / rect.height;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  let baseWidth = rect.width;
  let baseHeight = rect.height;

  if (imageRatio > rectRatio) {
    baseHeight = rect.height;
    baseWidth = baseHeight * imageRatio;
  } else {
    baseWidth = rect.width;
    baseHeight = baseWidth / imageRatio;
  }

  const drawWidth = baseWidth * scale;
  const drawHeight = baseHeight * scale;
  const drawX = rect.x + (rect.width - drawWidth) / 2 + state.x;
  const drawY = rect.y + (rect.height - drawHeight) / 2 + state.y;

  ctx.save();
  drawRoundRect(ctx, rect.x, rect.y, rect.width, rect.height, 8);
  ctx.clip();
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function shouldSkipExportElement(element) {
  return element.matches(".toolbar, .toolbar *, input[type='file'], .image-reset, .upload-hint");
}

async function renderElement(ctx, element, rootRect) {
  if (!(element instanceof HTMLElement) || shouldSkipExportElement(element)) {
    return;
  }

  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return;
  }

  const rect = getElementRect(element, rootRect);
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const radius = parseFloat(style.borderTopLeftRadius) || 0;
  let background = style.backgroundColor;
  const borderColor = style.borderTopColor;
  const borderWidth = parseFloat(style.borderTopWidth) || 0;

  if (!colorIsVisible(background) && element.matches(".portrait, .small-image")) {
    background = getComputedStyle(document.documentElement).getPropertyValue("--panel-soft").trim() || "#ebe7dd";
  }

  ctx.save();
  if (colorIsVisible(background)) {
    drawRoundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    ctx.fillStyle = background;
    ctx.fill();
  }

  if (borderWidth > 0 && colorIsVisible(borderColor)) {
    drawRoundRect(ctx, rect.x + borderWidth / 2, rect.y + borderWidth / 2, rect.width - borderWidth, rect.height - borderWidth, radius);
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
  }
  ctx.restore();

  if (element.classList.contains("image-drop")) {
    await drawImageDrop(ctx, element, rect);
  }

  if (element.matches("input[type='color']")) {
    ctx.save();
    drawRoundRect(ctx, rect.x, rect.y, rect.width, rect.height, 7);
    ctx.fillStyle = element.value;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (element.matches("input[type='checkbox']")) {
    ctx.save();
    ctx.strokeStyle = "#7a7a7a";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x, rect.y, 13, 13);
    if (element.checked) {
      ctx.fillStyle = "#252525";
      ctx.fillText("✓", rect.x + 2, rect.y + 11);
    }
    ctx.restore();
    return;
  }

  if (element.matches("input[type='text'], textarea")) {
    const hasValue = Boolean(element.value.trim());
    const text = hasValue ? element.value : element.placeholder || "";
    const placeholderFontSize = element.classList.contains("image-text-note") ? 12 : parseFloat(style.fontSize) || 14;

    drawTextBlock(ctx, text, rect, style, {
      align: style.textAlign,
      verticalCenter: element.classList.contains("image-text-note"),
      paddingX: element.classList.contains("image-text-note") ? 8 : 12,
      paddingY: element.classList.contains("image-text-note") ? 8 : 10,
      color: hasValue ? undefined : "rgba(37, 37, 37, 0.42)",
      font: hasValue ? undefined : `700 ${placeholderFontSize}px ${style.fontFamily}`,
    });
    return;
  }

  if (element.children.length === 0 || element.matches("h1, h2, p, span, strong, .keyword-strip")) {
    drawTextBlock(ctx, element.textContent, rect, style, {
      align: style.textAlign,
      verticalCenter: element.matches(".image-label, .portrait-note, .keyword-strip, h2"),
      paddingX: element.matches(".keyword-strip") ? 16 : 4,
      paddingY: 4,
    });
  }

  for (const child of element.children) {
    await renderElement(ctx, child, rootRect);
  }

  if (element.matches(".required-box label") && element.querySelector("input[type='checkbox']")) {
    drawTextBlock(ctx, element.textContent, rect, style, {
      align: "left",
      verticalCenter: true,
      paddingX: 22,
      paddingY: 0,
    });
  }
}

async function renderSheetToCanvas(source) {
  document.body.classList.add("exporting-png");
  await new Promise((resolve) => requestAnimationFrame(resolve));

  try {
    const width = Math.ceil(source.scrollWidth);
    const height = Math.ceil(source.scrollHeight);
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const rootRect = source.getBoundingClientRect();

    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f4f2ec";
    ctx.fillRect(0, 0, width, height);

    await renderElement(ctx, source, rootRect);

    return canvas;
  } finally {
    document.body.classList.remove("exporting-png");
    updateScaledLayoutHeight();
  }
}

async function saveAsPng() {
  const source = document.querySelector(".app-shell");
  savePngButton.disabled = true;
  savePngButton.textContent = "저장 중...";

  try {
    const canvas = await renderSheetToCanvas(source);
    downloadDataUrl(canvas.toDataURL("image/png"), "commission-sheet.png");
  } catch (error) {
    console.error(error);
    alert("PNG 저장 중 문제가 생겼습니다. 사진을 초기화하거나 더 작은 이미지로 바꾼 뒤 다시 시도해 주세요.");
  } finally {
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

document.querySelectorAll(".image-text-note").forEach((note) => {
  ["click", "dblclick", "pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "wheel"].forEach((eventName) => {
    note.addEventListener(eventName, (event) => event.stopPropagation());
  });
});

savePngButton.addEventListener("click", saveAsPng);
window.addEventListener("resize", () => {
  updateScaledLayoutHeight();
  refreshImageLayouts();
});
new ResizeObserver(updateScaledLayoutHeight).observe(document.querySelector(".app-shell"));
updateScaledLayoutHeight();
