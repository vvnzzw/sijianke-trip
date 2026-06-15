// 四賤客小旅行 — 畫面與互動邏輯（vanilla JS，無框架）
(function () {
  "use strict";
  var T = window.TRIP;
  var state = { view: "day", dayIdx: 0 };
  var $main = document.getElementById("main");
  var $strip = document.getElementById("datestrip");

  // ---- 單色線條 SVG 圖示（禁 emoji） ----
  function svg(path, o) {
    o = o || {};
    var s = o.size || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px">' +
      path + '</svg>';
  }
  var ICON = {
    nav: svg('<polygon points="3 11 22 2 13 21 11 13 3 11"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pin: svg('<path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    car: svg('<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13"/><path d="M4 13h16v4H4z"/><circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>'),
    bed: svg('<path d="M3 18V8h12a4 4 0 0 1 4 4v6"/><path d="M3 13h16"/><path d="M7 11h2"/>'),
    umbrella: svg('<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v7a2 2 0 0 0 4 0"/>'),
    food: svg('<path d="M5 3v7a2 2 0 0 0 4 0V3"/><path d="M7 10v11"/><path d="M16 3c-1.5 0-2.5 1.8-2.5 4.5S15 21 16 21s2.5-1 2.5-9S17.5 3 16 3z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>'),
    cloud: svg('<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 18z"/>'),
    rain: svg('<path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 15"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/>'),
    snow: svg('<path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 15"/><path d="M10 19h.01M14 19h.01M12 21h.01"/>'),
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    alert: svg('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>'),
    chat: svg('<path d="M4 5h16v11H8l-4 4z"/>')
  };

  // ---- 工具 ----
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function isoOf(day) {
    var m = day.date.split("/"); // "6/21"
    return T.year + "-" + pad(parseInt(m[0], 10)) + "-" + pad(parseInt(m[1], 10));
  }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function enc(s) { return encodeURIComponent(s); }
  // 不帶 origin → Google Maps 自動用目前位置(GPS)當起點；travelmode=driving 直接進開車模式
  function navUrl(q) { return "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + enc(q); }
  function searchUrl(q) { return "https://www.google.com/maps/search/?api=1&query=" + enc(q); }
  function embedUrl(q) {
    if (!T.mapsEmbedKey) return null;
    return "https://www.google.com/maps/embed/v1/place?key=" + T.mapsEmbedKey + "&q=" + enc(q);
  }

  // ---- 營業徽章推算（裝置時間 × 快照 hours） ----
  // hours 形如 "11:00–22:00" / "11:00–翌02:00" / 含「依店家」「黎明」等 → unknown
  function openBadge(r) {
    var wdMap = ["日", "一", "二", "三", "四", "五", "六"];
    var nowWd = wdMap[new Date().getDay()];
    if (r.closedDay && r.closedDay.indexOf(nowWd) !== -1 && r.closedDay.indexOf("週") !== -1) {
      return { cls: "closed", txt: "今日公休" };
    }
    var m = (r.hours || "").match(/(\d{1,2}):(\d{2}).*?(翌)?(\d{1,2}):(\d{2})/);
    if (!m) return { cls: "unknown", txt: "見營業時間" };
    var now = new Date(); var cur = now.getHours() * 60 + now.getMinutes();
    var start = (+m[1]) * 60 + (+m[2]);
    var end = (+m[4]) * 60 + (+m[5]); if (m[3]) end += 24 * 60; // 翌日
    var open = (cur >= start && cur <= end) || (cur + 1440 <= end);
    return open ? { cls: "open", txt: "推算營業中" } : { cls: "closed", txt: "推算已打烊" };
  }
  function vegTag(v) {
    if (v === true) return '<span class="veg">素友善</span>';
    if (v === "partial") return '<span class="veg" style="opacity:.75">部分素</span>';
    return "";
  }

  // ---- 天氣（Open-Meteo，免 key，含離線快取） ----
  var WMO = {
    clear: { codes: [0, 1], icon: "sun", txt: "晴" },
    cloud: { codes: [2, 3, 45, 48], icon: "cloud", txt: "多雲" },
    rain: { codes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99], icon: "rain", txt: "有雨" },
    snow: { codes: [71, 73, 75, 77, 85, 86], icon: "snow", txt: "雪" }
  };
  function codeInfo(c) {
    for (var k in WMO) if (WMO[k].codes.indexOf(c) !== -1) return WMO[k];
    return { icon: "cloud", txt: "—" };
  }
  var weatherCache = {};
  function loadWeatherCache() {
    try { weatherCache = JSON.parse(localStorage.getItem("sjk_weather") || "{}"); } catch (e) { weatherCache = {}; }
  }
  function saveWeatherCache() {
    try { localStorage.setItem("sjk_weather", JSON.stringify(weatherCache)); } catch (e) {}
  }
  function fetchWeather() {
    // 依不重複座標分組抓取整段行程預報
    var groups = {};
    T.days.forEach(function (d) {
      var key = d.coord.lat + "," + d.coord.lng;
      groups[key] = d.coord;
    });
    var start = isoOf(T.days[0]), end = isoOf(T.days[T.days.length - 1]);
    Object.keys(groups).forEach(function (key) {
      var c = groups[key];
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + c.lat + "&longitude=" + c.lng +
        "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&hourly=precipitation_probability" +
        "&timezone=Asia%2FTokyo&start_date=" + start + "&end_date=" + end;
      fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.daily) return;
        var dd = j.daily;
        for (var i = 0; i < dd.time.length; i++) {
          weatherCache[key + "|" + dd.time[i]] = {
            code: dd.weathercode[i], hi: Math.round(dd.temperature_2m_max[i]),
            lo: Math.round(dd.temperature_2m_min[i]), pop: dd.precipitation_probability_max[i]
          };
        }
        if (j.hourly && j.hourly.time) { // 逐時降雨機率（整段行程）
          weatherCache["h|" + key] = { time: j.hourly.time, prob: j.hourly.precipitation_probability };
        }
        weatherCache._fetched = todayIso() + " " + pad(new Date().getHours()) + ":" + pad(new Date().getMinutes());
        saveWeatherCache();
        if (state.view === "day") renderDay(); // 抓到後刷新當前天氣
      }).catch(function () {/* 離線：用快取 */ });
    });
  }
  function weatherFor(day) {
    var key = day.coord.lat + "," + day.coord.lng + "|" + isoOf(day);
    return weatherCache[key] || null;
  }
  // 取某天 08–20 時的逐時降雨機率（每 2 小時取樣）
  function hourlyForDay(day) {
    var h = weatherCache["h|" + day.coord.lat + "," + day.coord.lng];
    if (!h || !h.time) return null;
    var iso = isoOf(day), out = [];
    for (var i = 0; i < h.time.length; i++) {
      if (h.time[i].indexOf(iso) === 0) {
        var hr = parseInt(h.time[i].slice(11, 13), 10);
        if (hr >= 8 && hr <= 20 && hr % 2 === 0) out.push({ hour: hr, prob: h.prob[i] == null ? 0 : h.prob[i] });
      }
    }
    return out.length ? out : null;
  }

  // ---- 渲染：日期切換列 ----
  function renderStrip() {
    $strip.innerHTML = T.days.map(function (d, i) {
      var cur = i === state.dayIdx ? ' aria-current="true"' : "";
      return '<div class="daychip" role="button" tabindex="0" data-idx="' + i + '"' + cur + '>' +
        '<div class="wd">' + d.weekday + '</div><div class="dt">' + d.date + '</div>' +
        '<div class="dn">D' + d.day + '</div></div>';
    }).join("");
    var active = $strip.querySelector('[aria-current="true"]');
    if (active && active.scrollIntoView) active.scrollIntoView({ inline: "center", block: "nearest" });
  }

  // ---- 渲染：餐廳卡 ----
  function restaurantCard(r) {
    var b = openBadge(r);
    var emb = embedUrl(r.embedQ || r.q);
    var map = emb
      ? '<iframe class="map-embed" loading="lazy" src="' + emb + '"></iframe>'
      : '<div class="map-ph">' + ICON.pin + ' 點「導航」開 Google Maps</div>';
    return '<div class="rcard">' +
      '<div class="rcard-top"><div><div class="rn">' + r.name + vegTag(r.veg) + '</div>' +
      '<div class="rt">' + r.type + ' ・ ' + r.area + '</div></div>' +
      '<span class="badge ' + b.cls + '">' + b.txt + '</span></div>' +
      '<div class="rhours">' + ICON.clock + ' ' + r.hours +
      (r.closedDay && r.closedDay !== "—" ? ' ・ 公休 ' + r.closedDay : "") +
      ' <span class="chk">・查核 ' + r.checked + '</span></div>' +
      (r.note ? '<div class="rnote">' + r.note + '</div>' : "") +
      map +
      '<div class="rbtns"><a class="btn-nav" href="' + navUrl(r.q) + '" target="_blank" rel="noopener">' + ICON.nav + ' 導航</a>' +
      '<a class="btn-ghost" href="' + searchUrl(r.q) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none">Google Link</a></div>' +
      '</div>';
  }

  // ---- 渲染：每日行程 ----
  function renderDay() {
    var d = T.days[state.dayIdx];
    var w = weatherFor(d);
    var wHtml;
    if (w) {
      var ci = codeInfo(w.code);
      var warn = (w.pop != null && w.pop >= 60) || ci.icon === "rain";
      wHtml = '<div class="weather' + (warn ? " warn" : "") + '">' + ICON[ci.icon] + " " +
        w.hi + "° / " + w.lo + "° ・ " + ci.txt +
        (w.pop != null ? ' ・ <span style="color:' + rainColor(w.pop) + ';font-weight:600">降雨' + w.pop + '%</span>' : "") + "</div>";
    } else {
      wHtml = '<div class="weather"><span class="muted">天氣載入中／離線無快取</span></div>';
    }
    var spots = (d.spots || []).map(function (s) {
      return '<div class="spot"><span class="nm">' + s.name + '</span>' +
        '<a class="btn-nav" href="' + navUrl(s.q) + '" target="_blank" rel="noopener">' + ICON.nav + ' 導航</a></div>';
    }).join("");
    var rests = (d.restaurants || []).map(restaurantCard).join("");
    // 天氣連動雨備提示：當日降雨機率達門檻 → 行程卡頂自動跳橫幅
    var rainBanner = (w && w.pop != null && w.pop >= (T.rainThreshold || 60) && d.rainPlan)
      ? '<div class="rain-banner">' + ICON.alert + ' <b>今日降雨機率 ' + w.pop + '%</b>，建議走雨備案：' + d.rainPlan + '</div>'
      : '';
    var rainHours = buildRainHours(d);
    $main.innerHTML =
      '<div class="day-head"><span class="day-meta">Day ' + d.day + ' ・ ' + d.date + " (" + d.weekday + ")</span>" + wHtml + "</div>" +
      rainBanner + rainHours +
      '<h2 class="route">' + d.route + "</h2>" +
      '<div class="stat-row"><div class="stat drive"><div class="k">' + ICON.car + ' 開車</div><div class="v">' + d.driveTime + '</div></div>' +
      '<div class="stat hotel"><div class="k">' + ICON.bed + ' 住宿</div><div class="v">' + d.hotel + '</div></div></div>' +
      note("今日節奏", d.pace) + note("午餐", d.lunch) + note("晚餐", d.dinner) +
      noteRain("雨天備案", d.rainPlan) +
      (spots ? '<div class="section-title">' + ICON.pin + ' 景點導航</div>' + spots : "") +
      (rests ? '<div class="section-title">' + ICON.food + ' 順路餐廳</div>' +
        '<div class="disclaimer">營業時間為快照、徽章為依裝置時間推算，僅供參考，請以現場為準。</div>' + rests : "");
  }
  function note(lab, txt) {
    if (!txt || txt === "—") return "";
    return '<div class="note"><div class="lab">' + lab + '</div><div class="txt">' + txt + "</div></div>";
  }
  function noteRain(lab, txt) {
    if (!txt) return "";
    return '<div class="note rain"><div class="lab">' + ICON.umbrella + " " + lab + '</div><div class="txt">' + txt + "</div></div>";
  }
  // 降雨機率三層色階（穩重調）：低<30% 沉綠／中 30–59% 琥珀／高 ≥60% 磚紅
  function rainColor(p) { return p >= 60 ? "#B05236" : (p >= 30 ? "#BE8A33" : "#5C8A6E"); }
  // 未來幾小時降雨：08–20 時逐時降雨機率長條 + 色階 + 圖例 + 一句總結（無明顯降雨則不顯示）
  function buildRainHours(d) {
    var hrs = hourlyForDay(d);
    if (!hrs) return "";
    var maxP = hrs.reduce(function (m, x) { return Math.max(m, x.prob); }, 0);
    if (maxP < 40) return ""; // 今日大致無雨，不佔版面
    var bars = hrs.map(function (x) {
      var col = rainColor(x.prob);
      var h = Math.max(3, Math.round(x.prob / 100 * 48));
      return '<div class="rh-col"><div class="rh-barwrap"><div class="rh-bar" style="height:' + h + 'px;background:' + col + '"></div></div>' +
        '<div class="rh-pct" style="color:' + col + '">' + x.prob + '%</div><div class="rh-hr">' + pad(x.hour) + '</div></div>';
    }).join("");
    var legend = '<div class="rh-legend">' +
      '<span><i style="background:#5C8A6E"></i>低 &lt;30%</span>' +
      '<span><i style="background:#BE8A33"></i>中 30–59%</span>' +
      '<span><i style="background:#B05236"></i>高 ≥60%</span></div>';
    var firstHigh = hrs.filter(function (x) { return x.prob >= 60; })[0];
    var sum = firstHigh
      ? pad(firstHigh.hour) + ":00 起降雨機率達 " + maxP + "%，記得帶傘。"
      : "時段內有零星雨機率（最高 " + maxP + "%）。";
    return '<div class="rain-hours"><div class="rh-head">' + ICON.clock + ' 未來時段降雨</div>' +
      '<div class="rh-bars">' + bars + '</div>' + legend + '<div class="rh-sum">' + sum + '</div></div>';
  }

  // ---- 渲染：9 天總覽 ----
  function renderOverview() {
    var rows = T.days.map(function (d, i) {
      var w = weatherFor(d), wt = "";
      if (w) { var ci = codeInfo(w.code); wt = " ・ " + ci.txt + " " + w.hi + "°/" + w.lo + "°"; }
      return '<div class="overview-day" data-idx="' + i + '">' +
        '<div class="oh"><div><div class="od">Day ' + d.day + " ・ " + d.date + " (" + d.weekday + ")" + wt + "</div>" +
        '<div class="or">' + d.route + '</div></div></div>' +
        '<div class="om">' + ICON.car + " " + d.driveTime + " ・ " + ICON.bed + " " + d.hotel + "</div></div>";
    }).join("");
    var checks = '<div class="checks"><div class="section-title">出發前最後確認</div><ul>' +
      T.preTripChecks.map(function (c) { return "<li>" + c + "</li>"; }).join("") + "</ul></div>";
    $main.innerHTML = rows + checks;
  }

  // ---- 渲染：全部餐廳 ----
  function renderFood() {
    var html = T.days.map(function (d) {
      if (!d.restaurants || !d.restaurants.length) return "";
      return '<div class="section-title">Day ' + d.day + " ・ " + d.date + " ・ " + d.route + "</div>" +
        d.restaurants.map(restaurantCard).join("");
    }).join("");
    $main.innerHTML = '<div class="disclaimer">營業時間為快照、徽章為依裝置時間推算，僅供參考，請以現場為準。</div>' + html;
  }

  // ---- 渲染：日文溝通卡 ----
  function renderPocket() {
    var cards = (T.phrases || []).map(function (g) {
      var items = g.items.map(function (p) {
        return '<div class="phrase" data-jp="' + p.jp.replace(/"/g, "&quot;") + '">' +
          '<div class="jp">' + p.jp + '</div><div class="zh">' + p.zh + '</div>' +
          '<button class="copy-btn" type="button">複製</button></div>';
      }).join("");
      return '<div class="section-title">' + ICON.chat + ' ' + g.cat + '</div>' + items;
    }).join("");
    $main.innerHTML =
      '<div class="disclaimer">點「複製」可複製日文，給店員看或貼到翻譯。</div>' + cards;
  }

  // ---- 視圖切換 ----
  function setView(v) {
    state.view = v;
    document.querySelectorAll(".tab").forEach(function (t) {
      t.setAttribute("aria-selected", t.getAttribute("data-view") === v ? "true" : "false");
    });
    $strip.classList.toggle("hidden", v !== "day");
    if (v === "day") renderDay();
    else if (v === "overview") renderOverview();
    else if (v === "pocket") renderPocket();
    else renderFood();
    window.scrollTo(0, 0);
  }

  // ---- 事件 ----
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { setView(t.getAttribute("data-view")); });
  });
  document.getElementById("btn-overview").addEventListener("click", function () {
    setView(state.view === "overview" ? "day" : "overview");
  });
  $strip.addEventListener("click", function (e) {
    var chip = e.target.closest(".daychip"); if (!chip) return;
    state.dayIdx = +chip.getAttribute("data-idx"); renderStrip(); renderDay();
  });
  $main.addEventListener("click", function (e) {
    // 複製日文短句
    var cp = e.target.closest(".copy-btn");
    if (cp) {
      var ph = cp.closest(".phrase");
      var jp = ph ? ph.getAttribute("data-jp") : "";
      if (jp && navigator.clipboard) navigator.clipboard.writeText(jp).then(function () {
        cp.textContent = "已複製"; setTimeout(function () { cp.textContent = "複製"; }, 1200);
      });
      return;
    }
    var od = e.target.closest(".overview-day"); if (!od) return;
    state.dayIdx = +od.getAttribute("data-idx"); setView("day"); renderStrip();
  });

  // ---- 啟動 ----
  document.getElementById("brand-title").textContent = T.title;
  document.getElementById("brand-sub").textContent = T.subtitle;
  // 自動跳「當天」（裝置日期；旅程外 fallback Day 1）
  var ti = todayIso();
  var idx = T.days.findIndex(function (d) { return isoOf(d) === ti; });
  state.dayIdx = idx >= 0 ? idx : 0;
  loadWeatherCache();
  renderStrip();
  setView("day");
  fetchWeather();

  // PWA service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
