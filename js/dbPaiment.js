let config = {
  locateFile: (filename) => `/dist/${filename}`,
};

let db;

initSqlJs(config).then(function (SQL) {
  db = new SQL.Database();
  db.run(` 
    CREATE TABLE Inquilino (
      DPI TEXT PRIMARY KEY,
      PrimerNombre TEXT,
      PrimerApellido TEXT,
      FechaNacimiento TEXT,
      NumeroCasa INTEGER UNIQUE
    );

    CREATE TABLE PagoDeCuotas (
      IdPago INTEGER PRIMARY KEY AUTOINCREMENT,
      DPI TEXT,
      Anio INTEGER,
      Mes INTEGER,
      FechaPago TEXT,
      FOREIGN KEY (DPI) REFERENCES Inquilino(DPI)
    );
  `);

  db.run(`
    INSERT INTO Inquilino VALUES
      ('1234567890101', 'Carlos', 'Ramírez', '1985-03-20', 101),
      ('2234567890102', 'Ana', 'López', '1990-07-15', 102),
      ('3234567890103', 'Luis', 'Pérez', '1978-11-05', 103),
      ('4234567890104', 'María', 'Gómez', '1995-01-10', 104),
      ('5234567890105', 'Pedro', 'Martínez', '1982-04-25', 105),
      ('6234567890106', 'Lucía', 'Hernández', '1988-09-30', 106),
      ('7234567890107', 'Jorge', 'Sánchez', '1975-12-18', 107);
`);

  db.run(`
    INSERT INTO PagoDeCuotas (DPI, Anio, Mes, FechaPago) VALUES
      ('1234567890101', 2025, 6, '2025-06-05'),
      ('1234567890101', 2025, 7, '2025-07-04'),
      ('1234567890101', 2025, 8, '2025-08-02'),
      ('2234567890102', 2025, 6, '2025-06-10'),
      ('2234567890102', 2025, 7, '2025-07-03'),
      ('2234567890102', 2025, 8, '2025-08-04'),
      ('3234567890103', 2025, 5, '2025-05-08'),
      ('3234567890103', 2025, 6, '2025-06-10'),
      ('4234567890104', 2025, 8, '2025-08-05'),
      ('5234567890105', 2025, 7, '2025-07-15'),
      ('6234567890106', 2025, 8, '2025-08-07');
    `);
});

function consultarInquilino(dpi, casa, fechaNacimiento) {
  const stmt = db.prepare(`
    SELECT *  
    FROM Inquilino
    WHERE DPI = ?
      AND NumeroCasa = ?
      AND fechaNacimiento = ?
    `);
  stmt.bind([dpi, casa, fechaNacimiento]);
  if (stmt.step()) {
    return stmt.getAsObject();
  }
}

function consultarPagos(dpi, inicio, fin) {
  const stmt = db.prepare(`
        SELECT i.DPI, i.PrimerNombre, i.PrimerApellido,
               p.Anio, p.Mes, p.FechaPago
        FROM Inquilino i
        JOIN PagoDeCuotas p ON i.DPI = p.DPI
        WHERE i.DPI = ?
          AND p.FechaPago BETWEEN ? AND ?
      `);

  stmt.bind([dpi, inicio, fin]);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  return results;
}

const consultaForm = document.getElementById("consultaForm");
const resultado = document.getElementById("resultado");

let inquilinoEncontrado = false;

function validarCampos() {
  let valido = true;

  const dpi = document.getElementById("dpi");
  if (!/^[0-9]{13}$/.test(dpi.value)) {
    document.getElementById("dpiError").classList.remove("hidden");
    valido = false;
  } else {
    document.getElementById("dpiError").classList.add("hidden");
  }

  const casa = document.getElementById("casa");
  if (casa.value <= 0) {
    document.getElementById("casaError").classList.remove("hidden");
    valido = false;
  } else {
    document.getElementById("casaError").classList.add("hidden");
  }

  const nombre = document.getElementById("nombre");
  if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ]+$/.test(nombre.value)) {
    document.getElementById("nombreError").classList.remove("hidden");
    valido = false;
  } else {
    document.getElementById("nombreError").classList.add("hidden");
  }

  const apellido = document.getElementById("apellido");
  if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ]+$/.test(apellido.value)) {
    document.getElementById("apellidoError").classList.remove("hidden");
    valido = false;
  } else {
    document.getElementById("apellidoError").classList.add("hidden");
  }

  const fechaNacimiento = document.getElementById("fechaNacimiento");
  if (!fechaNacimiento.value) {
    document.getElementById("fechaError").classList.remove("hidden");
    valido = false;
  } else {
    document.getElementById("fechaError").classList.add("hidden");
  }

  return valido;
}

consultaForm.addEventListener("submit", (e) => {
  console.log("Formulario enviado");
  e.preventDefault();
  if (!validarCampos()) return;

  const dpi = document.getElementById("dpi").value;
  const casa = parseInt(document.getElementById("casa").value);
  const fechaNacimiento = document.getElementById("fechaNacimiento").value;

  let inquilino = consultarInquilino(dpi, casa, fechaNacimiento);

  if (inquilino) {
    inquilinoEncontrado = true;
    resultado.textContent = "Cuota de mantenimiento al día";
    resultado.className = "mt-6 text-center font-bold text-lg text-green-600";
  } else {
    resultado.textContent = "Inquilino no encontrado o datos incorrectos";
    resultado.className = "mt-6 text-center font-bold text-lg text-red-600";
  }
  resultado.classList.remove("hidden");
});

consultaForm.addEventListener("input", () => {
  if (inquilinoEncontrado) {
    resultado.classList.add("hidden");
    inquilinoEncontrado = false;
  }
});

const historialForm = document.getElementById("historialForm");

historialForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const inicio = document.getElementById("fechaInicio").value;
  const fin = document.getElementById("fechaFin").value;

  if (!inicio || !fin) {
    resultado.textContent = "Seleccione un rango de fechas válido.";
    resultado.className = "mt-6 text-center text-red-600";
  } 

  if (!inquilinoEncontrado) {
    resultado.textContent = "Inquilino no encontrado o datos incorrectos";
    resultado.className = "mt-6 text-center font-bold text-lg text-red-600";
    return;
  }

  let dpi = document.getElementById("dpi").value;
  for (let pago of consultarPagos(dpi, inicio, fin)) {
    console.log(pago);
    resultado.innerHTML = `
      <p class="mb-2">Pago realizado el ${pago.FechaPago} correspondiente a ${pago.Mes}/${pago.Anio}</p>
    `;
  }
});
