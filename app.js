/* ===============================
   CONFIG
=============================== */
const ALERT_KEY = "alerts";
const CHANNEL = new BroadcastChannel("TANAW_ALERTS");

const INCIDENT_TYPES = {
  Roadwork:   { color: "#f9a825", icon: "🚧" },
  Traffic:    { color: "#fbc02d", icon: "🚦" },
  Flood:      { color: "#1976d2", icon: "🌊" },
  Crash:      { color: "#d32f2f", icon: "🚗" },
  Fire:       { color: "#f57c00", icon: "🔥" },

  Earthquake: { color: "#6d4c41", icon: "🌏" },
  Typhoon:    { color: "#0288d1", icon: "🌀" },
  Landslide:  { color: "#5d4037", icon: "🪨" },
  Others:     { color: "#616161", icon: "⚠️" },
  Evacuation: { color: "#ffeb3b", icon: "🏠" },
  NotPassable: { color: "#d32f2f", icon: "⛔" }

  
};


let activeTypes = {
  Roadwork: true,
  Traffic: true,
  Flood: true,
  Crash: true,
  Fire: true,
  Earthquake: true,
  Typhoon: true,
  Landslide: true,
  Evacuation: true,
  NotPassable: true,
  Others: true
  
};

let reportMarker = null;
let reportPosition = null;
let mapInitialized = false;
let map, userMarker, directionsService, directionsRenderer;
let incidentMarkers = [];
let selectedDestination = null;
let drrmMarkers = [];
let evacuationData = [];

async function loadEvacuationFromExcel() {
  try {
    const response = await fetch("EVACUATION CENTERS PER BARANGAY_Govt.xlsx");
    const data = await response.arrayBuffer();

    const workbook = XLSX.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    evacuationData = XLSX.utils.sheet_to_json(firstSheet);

    console.log("Evacuation Data:", evacuationData);

    loadStaticDRRMData(); // create markers after loading
  } catch (error) {
    console.error("Error loading Excel:", error);
  }
}


/* ===============================
   UTIL
=============================== */
function getAlerts() {
  return JSON.parse(localStorage.getItem(ALERT_KEY) || "[]");
}

function saveAlert(alert) {
  const list = getAlerts();
  list.unshift(alert);
  localStorage.setItem(ALERT_KEY, JSON.stringify(list));
  CHANNEL.postMessage(alert);
  sendNotification(alert);
  navigator.serviceWorker?.controller?.postMessage(alert);

}

function getIcon(type) {
  const s = INCIDENT_TYPES[type];
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: s.color,
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: "#fff"
  };
}

const CALAMITY_TYPES = [
  "Earthquake",
  "Typhoon",
  "Landslide",
  "Others"
];

function sendNotification(alert) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const isDRRM = localStorage.getItem("drrm") === "1";
  const isCalamity = CALAMITY_TYPES.includes(alert.type);

  // Only notify calamities if DRRM is ON
  if (!isDRRM && isCalamity) return;

  // If DRRM is OFF, notify everything
  const title = isCalamity ? "🚨 CALAMITY ALERT" : "⚠️ Incident Reported";

  new Notification(title, {
    body: `${alert.type} – ${alert.area}`,
    icon: "icon-192.png",
    vibrate: [200, 100, 200]
  });
}

/* ===============================
   MAP INIT (FIXED)
=============================== */
window.initMap = function () {
   mapInitialized = true;

  const center = { lat: 13.6218, lng: 123.1948 };

  map = new google.maps.Map(document.getElementById("map"), {
    center,
    zoom: 15
  });

  userMarker = new google.maps.Marker({ position: center, map });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ map });
  
  map.addListener("click", (e) => {
  reportPosition = e.latLng;
    
    


  // Create or move report marker
  if (!reportMarker) {
    reportMarker = new google.maps.Marker({
      position: reportPosition,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#ef5a3c",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2
      }
    });
  } else {
    reportMarker.setPosition(reportPosition);
  }
});


  setupSearch();
  getUserLocation();
  loadIncidentMarkers();
  focusIncidentFromFeed();
  setupUIFixes();
  setupTripRouting();
  updateReportOptions();
  loadEvacuationFromExcel();

};
//drrm mode
function loadStaticDRRMData() {

  const isDRRM = localStorage.getItem("drrm") === "1";

  drrmMarkers.forEach(marker => marker.setMap(null));
  drrmMarkers = [];

  evacuationData.forEach(center => {

    // Adjust these column names EXACTLY as in your Excel
    const lat = parseFloat(center.Latitude);
    const lng = parseFloat(center.Longitude);

    if (!lat || !lng) return;

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: isDRRM ? map : null,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: "#ff5722",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2
      },
      label: { text: "🏠", fontSize: "16px" }
    });

    const info = new google.maps.InfoWindow({
      content: `
        <div style="font-weight:bold;color:#ff5722;">
          🏠 EVACUATION CENTER
        </div>
        <strong>${center["Center Name"]}</strong><br>
        Barangay: ${center.Barangay}<br>
        Contact: ${center["Contact Person"] || "N/A"}<br>
        Phone: ${center["Contact Number"] || "N/A"}
      `
    });

    marker.addListener("click", () => {
      info.open(map, marker);
    });

    drrmMarkers.push(marker);
  });
}


