let colleges = [];
let userLatLng = null;
let map = L.map("map").setView([19.7515, 75.7139], 7); // Centered on Maharashtra

fetch("data/colleges.xlsx")
  .then((res) => res.arrayBuffer())
  .then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    colleges = [];

    rows.forEach((row) => {
      const name = row["Institute Name"];
      const code = row["Choice Code"];
      const course = row["Course Name"];
      const rank = row["CAP - I"];
      const fees = row["Fees"];
      const percentile = row["Percentile"];
      const coordStr = row["Coordinates"] || row["Coordinates "];
      if (!coordStr) return;

      const [latStr, lonStr] = coordStr.split(",").map((s) => s.trim());
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (isNaN(lat) || isNaN(lon)) return;

      colleges.push({
        name,
        code,
        course,
        coords: [lat, lon],
        rank,
        percentile,
        fees,
        distance: null
      });
    });

    // Start initial 13 search rows after preloading
    if (userLatLng) {
      for (let i = 0; i < 13; i++) addNewSearchRow();
    }
  })
  .catch((err) => console.error("Failed to load college list:", err));


// 🗺️ Add base map tile layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// 📍 On map click, set user location
map.on("click", function (e) {
  userLatLng = e.latlng;

  // Remove previous marker if any
  if (map.userMarker) {
    map.removeLayer(map.userMarker);
  }

  map.userMarker = L.marker(userLatLng, {
    icon: L.icon({
      iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    }),
  })
    .addTo(map)
    .bindPopup("Your Location")
    .openPopup();

  maybeStartPrototype(); // Refresh table if data is already loaded
});

// 📤 File upload event
document.getElementById("file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    colleges = [];

    rows.forEach((row) => {
      const name = row["Institute Name"];
      const code = row["Choice Code"];
      const course = row["Course Name"];
      const rank = row["CAP - I"];
      const percentile = row["Percentile"];
      const fees = row["Fees"];
      const coordStr = row["Coordinates"] || row["Coordinates "];
      if (!coordStr) {
        console.warn("❌ No coordinates for:", name);
        return;
      }

      const [latStr, lonStr] = coordStr.split(",").map((s) => s.trim());
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);

      if (isNaN(lat) || isNaN(lon)) {
        console.warn("❌ Invalid coordinates for:", name);
        return;
      }

      const marker = L.marker([lat, lon]).addTo(map).bindPopup(
        `<strong>${name}</strong><br>${course}`
      );

      colleges.push({
        name,
        code,
        course,
        coords: [lat, lon],
        rank,
        fees,
        percentile,
        marker,
        distance: null, // will be calculated later
      });
    });

    maybeStartPrototype(); // in case user location is already marked
  };

  reader.readAsArrayBuffer(file);
});

