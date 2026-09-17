/**
 * app.js
 * Controlador de vista y renderizado 2D sobre Canvas con paleta contrastada por capas:
 *
 * Modo Claro:
 *   - Fondos y paneles: Platinum
 *   - Textos y líneas de alto contraste: Shadow-Grey
 *   - Primario (neutro / botones / Tx): Raspberry-Plum
 *   - Refuerzo positivo: Emerald
 *   - Refuerzo negativo: Tiger-Flame
 *
 * Modo Oscuro:
 *   - Fondos y paneles: Shadow-Grey
 *   - Textos y líneas de alto contraste: Platinum
 *   - Primario (neutro / botones / Tx): Cerulean
 *   - Refuerzo positivo: Radioactive-Grass
 *   - Refuerzo negativo: Spicy-Orange
 */

const AppState = {
  isAnimationActive: true,
  theme: "dark",

  terrainWidthKmX: 1.4,

  get terrainHeightKmY() {
    return this.terrainWidthKmX * (600 / 800);
  },

  get scaleMetersPerPixel() {
    return (this.terrainWidthKmX * 1000) / 800;
  },

  freqMHz: 2100,
  txPowerDbm: 43,

  wallLayers: [
    { materialId: "sand_block", thicknessCm: 20 },
    { materialId: "metal_mesh", thicknessCm: 5 },
    { materialId: "concrete", thicknessCm: 20 },
  ],

  cell: {
    x: 270,
    y: 170,
    width: 260,
    height: 260,
  },

  tx: { x: 90, y: 120, radius: 14, isDragging: false },
  rx: { x: 400, y: 300, radius: 10, isDragging: false },

  isInsidePenitentiary(x, y) {
    return (
      x >= this.cell.x &&
      x <= this.cell.x + this.cell.width &&
      y >= this.cell.y &&
      y <= this.cell.y + this.cell.height
    );
  },
};