/* ===============================
   INCIDENT MARKERS
=============================== */
function loadIncidentMarkers() {
  incidentMarkers.forEach(m => m.setMap(null));
  incidentMarkers = [];

  getAlerts().forEach(a => {
    if (!a.lat || !a.lng) return;
    const isDRRM = localStorage.getItem("drrm") === "1";
    
    if (!isDRRM && (a.type === "Evacuation" || a.type === "NotPassable")) {
  return;
}

if (!activeTypes[a.type]) return;

    const marker = new google.maps.Marker({
      position: { lat: a.lat, lng: a.lng },
      map,
      icon: getIcon(a.type),
      label: { text: INCIDENT_TYPES[a.type].icon, fontSize: "14px" },
      title: a.type
    });

    marker.addListener("click", () => {
      new google.maps.InfoWindow({
        content: `<strong>${a.type}</strong><br>${a.area}`
      }).open(map, marker);
    });

    incidentMarkers.push(marker);
    
  });
  loadStaticDRRMData();

}

function toggleType(type, value) {
  activeTypes[type] = value;
  loadIncidentMarkers();

}

/* ===============================
   REPORTING
=============================== */
const reportModal = document.getElementById("reportModal");
document.getElementById("addBtn").onclick = () => reportModal.classList.remove("hidden");
function closeReport() { reportModal.classList.add("hidden"); }

function submitReport() {
  if (!reportPosition) {
    alert("Tap on the map to choose where the incident happened");
    return;
  }

  const type = document.getElementById("incidentType").value;
  const note = document.getElementById("incidentNote").value;

  saveAlert({
    type,
    area: "User reported area",
    message: note || "User report",
    lat: reportPosition.lat(),
    lng: reportPosition.lng(),
    time: Date.now()
  });

  loadIncidentMarkers();
  closeReport();

  // Cleanup
  reportMarker?.setMap(null);
  reportMarker = null;
  reportPosition = null;
}

function updateReportOptions() {
  const select = document.getElementById("incidentType");
  if (!select) return;

  const isDRRM = localStorage.getItem("drrm") === "1";

  const calamityValues = ["Earthquake", "Typhoon", "Landslide", "Others"];
  const drrmValues = ["NotPassable"];

  // Loop through all options
  Array.from(select.options).forEach(option => {
    const value = option.value;

    const isCalamity = calamityValues.includes(value);
    const isDRRMOnly = drrmValues.includes(value);

    // Hide calamities if DRRM is OFF
    if (!isDRRM && (isCalamity || isDRRMOnly)) {
      option.style.display = "none";
    } else {
      option.style.display = "block";
    }
  });

  // Reset selection if hidden
  if (select.selectedOptions[0]?.style.display === "none") {
    select.selectedIndex = 0;
  }

  // Hide filter panel DRRM items
  document.querySelectorAll(".drrm-only").forEach(el => {
    el.style.display = isDRRM ? "flex" : "none";
  });
}





/* ===============================
   ALERT SYNC (FIXED)
=============================== */
CHANNEL.onmessage = (e) => {
  loadIncidentMarkers();

  // only focus if explicitly coming from feed
  if (localStorage.getItem("focusIncident") !== null) {
    focusIncidentFromFeed();
  }

  sendNotification(e.data);
};


/* ===============================
   FEED → MAP
=============================== */
function focusIncidentFromFeed() {
  const i = localStorage.getItem("focusIncident");
  if (!i) return;

  const a = getAlerts()[i];
  if (!a) return;

  map.panTo({ lat: a.lat, lng: a.lng });
  map.setZoom(17);
  localStorage.removeItem("focusIncident");
}

/* ===============================
   LOCATION
=============================== */
function getUserLocation() {
  navigator.geolocation?.getCurrentPosition(pos => {
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    userMarker.setPosition(p);
    map.setCenter(p);
  });
}

/* ===============================
   SEARCH (FIXED)
=============================== */
function setupSearch() {
  const input = document.getElementById("searchInput");
  if (!input || !google.maps.places) return;

  const ac = new google.maps.places.Autocomplete(input);
  ac.addListener("place_changed", () => {
    const p = ac.getPlace();
    if (!p.geometry) return;
    map.panTo(p.geometry.location);
    selectedDestination = p.geometry.location;
  });
}
//re-routing system

let tripStart = null;
let tripEnd = null;

