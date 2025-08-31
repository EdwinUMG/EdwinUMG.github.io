let config = {
  locateFile: (filename) => `/dist/${filename}`,
};
let db;

const events = [];

initSqlJs(config).then(function (SQL) {
  db = new SQL.Database();
  db.run(`     
    CREATE TABLE Calendario (
      Fecha TEXT,
      Titulo TEXT,
      Descripcion TEXT
    );
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
  renderCalendar();
});


function consultarEventos() {
  events.length = 0;

  const stmt = db.prepare(`
  SELECT *
  FROM Calendario
  WHERE strftime('%Y', Fecha) = ? 
    AND strftime('%m', Fecha) = ?
  `);

  stmt.bind([
    currentYear.toString(),
    (currentMonth + 1).toString().padStart(2, "0"),
  ]);
  while (stmt.step()) {
    events.push(stmt.getAsObject());
  }
  stmt.free();
  return events;
}

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

const calendar = document.getElementById("calendar");
const monthYear = document.getElementById("monthYear");
const eventModal = document.getElementById("eventModal");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalDate = document.getElementById("modalDate");
const closeModal = document.getElementById("closeModal");

const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");

monthNames.forEach((m, i) => {
  const option = document.createElement("option");
  option.value = i;
  option.textContent = m;
  if (i === currentMonth) option.selected = true;
  monthSelect.appendChild(option);
});

for (let y = currentYear - 5; y <= currentYear + 5; y++) {
  const option = document.createElement("option");
  option.value = y;
  option.textContent = y;
  if (y === currentYear) option.selected = true;
  yearSelect.appendChild(option);
}

function renderCalendar() {

  calendar.innerHTML = "";
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  for (let i = 0; i < firstDay.getDay(); i++) {
    const prevDate = new Date(
      currentYear,
      currentMonth,
      i - firstDay.getDay() + 1
    );
    const div = document.createElement("div");
    div.className = "border rounded-lg p-2 h-24 bg-gray-100 text-gray-400";
    div.innerHTML = `<span class="text-xs font-bold">${prevDate.getDate()}</span>`;
    calendar.appendChild(div);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(currentYear, currentMonth, d);
    const dateStr = date.toISOString().split("T")[0];
    const dayEvents = consultarEventos().filter((e) => e.Fecha === dateStr);

    const div = document.createElement("div");
    div.className =
      "border rounded-lg p-2 h-24 bg-white flex flex-col items-start";
    div.innerHTML = `<span class="text-xs font-bold">${d}</span>`;

    dayEvents.forEach((event) => {
      const btn = document.createElement("button");
      btn.className =
        "mt-1 px-2 py-1 text-xs rounded bg-teal-100 text-teal-700 hover:bg-teal-200 truncate w-full text-left";
      btn.textContent = event.Titulo;
      btn.addEventListener("click", () => openEvent(event));
      div.appendChild(btn);
    });

    calendar.appendChild(div);
  }
}

function openEvent(event) {
  modalTitle.textContent = event.Titulo;
  modalDesc.textContent = event.Descripcion;
  modalDate.textContent = event.Fecha;
  eventModal.classList.remove("hidden");
}

closeModal.addEventListener("click", () => {
  eventModal.classList.add("hidden");
});

monthSelect.addEventListener("change", () => {
  currentMonth = parseInt(monthSelect.value);
  renderCalendar();
});

yearSelect.addEventListener("change", () => {
  currentYear = parseInt(yearSelect.value);
  renderCalendar();
});
