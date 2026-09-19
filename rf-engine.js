/**
 * rf-engine.js
 * Motor físico-matemático de propagación de radiofrecuencia y balance de enlace.
 * Implementa:
 *  - Ecuación de Friis / FSPL estandarizada (UIT-R P.525)
 *  - Permitividad compleja y atenuación volumétrica de dieléctricos (UIT-R P.2040-1)
 *  - Aislamiento por corte inductivo en mallas metálicas de apertura finita
 *  - Corrección angular de espesor efectivo oblicuo
 *  - Trazado de rayos e intersección vectorial 2D por determinantes
 */

const RFEngine = {
  // Constantes Físicas Fundamentales
  C_LIGHT: 299792458,              // Velocidad de la luz en el vacío (m/s)
  EPSILON_0: 8.8541878128e-12,     // Permitividad del vacío (F/m)
  THRESHOLD_CUTOFF: -95.0,         // Umbral de fallo de enlace celular RLF (dBm)
  MIN_COS_THETA: 0.1736,           // Acotamiento cos(80°) para evitar asíntotas en ángulo rasante

  /**
   * Longitud de onda en el vacío: λ = c / f
   * @param {number} freqHz - Frecuencia en Hertz (Hz)
   * @returns {number} Longitud de onda en metros (m)
   */
  calcLambda(freqHz) {
    if (freqHz <= 0) return 0;
    return this.C_LIGHT / freqHz;
  },

  /**
   * Pérdida de trayectoria en espacio libre (FSPL):
   * FSPL(dB) = 20*log10(d_m) + 20*log10(f_GHz) + 32.44
   * @param {number} distMeters - Distancia euclidiana transmisor-receptor (m)
   * @param {number} freqMHz - Frecuencia de portadora (MHz)
   * @returns {number} Atenuación en decibelios (dB)
   */
  calcFSPL(distMeters, freqMHz) {
    if (distMeters <= 0.1) return 0;
    const freqGHz = freqMHz / 1000.0;
    return (20 * Math.log10(distMeters)) + (20 * Math.log10(freqGHz)) + 32.44;
  },

  /**
   * Atenuación volumétrica según Recomendación UIT-R P.2040-1:
   *  η' = a * (f_GHz)^b
   *  σ = c * (f_GHz)^d
   *  η'' = σ / (2 * π * f * ε_0)
   *  κ = sqrt( (sqrt(η'^2 + η''^2) - η') / 2 )
   *  α_Np = (2 * π * f / c) * κ
   *  α_dB/m = 8.68589 * α_Np
   *
   * @param {Object} mat - Parámetros constitutivos { a, b, c, d }
   * @param {number} freqMHz - Frecuencia de portadora (MHz)
   * @returns {number} Coeficiente de atenuación específica α (dB/m)
   */
  calcUITRAlpha(mat, freqMHz) {
    if (!mat || mat.isMesh || mat.isSolidMetal) return 0;

    const freqGHz = freqMHz / 1000.0;
    const freqHz = freqMHz * 1e6;

    // Parte real de permitividad relativa (almacenamiento de energía)
    const etaPrime = mat.a * Math.pow(freqGHz, mat.b);

    // Conductividad eléctrica aparente (S/m)
    const sigma = mat.c * Math.pow(freqGHz, mat.d);

    // Parte imaginaria de permitividad relativa (pérdidas dieléctricas y óhmicas)
    const omega = 2 * Math.PI * freqHz;
    const etaDoublePrime = sigma / (omega * this.EPSILON_0);

    // Índice de extinción electrodinámico κ
    const magnitude = Math.hypot(etaPrime, etaDoublePrime);
    const kappa = Math.sqrt(Math.max(0, (magnitude - etaPrime) / 2.0));

    // Constante de atenuación de campo en Népers por metro
    const alphaNp = (omega / this.C_LIGHT) * kappa;

    // Conversión a disipación de potencia en dB/metro lineal
    return 8.685889638 * alphaNp;
  },

  /**
   * Efectividad de blindaje para mallas metálicas de apertura sub-longitud de onda:
   * SE_malla = 20 * log10( λ / (2 * g) )  [para λ > 2g, 0 dB en caso contrario]
   *
   * @param {number} apertureMeters - Dimensión de la abertura cuadrada g (m)
   * @param {number} freqMHz - Frecuencia de portadora (MHz)
   * @returns {number} Atenuación de inserción en decibelios (dB)
   */
  calcMeshShielding(apertureMeters, freqMHz) {
    if (!apertureMeters || apertureMeters <= 0) return 0;

    const lambda = this.calcLambda(freqMHz * 1e6);
    const cutoff = 2.0 * apertureMeters;

    if (lambda <= cutoff) {
      return 0.0; // Fuga modal / transparencia electromagnética
    }

    return Math.max(0.0, 20.0 * Math.log10(lambda / cutoff));
  },

  /**
   * Espesor efectivo oblicuo atravesado por el rayo:
   * τ_eff = τ / max(cos(θ_i), 0.1736)
   *
   * @param {number} thicknessMeters - Espesor nominal del muro (m)
   * @param {Object} rayVec - Vector de dirección del rayo { x, y }
   * @param {Object} wallNormVec - Vector normal del muro { x, y }
   * @returns {number} Espesor real en metros (m)
   */
  calcEffectiveThickness(thicknessMeters, rayVec, wallNormVec) {
    if (!rayVec || !wallNormVec) return thicknessMeters;

    const dot = Math.abs(rayVec.x * wallNormVec.x + rayVec.y * wallNormVec.y);
    const magRay = Math.hypot(rayVec.x, rayVec.y);
    const magNorm = Math.hypot(wallNormVec.x, wallNormVec.y);

    if (magRay === 0 || magNorm === 0) return thicknessMeters;

    const cosTheta = dot / (magRay * magNorm);
    const cosClamped = Math.max(cosTheta, this.MIN_COS_THETA);

    return thicknessMeters / cosClamped;
  },

  /**
   * Intersección vectorial 2D entre un rayo parametrizado [0, 1] y un segmento de pared [0, 1].
   * Utiliza el determinante de Cramer (producto vectorial bidimensional).
   *
   * @param {Object} pTx - Origen del rayo { x, y }
   * @param {Object} pRx - Destino del rayo { x, y }
   * @param {Object} pA - Vértice inicial del muro { x, y }
   * @param {Object} pB - Vértice final del muro { x, y }
   * @returns {boolean} True si el rayo interseca físicamente el muro
   */
  checkRaySegmentIntersection(pTx, pRx, pA, pB) {
    const vx = pRx.x - pTx.x;
    const vy = pRx.y - pTx.y;
    const wx = pB.x - pA.x;
    const wy = pB.y - pA.y;

    const delta = vx * wy - vy * wx;
    if (Math.abs(delta) < 1e-7) return false; // Segmentos paralelos o colineales

    const dx = pA.x - pTx.x;
    const dy = pA.y - pTx.y;

    const t = (dx * wy - dy * wx) / delta;
    const u = (dx * vy - dy * vx) / delta;

    return (t >= 0.0 && t <= 1.0 && u >= 0.0 && u <= 1.0);
  },

  /**
   * Atenuación total de inserción de un muro compuesto multicapa (COST 231 MWM adaptado):
   * L_muro = ∑ [ α_i(f) * τ_eff,i ] + ∑ SE_malla,j(f)
   *
   * @param {Array} layers - Arreglo de capas [{ materialId, thicknessCm, apertureMm }]
   * @param {Object} catalog - Diccionario de materiales
   * @param {number} freqMHz - Frecuencia portadora (MHz)
   * @param {number} obliquityFactor - Factor multiplicativo 1 / cos(θ_i)
   * @returns {number} Atenuación acumulada en dB
   */
  calcCompositeWallLoss(layers, catalog, freqMHz, obliquityFactor = 1.0) {
    return layers.reduce((acc, layer) => {
      const mat = catalog[layer.materialId];
      if (!mat) return acc;

      if (mat.isSolidMetal) {
        // Blindaje continuo por reflexión y desacoplamiento de impedancia
        return acc + (mat.fixedShieldingDb ?? 120.0);
      } else if (mat.isMesh){
        // Blindaje por apertura finita
        const apertureMeters = (layer.apertureMm ?? mat.defaultApertureMm ?? 5.0) / 1000.0;
        return acc + this.calcMeshShielding(apertureMeters, freqMHz);
      } else {
        // Absorción dieléctrica volumétrica UIT-R P.2040
        const alpha = this.calcUITRAlpha(mat, freqMHz);
        const nominalThicknessMeters = (layer.thicknessCm ?? 0) / 100.0;
        const effectiveThickness = nominalThicknessMeters * obliquityFactor;
        return acc + (alpha * effectiveThickness);
      }
    }, 0);
  },

  /**
   * Presupuesto de Enlace (Link Budget):
   * Prx = EIRP - FSPL - L_muro
   *
   * @param {number} txPowerEirpDbm - Potencia Isótropa Radiada Equivalente (dBm)
   * @param {number} fsplDb - Pérdida por espacio libre (dB)
   * @param {number} wallLossDb - Atenuación total por blindaje y muros (dB)
   * @returns {number} Potencia incidente en el receptor (dBm)
   */
  calcLinkBudget(txPowerEirpDbm, fsplDb, wallLossDb) {
    return txPowerEirpDbm - fsplDb - wallLossDb;
  },

  /**
   * Criterio de desconexión celular según umbrales 3GPP (Radio Link Failure - RLF).
   * Criterio nominal: Prx <= -95 dBm.
   */
  evaluateLinkStatus(prx) {
    if (prx <= this.THRESHOLD_CUTOFF) {
      return {
        bars: 0,
        status: 'Enlace Bloqueado (RLF)',
        isConnected: false,
        marginDb: (this.THRESHOLD_CUTOFF - prx).toFixed(2)
      };
    } else if (prx < -90) {
      return { bars: 1, status: 'Conexión Crítica / Marginal', isConnected: true, marginDb: 0 };
    } else if (prx < -80) {
      return { bars: 2, status: 'Conexión Débil', isConnected: true, marginDb: 0 };
    } else if (prx < -70) {
      return { bars: 3, status: 'Conexión Media', isConnected: true, marginDb: 0 };
    } else {
      return { bars: 4, status: 'Comunicación Plena', isConnected: true, marginDb: 0 };
    }
  }
};