function setupTripRouting() {
  const inputs = document.querySelectorAll("#tripForm input");

  if (inputs.length < 2) return;

  const acStart = new google.maps.places.Autocomplete(inputs[0]);
  const acEnd = new google.maps.places.Autocomplete(inputs[1]);

  acStart.addListener("place_changed", () => {
    const p = acStart.getPlace();
    if (p.geometry) tripStart = p.geometry.location;
    drawRoute();
  });

  acEnd.addListener("place_changed", () => {
    const p = acEnd.getPlace();
    if (p.geometry) tripEnd = p.geometry.location;
    drawRoute();
  });
}

function drawRoute() {
  if (!tripStart || !tripEnd) return;

  directionsService.route({
    origin: tripStart,
    destination: tripEnd,
    travelMode: google.maps.TravelMode.DRIVING
  }, (res, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(res);
      document.querySelector(".app").classList.add("sheet-up");
    }
  });
}


/* ===============================
   UI FIXES (MERGED)
=============================== */
function setupUIFixes() {
  const app = document.querySelector(".app");
  const sheet = document.getElementById("bottomSheet");
  const handle = document.getElementById("sheetHandle");

  const tripsTab = document.getElementById("tripsTab");
  const incidentsTab = document.getElementById("incidentsTab");
  const tripsIntro = document.getElementById("tripsIntro");
  const incidentsContent = document.getElementById("incidentsContent");

  const fabMenu = document.getElementById("fabMenu");

  /* GPS button */
  document.getElementById("gpsBtn")?.addEventListener("click", () => {
    if (!userMarker) return;
    map.panTo(userMarker.getPosition());
    map.setZoom(17);
  });
  
  /* Sheet control */
  function expandSheet() {
    app.classList.add("sheet-up");
  }

  function collapseSheet() {
    app.classList.remove("sheet-up");
  }

  let startY = 0;
let currentY = 0;
let dragging = false;

sheet.addEventListener("touchstart", e => {
  startY = e.touches[0].clientY;
  dragging = true;
});

sheet.addEventListener("touchmove", e => {
  if (!dragging) return;
  currentY = e.touches[0].clientY;
});

sheet.addEventListener("touchend", () => {
  if (!dragging) return;
  dragging = false;

  const delta = currentY - startY;

  // swipe up
  if (delta < -50) {
    app.classList.add("sheet-up");
  }

  // swipe down
  if (delta > 50) {
    app.classList.remove("sheet-up");
  }
});

  handle?.addEventListener("click", () => {
    app.classList.toggle("sheet-up");
  });

  /* Tabs */
  tripsTab?.addEventListener("click", () => {
  hideTripForm();

  tripsTab.classList.add("active");
  incidentsTab.classList.remove("active");

  tripsIntro.classList.add("active");
  incidentsContent.classList.remove("active");

  app.classList.add("sheet-up");
});


  incidentsTab?.addEventListener("click", () => {
  hideTripForm(); // 🔥 THIS FIXES YOUR BUG

  incidentsTab.classList.add("active");
  tripsTab.classList.remove("active");

  incidentsContent.classList.add("active");
  tripsIntro.classList.remove("active");

  app.classList.add("sheet-up");
});


  /* Filter panel */
  const filterBtn = document.getElementById("filterBtn");
  const filterPanel = document.getElementById("filterPanel");
  filterBtn?.addEventListener("click", () => {
    filterPanel?.classList.toggle("open");
  });

  /* DRRM toggle */
  const drrmToggle = document.getElementById("drrmToggle");

if (drrmToggle) {
  drrmToggle.checked = localStorage.getItem("drrm") === "1";

  const drrmBox = document.querySelector(".drrm-top");

drrmToggle.addEventListener("change", () => {

  localStorage.setItem("drrm", drrmToggle.checked ? "1" : "0");

  drrmBox?.classList.toggle("active", drrmToggle.checked);

  loadIncidentMarkers();   // reload everything
  updateReportOptions();   // update report modal
});

  
  const createTripBtn = document.getElementById("createTripBtn");
const tripForm = document.getElementById("tripForm");

createTripBtn?.addEventListener("click", () => {
  hideTripForm(); // reset first
  tripsIntro.classList.remove("active");
  tripForm.classList.add("active");
  app.classList.add("sheet-up");
});


  function hideTripForm() {
  tripForm?.classList.remove("active");
  tripsIntro?.classList.add("active");
}

}


  /* Initial state */
  collapseSheet();
}

/* ===============================
   RESET
=============================== */
function resetAllData() {
  localStorage.removeItem(ALERT_KEY);
  localStorage.removeItem("focusIncident");
  incidentMarkers.forEach(m => m.setMap(null));
  incidentMarkers = [];
  location.reload();
}

/* ===============================
   PWA
=============================== */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
