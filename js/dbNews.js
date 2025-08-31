let config = {
  locateFile: (filename) => `/dist/${filename}`,
};

let db;

initSqlJs(config).then(function (SQL) {
  db = new SQL.Database();
  db.run(`CREATE TABLE Noticias (Fecha TEXT, Noticia TEXT);`);

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
  consultarNoticias();
});


function mostrarConsulta(sql) {
  const res = db.exec(sql);
  let contenedor = document.getElementById("contenedorNoticias");
  let element = "";
  console.log(res[0].values);
  for (let value of res[0].values) {
    console.log(value);
    element += `
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <img
          src="https://vskills.in/certification/blog/wp-content/uploads/2015/01/structure-of-a-news-report.jpg"
          alt="Noticia 1"
          class="w-full h-48 object-cover"
        />
        <div class="p-6">
        <span
          class="inline-block bg-blue-100 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full"
        >${value[0]}</span
              >
              <p class="text-gray-600 text-sm mt-2">
                ${value[1]}
              </p>
            </div>
      </div>
    `
  }
  contenedor.innerHTML = element;
}

function consultarNoticias() {
  mostrarConsulta("SELECT * FROM Noticias ORDER BY Fecha Desc LIMIT 3;");
}