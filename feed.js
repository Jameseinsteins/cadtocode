const notifCount = document.getElementById("notifCount");
const feedList = document.getElementById("feedList");
const channel = new BroadcastChannel("TANAW_ALERTS");
const notifPanel = document.getElementById("notifPanel");
const openNotif = document.getElementById("openNotif");
const notifBack = document.getElementById("notifBack");
const LIVE_AREAS = {
  "Almeda Highway": {
    media: "sample.jpeg",
    sub: "Naga City, Camarines Sur"
  },
  "Maharlika Highway": {
    media: "sample.jpeg",
    sub: "Naga City, Camarines Sur"
  },
  "Diversion Road": {
    media: "sample.jpeg",
    sub: "Naga City, Camarines Sur"
  },
  "Magsaysay Ave": {
    media: "sample.jpeg",
    sub: "Naga City, Camarines Sur"
  },
  "Peñafrancia Ave": {
    media: "sample.jpeg",
    sub: "Naga City, Camarines Sur"
  }
};

let activeLiveArea = null;

function getAlerts() {
  return JSON.parse(localStorage.getItem("alerts") || "[]");
}

function renderFeed() {
  const alerts = getAlerts();

  if (notifCount) {
    notifCount.textContent = alerts.length;
    notifCount.style.display = alerts.length ? "block" : "none";
  }

  if (!alerts.length) {
    feedList.innerHTML = `<p class="feed-empty">No incidents yet</p>`;
    return;
  }

  feedList.innerHTML = alerts.map((a, i) => `
    <div class="feed-card" onclick="openIncident(${i})" style="--type-color:${getTypeColor(a.type)}">
      <div class="feed-icon">${getEmoji(a.type)}</div>
      <div class="feed-info">
        <h4>${a.type}</h4>
        <p>${a.area}</p>
        <small>${timeAgo(a.time)}</small>
      </div>
    </div>
  `).join("");
}

openNotif.onclick = () => {
  notifPanel.classList.remove("hidden");
};

notifBack.onclick = () => {
  notifPanel.classList.add("hidden");
};

function openIncident(i) {
  localStorage.setItem("focusIncident", i);
  location.href = "index.html";
}

function getEmoji(t) {
  return {Roadwork:"🚧",Traffic:"🚦",Flood:"🌊",Crash:"🚗",Fire:"🔥"}[t] || "⚠️";
}

function getTypeColor(t) {
  return {Roadwork:"#f9a825",Traffic:"#fbc02d",Flood:"#1976d2",Crash:"#d32f2f",Fire:"#f57c00"}[t];
}

function timeAgo(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? "Just now" : `${m} min ago`;
}

channel.onmessage = renderFeed;
renderFeed();


function openLiveArea(name) {
  const area = LIVE_AREAS[name];
  if (!area) return;

  if (activeLiveArea === name) return;
  activeLiveArea = name;

  const hero = document.getElementById("liveHero");
  const media = document.getElementById("liveMedia");
  const title = document.getElementById("liveTitle");
  const sub = document.getElementById("liveSub");

  media.src = area.media;
  title.textContent = name;
  sub.textContent = area.sub;

  hero.classList.remove("hidden");

  // Ensure only ONE active area
  document.querySelectorAll(".area-item").forEach(el => {
    el.classList.toggle(
      "active",
      el.textContent.trim() === name
    );
  });

  // Bring selected area to top
  hero.scrollIntoView({ behavior: "smooth", block: "start" });
}
