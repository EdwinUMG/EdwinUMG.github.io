import initSqlJs from "dist/sql-wasm.js";

let config = {
  locateFile: (filename) => `/dist/${filename}`,
};

let db;

initSqlJs(config).then(function (SQL) {
  db = new SQL.Database();
  db.run(`
		CREATE TABLE Noticias (
			Fecha TEXT,
			Noticia TEXT
		);
				
		CREATE TABLE Calendario (
			Fecha TEXT,
			Titulo TEXT,
			Descripcion TEXT
		);
				
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
    INSERT INTO Noticias VALUES 
    	('2025-08-01', 'Reunión mensual de vecinos'),
      ('2025-08-05', 'Aviso de corte de agua programado'),
      ('2025-08-10', 'Mantenimiento de áreas verdes'),
      ('2025-08-12', 'Clases de zumba gratis en el salón comunal'),
      ('2025-08-15', 'Fiesta patronal en la colonia'),
      ('2025-08-20', 'Campaña de vacunación'),
      ('2025-08-25', 'Jornada de limpieza comunitaria');
    `);

  db.run(`
    INSERT INTO Calendario VALUES 
    	('2025-08-05', 'Reunión Comité', 'Revisión de reglamento interno'),
      ('2025-08-08', 'Capacitación', 'Uso responsable de energía eléctrica'),
      ('2025-08-12', 'Pago Extraordinario', 'Fondo para seguridad privada'),
      ('2025-08-15', 'Torneo Deportivo', 'Competencias de fútbol y baloncesto'),
      ('2025-08-20', 'Jornada Médica', 'Atención gratuita en la casa comunal'),
      ('2025-08-22', 'Charla Ambiental', 'Reciclaje y compostaje en el hogar'),
      ('2025-08-28', 'Clausura Curso Computación', 'Entrega de diplomas a vecinos');
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

  // Insertar pagos ligados por DPI
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