const CanvasRenderer = {
  canvas: null,
  ctx: null,
  wavePhase: 0,

  init() {
    this.canvas = document.getElementById("simCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.setupInteractions();
    this.startLoop();
  },

  getThemePalette() {
    const isDark = AppState.theme === "dark";

    if (isDark) {
      // --- TEMA OSCURO (Fondos: Shadow-Grey | Textos: Platinum | Acentos: Cerulean / Radioactive-Grass / Spicy-Orange) ---
      return {
        canvasBg: "#110d17", // shadow-grey-950
        grid: "#302541", // shadow-grey-800
        cellBg: "#181320", // shadow-grey-900
        cellWall: "#483861", // shadow-grey-700
        cellBorder: "#859dad", // platinum-400 (línea alto contraste)
        cellTitle: "#f0f3f5", // platinum-50 (texto alto contraste)
        cellSub: "#a3b6c2", // platinum-300
        waveRgb: "14, 184, 241", // cerulean-500 (#0eb8f1)
        waveAttenuatedRgb: "245, 88, 10", // spicy-orange-500 (#f5580a)
        rayLine: "#3ec6f4", // cerulean-400
        rayTagBg: "#181320", // shadow-grey-900
        rayTagBorder: "#0eb8f1", // cerulean-500
        rayTagText: "#f0f3f5", // platinum-50
        txFill: "#0b93c1", // cerulean-600
        txStroke: "#f0f3f5", // platinum-50
        rxInside: "#f5580a", // spicy-orange-500 (negativo)
        rxOutside: "#1fe31c", // radioactive-grass-500 (positivo)
        rxBorder: "#f0f3f5", // platinum-50
        rulerStroke: "#302541", // shadow-grey-800
        rulerText: "#859dad", // platinum-400
        scaleBar: "#a3b6c2", // platinum-300
        barActive: "#1fe31c", // radioactive-grass-500
        barInactive: "#302541", // shadow-grey-800
      };
    } else {
      // --- TEMA CLARO (Fondos: Platinum | Textos: Shadow-Grey | Acentos: Raspberry-Plum / Emerald / Tiger-Flame) ---
      return {
        canvasBg: "#f0f3f5", // platinum-50
        grid: "#c2ced6", // platinum-200
        cellBg: "#e0e7eb", // platinum-100
        cellWall: "#a3b6c2", // platinum-300
        cellBorder: "#483861", // shadow-grey-700 (línea alto contraste)
        cellTitle: "#181320", // shadow-grey-900 (texto alto contraste)
        cellSub: "#483861", // shadow-grey-700
        waveRgb: "250, 5, 168", // raspberry-plum-500 (#fa05a8)
        waveAttenuatedRgb: "238, 79, 17", // tiger-flame-500 (#ee4f11)
        rayLine: "#c80487", // raspberry-plum-600
        rayTagBg: "#f0f3f5", // platinum-50
        rayTagBorder: "#c80487", // raspberry-plum-600
        rayTagText: "#181320", // shadow-grey-900
        txFill: "#c80487", // raspberry-plum-600
        txStroke: "#181320", // shadow-grey-900
        rxInside: "#ee4f11", // tiger-flame-500 (negativo)
        rxOutside: "#42bd80", // emerald-500 (positivo)
        rxBorder: "#181320", // shadow-grey-900
        rulerStroke: "#c2ced6", // platinum-200
        rulerText: "#483861", // shadow-grey-700
        scaleBar: "#302541", // shadow-grey-800
        barActive: "#42bd80", // emerald-500
        barInactive: "#c2ced6", // platinum-200
      };
    }
  },

  setupInteractions() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
        y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
      };
    };

    const isNear = (p1, p2, r) => Math.hypot(p1.x - p2.x, p1.y - p2.y) < r;

    this.canvas.addEventListener("pointerdown", (e) => {
      const pos = getPos(e);
      if (isNear(pos, AppState.tx, AppState.tx.radius + 8)) {
        AppState.tx.isDragging = true;
      } else if (isNear(pos, AppState.rx, AppState.rx.radius + 8)) {
        AppState.rx.isDragging = true;
      }
    });

    window.addEventListener("pointermove", (e) => {
      const pos = getPos(e);
      if (AppState.tx.isDragging) {
        AppState.tx.x = Math.max(25, Math.min(this.canvas.width - 25, pos.x));
        AppState.tx.y = Math.max(25, Math.min(this.canvas.height - 25, pos.y));
        ViewController.refreshTelemetry();
      } else if (AppState.rx.isDragging) {
        AppState.rx.x = Math.max(25, Math.min(this.canvas.width - 25, pos.x));
        AppState.rx.y = Math.max(25, Math.min(this.canvas.height - 25, pos.y));
        ViewController.refreshTelemetry();
      }
    });

    window.addEventListener("pointerup", () => {
      AppState.tx.isDragging = false;
      AppState.rx.isDragging = false;
    });
  },

  startLoop() {
    const frame = () => {
      if (AppState.isAnimationActive) {
        this.wavePhase = (this.wavePhase + 0.8) % 24;
      } else {
        this.wavePhase = 0;
      }
      this.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const theme = this.getThemePalette();

    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, w, h);

    // 1. Cuadrícula métrica espacial
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const maxRadius = Math.hypot(w, h);

    // 2. Ondas en espacio abierto
    ctx.lineWidth = 1.4;
    for (let r = this.wavePhase; r < maxRadius; r += 24) {
      ctx.beginPath();
      ctx.arc(AppState.tx.x, AppState.tx.y, r, 0, Math.PI * 2);
      const alphaFade = Math.max(0, 1 - r / (maxRadius * 0.75));
      ctx.strokeStyle = `rgba(${theme.waveRgb}, ${0.4 * alphaFade})`;
      ctx.stroke();
    }

    // 3. Celda Penitenciaria
    const cell = AppState.cell;
    ctx.fillStyle = theme.cellBg;
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);

    // 4. Ondas confinadas en el interior
    const wallLoss = RFEngine.calcCompositeWallLoss(
      AppState.wallLayers,
      MaterialStore.getAll(),
      AppState.freqMHz,
    );
    const penetration = Math.pow(10, -wallLoss / 30);
    const waveOpacity = Math.max(0.015, Math.min(0.4, 0.45 * penetration));

    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x, cell.y, cell.width, cell.height);
    ctx.clip();

    for (let r = this.wavePhase; r < maxRadius; r += 24) {
      ctx.beginPath();
      ctx.arc(AppState.tx.x, AppState.tx.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${theme.waveAttenuatedRgb}, ${waveOpacity})`;
      ctx.stroke();
    }
    ctx.restore();

    // 5. Muros perimetrales
    const totalThicknessCm = AppState.wallLayers.reduce(
      (acc, l) => acc + l.thicknessCm,
      0,
    );
    const visualWallPx = Math.max(
      6,
      Math.min(26, Math.round(totalThicknessCm * 0.18)),
    );

    ctx.strokeStyle = theme.cellWall;
    ctx.lineWidth = visualWallPx;
    ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

    ctx.strokeStyle = theme.cellBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

    const cellRealWidthKm = (
      (cell.width * AppState.scaleMetersPerPixel) /
      1000
    ).toFixed(2);
    const cellRealHeightKm = (
      (cell.height * AppState.scaleMetersPerPixel) /
      1000
    ).toFixed(2);

    ctx.fillStyle = theme.cellTitle;
    ctx.font = "bold 10px monospace";
    ctx.fillText("RECINTO PENITENCIARIO", cell.x + 12, cell.y + 20);
    ctx.fillStyle = theme.cellSub;
    ctx.font = "9px monospace";
    ctx.fillText(
      `Dimensión: ${cellRealWidthKm}km × ${cellRealHeightKm}km`,
      cell.x + 12,
      cell.y + 34,
    );

    // 6. Vector de línea de vista con cota
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = theme.rayLine;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(AppState.tx.x, AppState.tx.y);
    ctx.lineTo(AppState.rx.x, AppState.rx.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const midX = (AppState.tx.x + AppState.rx.x) / 2;
    const midY = (AppState.tx.y + AppState.rx.y) / 2;
    const pixelDist = Math.hypot(
      AppState.tx.x - AppState.rx.x,
      AppState.tx.y - AppState.rx.y,
    );
    const realDistKm = (
      (pixelDist * AppState.scaleMetersPerPixel) /
      1000
    ).toFixed(2);

    ctx.fillStyle = theme.rayTagBg;
    ctx.fillRect(midX - 30, midY - 9, 60, 16);
    ctx.strokeStyle = theme.rayTagBorder;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(midX - 30, midY - 9, 60, 16);
    ctx.fillStyle = theme.rayTagText;
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${realDistKm} km`, midX, midY + 3);
    ctx.textAlign = "left";

    // 7. Transmisor (Tx)
    ctx.beginPath();
    ctx.arc(AppState.tx.x, AppState.tx.y, AppState.tx.radius, 0, Math.PI * 2);
    ctx.fillStyle = theme.txFill;
    ctx.fill();
    ctx.strokeStyle = theme.txStroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText("Tx", AppState.tx.x - 6, AppState.tx.y + 3);

    // 8. Receptor (Rx)
    const rxInside = AppState.isInsidePenitentiary(
      AppState.rx.x,
      AppState.rx.y,
    );
    ctx.beginPath();
    ctx.arc(AppState.rx.x, AppState.rx.y, AppState.rx.radius, 0, Math.PI * 2);
    ctx.fillStyle = rxInside ? theme.rxInside : theme.rxOutside;
    ctx.fill();
    ctx.strokeStyle = theme.rxBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px sans-serif";
    ctx.fillText("Rx", AppState.rx.x - 6, AppState.rx.y + 3);

    // 9. Reglas métricas y escala gráfica
    this.drawMetricRulers(ctx, w, h, theme);
  },

  drawMetricRulers(ctx, w, h, theme) {
    ctx.fillStyle = theme.rulerText;
    ctx.font = "9px monospace";

    // Regla superior (Eje X en km)
    ctx.strokeStyle = theme.rulerStroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(w, 16);
    ctx.stroke();

    const divisionsX = 4;
    for (let i = 0; i <= divisionsX; i++) {
      const px = (w / divisionsX) * i;
      const km = ((AppState.terrainWidthKmX / divisionsX) * i).toFixed(2);

      ctx.beginPath();
      ctx.moveTo(px, 12);
      ctx.lineTo(px, 20);
      ctx.stroke();

      const label = `${km} km`;
      const textWidth = ctx.measureText(label).width;
      const posX = Math.max(4, Math.min(w - textWidth - 4, px - textWidth / 2));
      ctx.fillText(label, posX, 10);
    }

    // Regla vertical (Eje Y en km)
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16, h);
    ctx.stroke();

    const divisionsY = 3;
    for (let i = 0; i <= divisionsY; i++) {
      const py = (h / divisionsY) * i;
      const km = ((AppState.terrainHeightKmY / divisionsY) * i).toFixed(2);

      ctx.beginPath();
      ctx.moveTo(12, py);
      ctx.lineTo(20, py);
      ctx.stroke();

      if (py > 25 && py < h - 15) {
        ctx.fillText(`${km} km`, 22, py + 3);
      }
    }

    // Escala cartográfica inferior en km
    const scalePx = 120;
    const realKmForScale = (
      (scalePx * AppState.scaleMetersPerPixel) /
      1000
    ).toFixed(2);
    const originX = 30;
    const originY = h - 25;

    ctx.strokeStyle = theme.scaleBar;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX, originY - 4);
    ctx.lineTo(originX, originY);
    ctx.lineTo(originX + scalePx, originY);
    ctx.lineTo(originX + scalePx, originY - 4);
    ctx.stroke();

    ctx.fillStyle = theme.scaleBar;
    ctx.fillText(
      `${realKmForScale} km`,
      originX + scalePx / 2 - 20,
      originY - 6,
    );
  },
};