/**
 * Catálogo de Materiales Estructurales Estandarizados (UIT-R P.2040-1)
 */
/**
 * Catálogo de Materiales Estructurales, Rellenos y Blindajes (UIT-R P.2040-1)
 */
const MaterialStore = {
  data: {
    // --- DIELÉCTRICOS Y MATERIALES MASIVOS (UIT-R P.2040) ---
    concrete: {
      name: 'Hormigón / Concreto Reforzado',
      isMesh: false,
      isSolidMetal: false,
      a: 5.31,
      b: 0.0,
      c: 0.0326,
      d: 0.8095
    },
    heavy_concrete: {
      name: 'Hormigón Pesado (Alta Densidad)',
      isMesh: false,
      isSolidMetal: false,
      a: 6.80,
      b: 0.0,
      c: 0.0650,
      d: 0.8500
    },
    brick: {
      name: 'Ladrillo Cerámico Macizo',
      isMesh: false,
      isSolidMetal: false,
      a: 3.75,
      b: 0.0,
      c: 0.0380,
      d: 0.0
    },
    sand: {
      name: 'Arena Seca Compactada',
      isMesh: false,
      isSolidMetal: false,
      a: 2.55,
      b: 0.0,
      c: 0.0025,
      d: 0.9200
    },
    sand_block: {
      name: 'Block de Hormigón Relleno de Arena',
      isMesh: false,
      isSolidMetal: false,
      a: 4.20,
      b: 0.0,
      c: 0.0450,
      d: 0.7800
    },
    drywall: {
      name: 'Panel de Yeso / Drywall',
      isMesh: false,
      isSolidMetal: false,
      a: 2.94,
      b: 0.0,
      c: 0.0116,
      d: 0.7076
    },
    glass: {
      name: 'Vidrio Arquitectónico Estándar',
      isMesh: false,
      isSolidMetal: false,
      a: 6.27,
      b: 0.0,
      c: 0.0043,
      d: 1.1925
    },
    wood: {
      name: 'Madera Estructural',
      isMesh: false,
      isSolidMetal: false,
      a: 1.99,
      b: 0.0,
      c: 0.0047,
      d: 1.0718
    },

    // --- MALLAS CONDUCTORAS Y JAULAS DE FARADAY (Apertura sub-longitud de onda) ---
    mesh_2_5mm: {
      name: 'Malla de Cobre Fina (g = 2.5 mm)',
      isMesh: true,
      isSolidMetal: false,
      defaultApertureMm: 2.5
    },
    mesh_5mm: {
      name: 'Malla Metálica Antirrobo (g = 5.0 mm)',
      isMesh: true,
      isSolidMetal: false,
      defaultApertureMm: 5.0
    },
    mesh_10mm: {
      name: 'Malla Electrosoldada de Losa (g = 10 mm)',
      isMesh: true,
      isSolidMetal: false,
      defaultApertureMm: 10.0
    },
    mesh_25mm: {
      name: 'Malla Ciclónica Perimetral (g = 25 mm)',
      isMesh: true,
      isSolidMetal: false,
      defaultApertureMm: 25.0
    },

    // --- BARRERA METÁLICA CONTINUA (Reflexión total por Schelkunoff) ---
    solid_steel_sheet: {
      name: 'Lámina de Acero Continua (Blindaje Total)',
      isMesh: false,
      isSolidMetal: true,
      fixedShieldingDb: 120.0
    }
  },

  register(id, name, a, b, c, d) {
    this.data[id] = {
      name,
      isMesh: false,
      isSolidMetal: false,
      a: parseFloat(a),
      b: parseFloat(b),
      c: parseFloat(c),
      d: parseFloat(d)
    };
  },

  getAll() {
    return this.data;
  },

  get(id) {
    return this.data[id];
  }
};