// 📋 Update table with distances
function generateFullTable() {
  if (!userLatLng || colleges.length === 0) return;

  const tableBody = document.getElementById("results-body");
  tableBody.innerHTML = "";

  // Compute distance for each college
  colleges.forEach((college) => {
    const [lat, lon] = college.coords;
    const dist = userLatLng.distanceTo(L.latLng(lat, lon)) / 1000;
    college.distance = dist;
  });

  // Sort by distance
  colleges.sort((a, b) => a.distance - b.distance);

  // Render rows
  colleges.forEach((college, index) => {
    const row = document.createElement("tr");
    row.setAttribute("draggable", "true"); // Enable drag
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${college.name}</td>
      <td>${college.course}</td>
      <td>${college.code}</td>
      <td>${college.rank}</td>
      <td>${college.percentile}</td>
      <td>${college.fees}</td>
      <td>${college.distance.toFixed(2)}</td>
    `;
    tableBody.appendChild(row);
  });
}

// 🌗 Dark/Light mode toggle
const toggle = document.getElementById("theme-toggle");
const body = document.body;
const savedTheme = localStorage.getItem("theme") || "dark";
body.classList.add(`${savedTheme}-mode`);
toggle.checked = savedTheme === "light";

toggle.addEventListener("change", () => {
  if (toggle.checked) {
    body.classList.remove("dark-mode");
    body.classList.add("light-mode");
    localStorage.setItem("theme", "light");
  } else {
    body.classList.remove("light-mode");
    body.classList.add("dark-mode");
    localStorage.setItem("theme", "dark");
  }
});

// 📤 Export to Excel
document.getElementById("export-excel").addEventListener("click", () => {
  const table = document.querySelector("#results table");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table);
  XLSX.utils.book_append_sheet(wb, ws, "Colleges");
  XLSX.writeFile(wb, "college_distances.xlsx");
});

// 📤 Export to PDF
document.getElementById("export-pdf").addEventListener("click", () => {
  const table = document.querySelector("#results table");

  html2canvas(table).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jspdf.jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, pdfHeight);
    pdf.save("college_distances.pdf");
  });
});
function setupPrototypeRow() {
  const tableBody = document.getElementById("results-body");
  tableBody.innerHTML = "";

  const row = document.createElement("tr");

  row.innerHTML = `
    <td>1</td>
    <td style="position: relative;">
      <input type="text" class="college-search" placeholder="Type college name..." />
      <div class="suggestions"></div>
    </td>
    <td class="course-cell"></td>
    <td class="code-cell"></td>
    <td class="rank-cell"></td>
    <td class="percentile-cell"></td>
    <td class="fees-cell"></td>
    <td class="distance-cell"></td>
  `;

  tableBody.appendChild(row);

  setupAutoSuggest(row);
}
function setupAutoSuggest(row) {
  const input = row.querySelector(".college-search");
  const suggestionsBox = row.querySelector(".suggestions");

  let selectedIndex = -1;

  input.addEventListener("input", () => {
    const value = input.value.toLowerCase();
    suggestionsBox.innerHTML = "";
    selectedIndex = -1;

    if (!value) return;

    const selectedCombos = Array.from(document.querySelectorAll("tr")).map(row => {
      return {
         name: row.querySelector(".college-label")?.textContent || "",
         course: row.querySelector(".course-cell")?.textContent || ""
      };
    });


    const matches = colleges.filter(college =>
  college.name.toLowerCase().includes(value) &&
  !selectedCombos.some(c => c.name === college.name && c.course === college.course)
).slice(0, 5);

    matches.forEach((college, index) => {
      const div = document.createElement("div");
      div.textContent = `${college.name} – ${college.course}`;
      div.className = "suggestion";

      div.addEventListener("mousedown", () => {
        selectCollege(college);
      });

      suggestionsBox.appendChild(div);
    });
  });

  input.addEventListener("keydown", (e) => {
    const suggestions = suggestionsBox.querySelectorAll(".suggestion");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % suggestions.length;
      updateSelection(suggestions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
      updateSelection(suggestions);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        suggestions[selectedIndex].dispatchEvent(new Event("mousedown"));
      }
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => suggestionsBox.innerHTML = "", 200);
  });

  function updateSelection(suggestions) {
    suggestions.forEach((sug, i) => {
      sug.style.background = i === selectedIndex ? "#ddd" : "";
    });
  }

  function selectCollege(college) {
    const td = input.parentElement;

    // Clear the cell and set plain text
    td.innerHTML = `<span class=\"college-label\">${college.name}</span>`;
    td.style.cursor = "pointer";

    // Fill in other cells
    row.querySelector(".course-cell").textContent = college.course;
    row.querySelector(".code-cell").textContent = college.code;
    row.querySelector(".rank-cell").textContent = college.rank || "—";
    row.querySelector(".percentile-cell").textContent = college.percentile || "—";
    row.querySelector(".fees-cell").textContent = college.fees || "—";

    const distance = userLatLng
      ? userLatLng.distanceTo(L.latLng(...college.coords)) / 1000
      : null;

    row.querySelector(".distance-cell").textContent =
      distance ? distance.toFixed(2) : "N/A";

    // Add a new row if this is the last one
    const tableBody = document.getElementById("results-body");
    if (row === tableBody.lastElementChild) {
      addNewSearchRow();
    }

    // Enable re-clicking to edit
    td.addEventListener("click", () => {
      td.innerHTML = `
        <input type=\"text\" class=\"college-search\" placeholder=\"Type college name...\" value=\"${college.name}\" />
        <div class=\"suggestions\"></div>
      `;
      td.style.cursor = "auto";
      setupAutoSuggest(row);
    }, { once: true });
  }
}
function maybeStartPrototype() {
  if (userLatLng && colleges.length > 0) {
    for (let i = 0; i < 13; i++) {
      addNewSearchRow(); // ✅ dynamically creates 13 search-enabled rows
    }
  }
}
function addNewSearchRow() {
  const tableBody = document.getElementById("results-body");
  const rowIndex = tableBody.children.length + 1;

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${rowIndex}</td>
    <td style="position: relative;">
      <input type="text" class="college-search" placeholder="Type college name..." />
      <div class="suggestions"></div>
    </td>
    <td class="course-cell"></td>
    <td class="code-cell"></td>
    <td class="rank-cell"></td>
    <td class="percentile-cell"></td>
    <td class="fees-cell"></td>
    <td class="distance-cell"></td>
  `;

  row.setAttribute("draggable", "true");
  tableBody.appendChild(row);
  setupAutoSuggest(row);
}