const ViewController = {
  init() {
    this.initTheme();
    this.checkAccessibilityMotionPreference();
    this.bindDOMEvents();
    this.bindSidebarToggle();
    this.renderWallLayersList();
    this.renderCatalogTable();
    this.updateTerrainDisplays();
    this.refreshTelemetry();
  },

  initTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    AppState.theme = prefersDark.matches ? "dark" : "light";
    this.applyTheme(AppState.theme);

    prefersDark.addEventListener("change", (e) => {
      AppState.theme = e.matches ? "dark" : "light";
      this.applyTheme(AppState.theme);
      this.refreshTelemetry();
    });
  },

  applyTheme(theme) {
    const html = document.documentElement;
    const themeIcon = document.getElementById("themeIcon");
    const themeLabel = document.getElementById("themeLabel");

    if (theme === "dark") {
      html.classList.add("dark");
      themeIcon.innerText = "🌙";
      themeLabel.innerText = "Oscuro";
    } else {
      html.classList.remove("dark");
      themeIcon.innerText = "☀️";
      themeLabel.innerText = "Claro";
    }
  },

  toggleTheme() {
    AppState.theme = AppState.theme === "dark" ? "light" : "dark";
    this.applyTheme(AppState.theme);
    this.refreshTelemetry();
  },

  checkAccessibilityMotionPreference() {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      AppState.isAnimationActive = false;
    }
    this.updateAnimationButtonUI();

    motionQuery.addEventListener("change", (e) => {
      AppState.isAnimationActive = !e.matches;
      this.updateAnimationButtonUI();
    });
  },

  updateAnimationButtonUI() {
    const dot = document.getElementById("animIndicatorDot");
    const label = document.getElementById("animToggleLabel");
    const isDark = AppState.theme === "dark";

    if (AppState.isAnimationActive) {
      dot.className = `w-2 h-2 rounded-full ${isDark ? "bg-cerulean-400" : "bg-raspberry-plum-500"} shadow-sm`;
      label.innerText = "Animación: ON";
    } else {
      dot.className = `w-2 h-2 rounded-full ${isDark ? "bg-shadow-grey-700" : "bg-platinum-400"}`;
      label.innerText = "Animación: OFF";
    }
  },

  bindSidebarToggle() {
    const btn = document.getElementById("btnToggleSidebar");
    const sidebar = document.getElementById("sidebar");

    btn.addEventListener("click", () => {
      sidebar.classList.toggle("hidden");
    });
  },

  bindDOMEvents() {
    document.getElementById("btnToggleTheme").addEventListener("click", () => {
      this.toggleTheme();
    });

    document
      .getElementById("btnToggleAnimation")
      .addEventListener("click", () => {
        AppState.isAnimationActive = !AppState.isAnimationActive;
        this.updateAnimationButtonUI();
      });

    const terrainXInput = document.getElementById("terrainXInput");
    terrainXInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        AppState.terrainWidthKmX = val;
        this.updateTerrainDisplays();
        this.refreshTelemetry();
      }
    });

    document.getElementById("techPreset").addEventListener("change", (e) => {
      const val = parseFloat(e.target.value);
      AppState.freqMHz = val;
      document.getElementById("freqSlider").value = val;
      document.getElementById("freqLabel").innerText = `${val} MHz`;
      this.renderCatalogTable();
      this.refreshTelemetry();
    });

    document.getElementById("freqSlider").addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      AppState.freqMHz = val;
      document.getElementById("freqLabel").innerText = `${val} MHz`;
      this.renderCatalogTable();
      this.refreshTelemetry();
    });

    document.getElementById("txPower").addEventListener("input", (e) => {
      AppState.txPowerDbm = parseFloat(e.target.value) || 0;
      this.refreshTelemetry();
    });

    document.getElementById("btnAddLayer").addEventListener("click", () => {
      const defaultMat = Object.keys(MaterialStore.getAll())[0];
      AppState.wallLayers.push({ materialId: defaultMat, thicknessCm: 15 });
      this.renderWallLayersList();
      this.refreshTelemetry();
    });

    document
      .getElementById("toggleMaterialForm")
      .addEventListener("click", () => {
        document.getElementById("newMaterialForm").classList.toggle("hidden");
      });

    document
      .getElementById("newMaterialForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("matName").value;
        const alpha = document.getElementById("matAlpha").value;
        const gamma = document.getElementById("matGamma").value;
        const id = "mat_" + Date.now();

        MaterialStore.register(id, name, alpha, gamma);
        this.renderCatalogTable();
        this.renderWallLayersList();
        this.refreshTelemetry();

        e.target.reset();
        e.target.classList.add("hidden");
      });
  },

  updateTerrainDisplays() {
    const xKm = AppState.terrainWidthKmX;
    const yKm = AppState.terrainHeightKmY;
    const areaKm2 = xKm * yKm;
    const resolutionMetersPerPx = AppState.scaleMetersPerPixel;

    document.getElementById("terrainXDisplay").innerText =
      `${xKm.toFixed(2)} km`;
    document.getElementById("terrainYDisplay").innerText =
      `${yKm.toFixed(2)} km`;
    document.getElementById("terrainAreaDisplay").innerText =
      `${areaKm2.toFixed(2)} km²`;
    document.getElementById("terrainResolutionDisplay").innerText =
      `${resolutionMetersPerPx.toFixed(2)} m/px`;
    document.getElementById("terrainScaleIndicator").innerText =
      `${xKm.toFixed(2)} km × ${yKm.toFixed(2)} km`;
  },

  renderWallLayersList() {
    const container = document.getElementById("layersContainer");
    container.innerHTML = "";
    const materials = MaterialStore.getAll();
    const isDark = AppState.theme === "dark";

    AppState.wallLayers.forEach((layer, idx) => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 py-1 text-xs";

      const select = document.createElement("select");
      select.className =
        "bg-platinum-50 dark:bg-shadow-grey-800 border border-platinum-300 dark:border-shadow-grey-700 text-shadow-grey-900 dark:text-platinum-100 rounded px-2 py-1 text-xs flex-1 outline-none focus:border-raspberry-plum-500 dark:focus:border-cerulean-400";
      for (let mId in materials) {
        const opt = document.createElement("option");
        opt.value = mId;
        opt.textContent = materials[mId].name;
        if (mId === layer.materialId) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener("change", (e) => {
        layer.materialId = e.target.value;
        this.refreshTelemetry();
      });

      const thickness = document.createElement("input");
      thickness.type = "number";
      thickness.min = "1";
      thickness.max = "200";
      thickness.step = "1";
      thickness.value = layer.thicknessCm;
      thickness.className =
        "w-14 bg-platinum-50 dark:bg-shadow-grey-800 border border-platinum-300 dark:border-shadow-grey-700 text-shadow-grey-900 dark:text-platinum-100 rounded px-1.5 py-1 text-xs font-mono text-right outline-none focus:border-raspberry-plum-500 dark:focus:border-cerulean-400";
      thickness.addEventListener("input", (e) => {
        layer.thicknessCm = parseFloat(e.target.value) || 0;
        this.refreshTelemetry();
      });

      const btnDelete = document.createElement("button");
      btnDelete.innerHTML = "&times;";
      btnDelete.className =
        "text-shadow-grey-500 hover:text-tiger-flame-600 dark:text-platinum-400 dark:hover:text-spicy-orange-400 font-bold px-1 text-sm transition";
      btnDelete.addEventListener("click", () => {
        if (AppState.wallLayers.length > 1) {
          AppState.wallLayers.splice(idx, 1);
          this.renderWallLayersList();
          this.refreshTelemetry();
        }
      });

      row.appendChild(select);
      row.appendChild(thickness);
      row.appendChild(document.createTextNode("cm"));
      row.appendChild(btnDelete);
      container.appendChild(row);
    });
  },

  // Renderizado dinámico del catálogo UIT-R P.2040 en app.js
  renderCatalogTable() {
    const tbody = document.getElementById("materialsTableBody");
    tbody.innerHTML = "";
    const materials = MaterialStore.getAll();

    for (let mId in materials) {
      const mat = materials[mId];
      let attenuationText = "";

      if (mat.isMesh) {
        const se = RFEngine.calcMeshShielding(
          (mat.defaultApertureMm ?? 5) / 1000.0,
          AppState.freqMHz,
        );
        attenuationText = `${se.toFixed(1)} dB (SE)`;
      } else {
        const alpha = RFEngine.calcUITRAlpha(mat, AppState.freqMHz);
        attenuationText = `${alpha.toFixed(1)} dB/m`;
      }

      const tr = document.createElement("tr");
      tr.className =
        "hover:bg-platinum-200/50 dark:hover:bg-shadow-grey-800/40";
      tr.innerHTML = `
      <td class="py-1.5 pr-2 font-sans text-shadow-grey-800 dark:text-platinum-200">${mat.name}</td>
      <td class="py-1.5 px-2 text-shadow-grey-500 dark:text-platinum-400 font-mono">${mat.isMesh ? "Malla" : `a=${mat.a}`}</td>
      <td class="py-1.5 pl-2 text-right text-raspberry-plum-600 dark:text-cerulean-400 font-semibold font-mono">${attenuationText}</td>
    `;
      tbody.appendChild(tr);
    }
  },

  // Actualización de Telemetría e Intersecciones Vectoriales en app.js
  refreshTelemetry() {
    const pixelDist = Math.hypot(
      AppState.tx.x - AppState.rx.x,
      AppState.tx.y - AppState.rx.y,
    );
    const distMeters = pixelDist * AppState.scaleMetersPerPixel;
    const distKm = distMeters / 1000.0;
    const freqHz = AppState.freqMHz * 1e6;

    const lambda = RFEngine.calcLambda(freqHz);
    const fspl = RFEngine.calcFSPL(distMeters, AppState.freqMHz);

    // Definición de los 4 segmentos de pared del penal
    const c = AppState.cell;
    const walls = [
      {
        pA: { x: c.x, y: c.y },
        pB: { x: c.x + c.width, y: c.y },
        norm: { x: 0, y: -1 },
      }, // Muro Superior
      {
        pA: { x: c.x + c.width, y: c.y },
        pB: { x: c.x + c.width, y: c.y + c.height },
        norm: { x: 1, y: 0 },
      }, // Muro Derecho
      {
        pA: { x: c.x + c.width, y: c.y + c.height },
        pB: { x: c.x, y: c.y + c.height },
        norm: { x: 0, y: 1 },
      }, // Muro Inferior
      {
        pA: { x: c.x, y: c.y + c.height },
        pB: { x: c.x, y: c.y },
        norm: { x: -1, y: 0 },
      }, // Muro Izquierdo
    ];

    const rayVec = {
      x: AppState.rx.x - AppState.tx.x,
      y: AppState.rx.y - AppState.tx.y,
    };
    let totalWallLoss = 0;

    // Evalúa qué muros corta el rayo Tx -> Rx y acumula su atenuación oblicua
    walls.forEach((wall) => {
      const intersects = RFEngine.checkRaySegmentIntersection(
        AppState.tx,
        AppState.rx,
        wall.pA,
        wall.pB,
      );
      if (intersects) {
        // Factor de corrección angular 1 / cos(θ_i)
        const dot = Math.abs(rayVec.x * wall.norm.x + rayVec.y * wall.norm.y);
        const magRay = Math.hypot(rayVec.x, rayVec.y);
        const cosTheta = Math.max(dot / magRay, RFEngine.MIN_COS_THETA);
        const obliquityFactor = 1.0 / cosTheta;

        totalWallLoss += RFEngine.calcCompositeWallLoss(
          AppState.wallLayers,
          MaterialStore.getAll(),
          AppState.freqMHz,
          obliquityFactor,
        );
      }
    });

    const prx = RFEngine.calcLinkBudget(
      AppState.txPowerDbm,
      fspl,
      totalWallLoss,
    );
    const evaluation = RFEngine.evaluateLinkStatus(prx);
    const theme = CanvasRenderer.getThemePalette();

    // Actualización de lecturas en la interfaz
    document.getElementById("telemetryDistance").innerText =
      `${distKm.toFixed(2)} km`;
    document.getElementById("telemetryLambda").innerText =
      `${(lambda * 100).toFixed(2)} cm`;
    document.getElementById("telemetryFSPL").innerText =
      `${fspl.toFixed(2)} dB`;
    document.getElementById("telemetryWallLoss").innerText =
      `${totalWallLoss.toFixed(2)} dB`;

    const totalThicknessCm = AppState.wallLayers.reduce(
      (acc, l) => acc + (l.thicknessCm ?? 0),
      0,
    );
    document.getElementById("totalThicknessLabel").innerText =
      `${totalThicknessCm.toFixed(1)} cm`;

    document.getElementById("phonePrx").innerText = `${prx.toFixed(2)} dBm`;
    const phoneStatus = document.getElementById("phoneStatus");
    phoneStatus.innerText = evaluation.status;
    phoneStatus.className = `text-xs font-semibold ${evaluation.isConnected ? "text-emerald-600 dark:text-radioactive-grass-400" : "text-tiger-flame-600 dark:text-spicy-orange-400"}`;

    const bars = document.querySelectorAll("#signalBarContainer .signal-bar");
    bars.forEach((bar, index) => {
      bar.style.backgroundColor =
        index < evaluation.bars ? theme.barActive : theme.barInactive;
    });
  },
};

window.addEventListener("DOMContentLoaded", () => {
  CanvasRenderer.init();
  ViewController.init();
});
