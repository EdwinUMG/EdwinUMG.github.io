/**
 * rf-engine.js
 * Motor matemático de propagación y balance de enlace.
 */

const RFEngine = {
  C_LIGHT: 299792458,      // m/s
  THRESHOLD_CUTOFF: -95,   // dBm
  REF_FREQ_MHZ: 850,       // MHz

  calcLambda(freqHz) {
    if (freqHz <= 0) return 0;
    return this.C_LIGHT / freqHz;
  },

  // FSPL (dB) = 20*log10(d) + 20*log10(f_MHz) - 27.55
  calcFSPL(distMeters, freqMHz) {
    if (distMeters <= 0.1) return 0;
    return (20 * Math.log10(distMeters)) + (20 * Math.log10(freqMHz)) - 27.55;
  },

  calcMaterialAlpha(material, freqMHz) {
    if (!material) return 0;
    return material.baseAlpha * Math.pow(freqMHz / this.REF_FREQ_MHZ, material.gamma);
  },

  /**
   * Calcula la atenuación total de las capas del muro.
   * Convierte automáticamente el grosor de centímetros a metros.
   * L_muro = ∑ [ α_i(f) * (grosor_cm / 100) ]
   */
  calcCompositeWallLoss(layers, catalog, freqMHz) {
    return layers.reduce((acc, layer) => {
      const mat = catalog[layer.materialId];
      if (!mat) return acc;
      const alpha = this.calcMaterialAlpha(mat, freqMHz);
      const thicknessMeters = (layer.thicknessCm ?? 0) / 100;
      return acc + (alpha * thicknessMeters);
    }, 0);
  },

  calcLinkBudget(txPowerDbm, fsplDb, wallLossDb) {
    return txPowerDbm - fsplDb - wallLossDb;
  },

  evaluateLinkStatus(prx) {
    if (prx < this.THRESHOLD_CUTOFF) {
      return { bars: 0, status: 'Sin Servicio (Bloqueo Efectivo)', colorClass: 'text-rose-400', isConnected: false };
    } else if (prx < -90) {
      return { bars: 1, status: 'Conexión Marginal / Inestable', colorClass: 'text-amber-400', isConnected: true };
    } else if (prx < -80) {
      return { bars: 2, status: 'Conexión Aceptable', colorClass: 'text-yellow-400', isConnected: true };
    } else if (prx < -70) {
      return { bars: 3, status: 'Buena Cobertura', colorClass: 'text-emerald-400', isConnected: true };
    } else {
      return { bars: 4, status: 'Excelente Cobertura', colorClass: 'text-emerald-300', isConnected: true };
    }
  }
};

const MaterialStore = {
  data: {
    brick: { name: 'Ladrillo Cerámico', baseAlpha: 10, gamma: 0.35 },
    concrete: { name: 'Concreto Reforzado', baseAlpha: 30, gamma: 0.45 },
    sand_block: { name: 'Block Relleno de Arena', baseAlpha: 45, gamma: 0.40 },
    metal_mesh: { name: 'Malla Metálica / Faraday', baseAlpha: 120, gamma: 0.55 },
    drywall: { name: 'Tablayeso / Drywall', baseAlpha: 4, gamma: 0.20 }
  },

  register(id, name, baseAlpha, gamma) {
    this.data[id] = {
      name,
      baseAlpha: parseFloat(baseAlpha),
      gamma: parseFloat(gamma)
    };
  },

  getAll() {
    return this.data;
  },

  get(id) {
    return this.data[id];
  }
};