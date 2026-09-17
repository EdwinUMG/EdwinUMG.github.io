/**
 * app.js
 * Controlador de vista y renderizado 2D sobre Canvas con paleta de colores OKLCH:
 * Modo Claro: DaisyUI "emerald"
 * Modo Oscuro: DaisyUI "halloween"
 */

const AppState = {
  isAnimationActive: true,
  theme: 'halloween', // 'halloween' | 'emerald'

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
    { materialId: 'sand_block', thicknessCm: 20 },
    { materialId: 'metal_mesh', thicknessCm: 5 },
    { materialId: 'concrete', thicknessCm: 20 }
  ],

  cell: {
    x: 270,
    y: 170,
    width: 260,
    height: 260
  },

  tx: { x: 90, y: 120, radius: 14, isDragging: false },
  rx: { x: 400, y: 300, radius: 10, isDragging: false },

  isInsidePenitentiary(x, y) {
    return x >= this.cell.x &&
           x <= this.cell.x + this.cell.width &&
           y >= this.cell.y &&
           y <= this.cell.y + this.cell.height;
  }
};

const CanvasRenderer = {
  canvas: null,
  ctx: null,
  wavePhase: 0,

  init() {
    this.canvas = document.getElementById('simCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.setupInteractions();
    this.startLoop();
  },

  // Retorna la paleta de colores en OKLCH según el tema activo
  getThemePalette() {
    const isHalloween = AppState.theme === 'halloween';

    if (isHalloween) {
      // --- TEMA OSCURO: HALLOWEEN ---
      return {
        canvasBg: 'oklch(14% 0.004 49.25)',             // base-200
        grid: 'oklch(24.371% 0.046 65.681 / 0.45)',     // neutral atenuado
        cellBg: 'oklch(0% 0 0)',                        // base-300
        cellWall: 'oklch(24.371% 0.046 65.681)',        // neutral
        cellBorder: 'oklch(45.98% 0.248 305.03)',       // secondary (morado halloween)
        cellTitle: 'oklch(84.955% 0 0)',                // base-content
        cellSub: 'oklch(84.955% 0 0 / 0.65)',
        waveColor: (a) => `oklch(77.48% 0.204 60.62 / ${a})`,      // primary (naranja calabaza)
        waveAttenuatedColor: (a) => `oklch(65.72% 0.199 27.33 / ${a})`, // error (rojo sangre)
        rayLine: 'oklch(45.98% 0.248 305.03)',          // secondary
        rayTagBg: 'oklch(21% 0.006 56.043)',            // base-100
        rayTagBorder: 'oklch(45.98% 0.248 305.03)',
        rayTagText: 'oklch(89.196% 0.049 305.03)',
        txFill: 'oklch(77.48% 0.204 60.62)',            // primary
        txStroke: 'oklch(84.955% 0 0)',
        rxInside: 'oklch(65.72% 0.199 27.33)',          // error
        rxOutside: 'oklch(64.8% 0.223 136.073)',        // accent (verde eléctrico)
        rxBorder: 'oklch(84.955% 0 0)',
        rulerStroke: 'oklch(84.955% 0 0 / 0.2)',
        rulerText: 'oklch(84.955% 0 0 / 0.7)',
        scaleBar: 'oklch(84.955% 0 0 / 0.8)',
        barActive: 'oklch(64.8% 0.223 136.073)',
        barInactive: 'oklch(24.371% 0.046 65.681)'
      };
    } else {
      // --- TEMA CLARO: EMERALD ---
      return {
        canvasBg: 'oklch(93% 0 0)',                      // base-200
        grid: 'oklch(86% 0 0)',                         // base-300
        cellBg: 'oklch(100% 0 0)',                      // base-100
        cellWall: 'oklch(35.519% 0.032 262.988)',       // neutral
        cellBorder: 'oklch(61.302% 0.202 261.294)',     // secondary
        cellTitle: 'oklch(35.519% 0.032 262.988)',      // base-content
        cellSub: 'oklch(35.519% 0.032 262.988 / 0.7)',
        waveColor: (a) => `oklch(76.662% 0.135 153.45 / ${a})`,    // primary (esmeralda menta)
        waveAttenuatedColor: (a) => `oklch(71.76% 0.221 22.18 / ${a})`, // error (salmón / coral)
        rayLine: 'oklch(61.302% 0.202 261.294)',        // secondary
        rayTagBg: 'oklch(100% 0 0)',                    // base-100
        rayTagBorder: 'oklch(61.302% 0.202 261.294)',
        rayTagText: 'oklch(35.519% 0.032 262.988)',
        txFill: 'oklch(76.662% 0.135 153.45)',          // primary
        txStroke: 'oklch(33.387% 0.04 162.24)',
        rxInside: 'oklch(71.76% 0.221 22.18)',          // error
        rxOutside: 'oklch(64.8% 0.15 160)',             // success
        rxBorder: 'oklch(35.519% 0.032 262.988)',
        rulerStroke: 'oklch(35.519% 0.032 262.988 / 0.3)',
        rulerText: 'oklch(35.519% 0.032 262.988 / 0.8)',
        scaleBar: 'oklch(35.519% 0.032 262.988 / 0.8)',
        barActive: 'oklch(64.8% 0.15 160)',
        barInactive: 'oklch(86% 0 0)'
      };
    }
  },

  setupInteractions() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
        y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
      };
    };

    const isNear = (p1, p2, r) => Math.hypot(p1.x - p2.x, p1.y - p2.y) < r;

    this.canvas.addEventListener('pointerdown', (e) => {
      const pos = getPos(e);
      if (isNear(pos, AppState.tx, AppState.tx.radius + 8)) {
        AppState.tx.isDragging = true;
      } else if (isNear(pos, AppState.rx, AppState.rx.radius + 8)) {
        AppState.rx.isDragging = true;
      }
    });

    window.addEventListener('pointermove', (e) => {
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

    window.addEventListener('pointerup', () => {
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
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const maxRadius = Math.hypot(w, h);

    // 2. Ondas en espacio abierto
    ctx.lineWidth = 1.4;
    for (let r = this.wavePhase; r < maxRadius; r += 24) {
      ctx.beginPath();
      ctx.arc(AppState.tx.x, AppState.tx.y, r, 0, Math.PI * 2);
      const alphaFade = Math.max(0, 1 - (r / (maxRadius * 0.75)));
      ctx.strokeStyle = theme.waveColor(0.40 * alphaFade);
      ctx.stroke();
    }

    // 3. Celda Penitenciaria
    const cell = AppState.cell;
    ctx.fillStyle = theme.cellBg;
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);

    // 4. Ondas confinadas en el interior
    const wallLoss = RFEngine.calcCompositeWallLoss(AppState.wallLayers, MaterialStore.getAll(), AppState.freqMHz);
    const penetration = Math.pow(10, -wallLoss / 30);
    const waveOpacity = Math.max(0.015, Math.min(0.4, 0.45 * penetration));

    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x, cell.y, cell.width, cell.height);
    ctx.clip();

    for (let r = this.wavePhase; r < maxRadius; r += 24) {
      ctx.beginPath();
      ctx.arc(AppState.tx.x, AppState.tx.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = theme.waveAttenuatedColor(waveOpacity);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Muros perimetrales
    const totalThicknessCm = AppState.wallLayers.reduce((acc, l) => acc + l.thicknessCm, 0);
    const visualWallPx = Math.max(6, Math.min(26, Math.round(totalThicknessCm * 0.18)));

    ctx.strokeStyle = theme.cellWall;
    ctx.lineWidth = visualWallPx;
    ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

    ctx.strokeStyle = theme.cellBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

    const cellRealWidthKm = ((cell.width * AppState.scaleMetersPerPixel) / 1000).toFixed(2);
    const cellRealHeightKm = ((cell.height * AppState.scaleMetersPerPixel) / 1000).toFixed(2);

    ctx.fillStyle = theme.cellTitle;
    ctx.font = 'bold 10px monospace';
    ctx.fillText('RECINTO PENITENCIARIO', cell.x + 12, cell.y + 20);
    ctx.fillStyle = theme.cellSub;
    ctx.font = '9px monospace';
    ctx.fillText(`Dimensión: ${cellRealWidthKm}km × ${cellRealHeightKm}km`, cell.x + 12, cell.y + 34);

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
    const pixelDist = Math.hypot(AppState.tx.x - AppState.rx.x, AppState.tx.y - AppState.rx.y);
    const realDistKm = ((pixelDist * AppState.scaleMetersPerPixel) / 1000).toFixed(2);

    ctx.fillStyle = theme.rayTagBg;
    ctx.fillRect(midX - 30, midY - 9, 60, 16);
    ctx.strokeStyle = theme.rayTagBorder;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(midX - 30, midY - 9, 60, 16);
    ctx.fillStyle = theme.rayTagText;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${realDistKm} km`, midX, midY + 3);
    ctx.textAlign = 'left';

    // 7. Transmisor (Tx)
    ctx.beginPath();
    ctx.arc(AppState.tx.x, AppState.tx.y, AppState.tx.radius, 0, Math.PI * 2);
    ctx.fillStyle = theme.txFill;
    ctx.fill();
    ctx.strokeStyle = theme.txStroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('Tx', AppState.tx.x - 6, AppState.tx.y + 3);

    // 8. Receptor (Rx)
    const rxInside = AppState.isInsidePenitentiary(AppState.rx.x, AppState.rx.y);
    ctx.beginPath();
    ctx.arc(AppState.rx.x, AppState.rx.y, AppState.rx.radius, 0, Math.PI * 2);
    ctx.fillStyle = rxInside ? theme.rxInside : theme.rxOutside;
    ctx.fill();
    ctx.strokeStyle = theme.rxBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('Rx', AppState.rx.x - 6, AppState.rx.y + 3);

    // 9. Reglas métricas y escala gráfica
    this.drawMetricRulers(ctx, w, h, theme);
  },

  drawMetricRulers(ctx, w, h, theme) {
    ctx.fillStyle = theme.rulerText;
    ctx.font = '9px monospace';

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
      const posX = Math.max(4, Math.min(w - textWidth - 4, px - (textWidth / 2)));
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
    const realKmForScale = ((scalePx * AppState.scaleMetersPerPixel) / 1000).toFixed(2);
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
    ctx.fillText(`${realKmForScale} km`, originX + (scalePx / 2) - 20, originY - 6);
  }
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
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    AppState.theme = prefersDark.matches ? 'halloween' : 'emerald';
    this.applyTheme(AppState.theme);

    prefersDark.addEventListener('change', (e) => {
      AppState.theme = e.matches ? 'halloween' : 'emerald';
      this.applyTheme(AppState.theme);
      this.refreshTelemetry();
    });
  },

  applyTheme(theme) {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    if (theme === 'halloween') {
      themeIcon.innerText = '🎃';
      themeLabel.innerText = 'Halloween';
    } else {
      themeIcon.innerText = '💎';
      themeLabel.innerText = 'Emerald';
    }
  },

  toggleTheme() {
    AppState.theme = AppState.theme === 'halloween' ? 'emerald' : 'halloween';
    this.applyTheme(AppState.theme);
    this.refreshTelemetry();
  },

  checkAccessibilityMotionPreference() {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      AppState.isAnimationActive = false;
    }
    this.updateAnimationButtonUI();

    motionQuery.addEventListener('change', (e) => {
      AppState.isAnimationActive = !e.matches;
      this.updateAnimationButtonUI();
    });
  },

  updateAnimationButtonUI() {
    const dot = document.getElementById('animIndicatorDot');
    const label = document.getElementById('animToggleLabel');
    
    if (AppState.isAnimationActive) {
      dot.className = 'w-2 h-2 rounded-full bg-primary shadow-sm';
      label.innerText = 'Animación: ON';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-base-300';
      label.innerText = 'Animación: OFF';
    }
  },

  bindSidebarToggle() {
    const btn = document.getElementById('btnToggleSidebar');
    const sidebar = document.getElementById('sidebar');

    btn.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  },

  bindDOMEvents() {
    document.getElementById('btnToggleTheme').addEventListener('click', () => {
      this.toggleTheme();
    });

    document.getElementById('btnToggleAnimation').addEventListener('click', () => {
      AppState.isAnimationActive = !AppState.isAnimationActive;
      this.updateAnimationButtonUI();
    });

    const terrainXInput = document.getElementById('terrainXInput');
    terrainXInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        AppState.terrainWidthKmX = val;
        this.updateTerrainDisplays();
        this.refreshTelemetry();
      }
    });

    document.getElementById('techPreset').addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      AppState.freqMHz = val;
      document.getElementById('freqSlider').value = val;
      document.getElementById('freqLabel').innerText = `${val} MHz`;
      this.renderCatalogTable();
      this.refreshTelemetry();
    });

    document.getElementById('freqSlider').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      AppState.freqMHz = val;
      document.getElementById('freqLabel').innerText = `${val} MHz`;
      this.renderCatalogTable();
      this.refreshTelemetry();
    });

    document.getElementById('txPower').addEventListener('input', (e) => {
      AppState.txPowerDbm = parseFloat(e.target.value) || 0;
      this.refreshTelemetry();
    });

    document.getElementById('btnAddLayer').addEventListener('click', () => {
      const defaultMat = Object.keys(MaterialStore.getAll())[0];
      AppState.wallLayers.push({ materialId: defaultMat, thicknessCm: 15 });
      this.renderWallLayersList();
      this.refreshTelemetry();
    });

    document.getElementById('toggleMaterialForm').addEventListener('click', () => {
      document.getElementById('newMaterialForm').classList.toggle('hidden');
    });

    document.getElementById('newMaterialForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('matName').value;
      const alpha = document.getElementById('matAlpha').value;
      const gamma = document.getElementById('matGamma').value;
      const id = 'mat_' + Date.now();

      MaterialStore.register(id, name, alpha, gamma);
      this.renderCatalogTable();
      this.renderWallLayersList();
      this.refreshTelemetry();

      e.target.reset();
      e.target.classList.add('hidden');
    });
  },

  updateTerrainDisplays() {
    const xKm = AppState.terrainWidthKmX;
    const yKm = AppState.terrainHeightKmY;
    const areaKm2 = xKm * yKm;
    const resolutionMetersPerPx = AppState.scaleMetersPerPixel;

    document.getElementById('terrainXDisplay').innerText = `${xKm.toFixed(2)} km`;
    document.getElementById('terrainYDisplay').innerText = `${yKm.toFixed(2)} km`;
    document.getElementById('terrainAreaDisplay').innerText = `${areaKm2.toFixed(2)} km²`;
    document.getElementById('terrainResolutionDisplay').innerText = `${resolutionMetersPerPx.toFixed(2)} m/px`;
    document.getElementById('terrainScaleIndicator').innerText = `${xKm.toFixed(2)} km × ${yKm.toFixed(2)} km`;
  },

  renderWallLayersList() {
    const container = document.getElementById('layersContainer');
    container.innerHTML = '';
    const materials = MaterialStore.getAll();

    AppState.wallLayers.forEach((layer, idx) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 py-1 text-xs';

      const select = document.createElement('select');
      select.className = 'bg-base-200 border border-base-300 text-base-content rounded px-2 py-1 text-xs flex-1 outline-none focus:border-primary';
      for (let mId in materials) {
        const opt = document.createElement('option');
        opt.value = mId;
        opt.textContent = materials[mId].name;
        if (mId === layer.materialId) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', (e) => {
        layer.materialId = e.target.value;
        this.refreshTelemetry();
      });

      const thickness = document.createElement('input');
      thickness.type = 'number';
      thickness.min = '1';
      thickness.max = '200';
      thickness.step = '1';
      thickness.value = layer.thicknessCm;
      thickness.className = 'w-14 bg-base-200 border border-base-300 text-base-content rounded px-1.5 py-1 text-xs font-mono text-right outline-none focus:border-primary';
      thickness.addEventListener('input', (e) => {
        layer.thicknessCm = parseFloat(e.target.value) || 0;
        this.refreshTelemetry();
      });

      const btnDelete = document.createElement('button');
      btnDelete.innerHTML = '&times;';
      btnDelete.className = 'opacity-50 hover:text-error hover:opacity-100 font-bold px-1 text-sm transition';
      btnDelete.addEventListener('click', () => {
        if (AppState.wallLayers.length > 1) {
          AppState.wallLayers.splice(idx, 1);
          this.renderWallLayersList();
          this.refreshTelemetry();
        }
      });

      row.appendChild(select);
      row.appendChild(thickness);
      row.appendChild(document.createTextNode('cm'));
      row.appendChild(btnDelete);
      container.appendChild(row);
    });
  },

  renderCatalogTable() {
    const tbody = document.getElementById('materialsTableBody');
    tbody.innerHTML = '';
    const materials = MaterialStore.getAll();

    for (let mId in materials) {
      const mat = materials[mId];
      const currentAlpha = RFEngine.calcMaterialAlpha(mat, AppState.freqMHz).toFixed(1);
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-base-200/50';
      tr.innerHTML = `
        <td class="py-1.5 pr-2 font-sans text-base-content">${mat.name}</td>
        <td class="py-1.5 px-2 opacity-60">${mat.baseAlpha}</td>
        <td class="py-1.5 pl-2 text-right text-primary font-semibold">${currentAlpha}</td>
      `;
      tbody.appendChild(tr);
    }
  },

  refreshTelemetry() {
    const pixelDist = Math.hypot(AppState.tx.x - AppState.rx.x, AppState.tx.y - AppState.rx.y);
    const distMeters = pixelDist * AppState.scaleMetersPerPixel;
    const distKm = distMeters / 1000;
    const freqHz = AppState.freqMHz * 1e6;

    const lambda = RFEngine.calcLambda(freqHz);
    const fspl = RFEngine.calcFSPL(distMeters, AppState.freqMHz);

    const rxIn = AppState.isInsidePenitentiary(AppState.rx.x, AppState.rx.y);
    const txIn = AppState.isInsidePenitentiary(AppState.tx.x, AppState.tx.y);

    let wallLoss = 0;
    if (rxIn !== txIn) {
      wallLoss = RFEngine.calcCompositeWallLoss(AppState.wallLayers, MaterialStore.getAll(), AppState.freqMHz);
    }

    const prx = RFEngine.calcLinkBudget(AppState.txPowerDbm, fspl, wallLoss);
    const evaluation = RFEngine.evaluateLinkStatus(prx);
    const theme = CanvasRenderer.getThemePalette();

    document.getElementById('telemetryDistance').innerText = `${distKm.toFixed(2)} km`;
    document.getElementById('telemetryLambda').innerText = `${(lambda * 100).toFixed(2)} cm`;
    document.getElementById('telemetryFSPL').innerText = `${fspl.toFixed(2)} dB`;
    document.getElementById('telemetryWallLoss').innerText = `${wallLoss.toFixed(2)} dB`;

    const totalThicknessCm = AppState.wallLayers.reduce((acc, l) => acc + l.thicknessCm, 0);
    document.getElementById('totalThicknessLabel').innerText = `${totalThicknessCm.toFixed(1)} cm`;

    document.getElementById('phonePrx').innerText = `${prx.toFixed(2)} dBm`;
    const phoneStatus = document.getElementById('phoneStatus');
    phoneStatus.innerText = evaluation.status;
    phoneStatus.className = `text-xs font-semibold ${evaluation.isConnected ? 'text-success' : 'text-error'}`;

    const bars = document.querySelectorAll('#signalBarContainer .signal-bar');
    bars.forEach((bar, index) => {
      if (index < evaluation.bars) {
        bar.style.backgroundColor = theme.barActive;
      } else {
        bar.style.backgroundColor = theme.barInactive;
      }
    });
  }
};

window.addEventListener('DOMContentLoaded', () => {
  CanvasRenderer.init();
  ViewController.init();
});