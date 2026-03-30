/* ============================================================
   Jellyfin IMDb Episode Ratings Grid — Enhanced Edition
   Primary source: ya0903/imdb-episode-dataset (jsDelivr CDN)
   ============================================================ */
(function () {
  "use strict";

  /* ── CONFIG ──────────────────────────────────────────────── */
  const CFG = {
    title: "Episode Ratings",
    styleId: "jf-ieg2-style",
    rootSelector: '[data-jf-ieg2-root="1"]',
    watchDogMs: 700,
    maxWaitMs: 10000,
    reapplyDelayMs: 250,
    readyAnchorWaitMs: 1800,
    cacheTtlMs: 1000 * 60 * 60 * 6,
    epCacheTtlMs: 1000 * 60 * 30,
    datasetBase: "https://cdn.jsdelivr.net/gh/ya0903/imdb-episode-dataset@main/data/shows"
  };

  /* ── COLOUR PALETTE ──────────────────────────────────────── */
  function getRatingColour(r) {
    const v = Number(r);
    if (!Number.isFinite(v)) return null;
    if (v >= 9.5) return { h: 210, s: 90, l: 52, label: "blue" };
    if (v >= 9.0) return { h: 145, s: 72, l: 24, label: "deepgreen" };
    if (v >= 8.0) return { h: 122, s: 58, l: 44, label: "green" };
    if (v >= 7.0) return { h: 48, s: 90, l: 46, label: "yellow" };
    if (v >= 6.0) return { h: 25, s: 88, l: 44, label: "orange" };
    if (v >= 5.0) return { h: 0, s: 78, l: 38, label: "red" };
    return { h: 275, s: 55, l: 36, label: "purple" };
  }

  function getCellStyle(rating) {
    const c = getRatingColour(rating);
    if (!c) return [
      "background:rgba(170,170,170,.14)",
      "border-color:rgba(210,210,210,.16)",
      "color:rgba(255,255,255,.72)",
      "text-shadow:none",
      "box-shadow:none"
    ].join(";");

    const v = Number(rating);
    const frac = v % 1;
    const lBoost = frac * 7;
    const l = Math.min(c.l + lBoost, 72);
    const alpha = 0.82 + frac * 0.12;

    let glow = "";
    if (v >= 9.5) {
      const intensity = Math.min((v - 9.5) * 2, 1);
      glow = `box-shadow:0 0 ${6 + intensity * 8}px hsla(${c.h},${c.s}%,${l + 10}%,${0.35 + intensity * 0.25}),inset 0 1px 0 rgba(255,255,255,.12);`;
    } else if (v >= 9.0) {
      glow = `box-shadow:0 0 5px hsla(${c.h},${c.s}%,${l + 8}%,.28),inset 0 1px 0 rgba(255,255,255,.08);`;
    } else {
      glow = `box-shadow:inset 0 1px 0 rgba(255,255,255,.06);`;
    }

    return [
      `background:hsla(${c.h},${c.s}%,${l}%,${alpha})`,
      `border-color:hsla(${c.h},${c.s}%,${Math.min(l + 18, 85)}%,.30)`,
      "color:#fff",
      "text-shadow:0 1px 2px rgba(0,0,0,.70)",
      glow
    ].join(";");
  }

  function getAvgLineStyle(rating) {
    const c = getRatingColour(rating);
    if (!c) {
      return "background:rgba(170,170,170,.55); box-shadow:none;";
    }
    const v = Number(rating);
    const frac = v % 1;
    const l = Math.min(c.l + frac * 7, 72);
    return `background:hsla(${c.h},${c.s}%,${l}%,.96); box-shadow:0 0 8px hsla(${c.h},${c.s}%,${l + 5}%,.24);`;
  }

  /* ── STATE ───────────────────────────────────────────────── */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let scheduled = null;
  let runSeq = 0;
  let lastItemId = "";

  /* ── INVERT PERSISTENCE ──────────────────────────────────── */
  const INVERT_KEY = "jf2-grid-inverted";

  function getInverted() {
    try { return localStorage.getItem(INVERT_KEY) === "true"; } catch { return false; }
  }

  function setInverted(v) {
    try { localStorage.setItem(INVERT_KEY, v ? "true" : "false"); } catch {}
  }

  function scheduleRun(delay) {
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(run, typeof delay === "number" ? delay : 0);
  }

  /* ── STYLE INJECTION ─────────────────────────────────────── */
  function injectStyle() {
    if (document.getElementById(CFG.styleId)) return;

    const s = document.createElement("style");
    s.id = CFG.styleId;
    s.textContent = `
      [data-jf-ieg2-root="1"] {
        margin: .9em 0 1.2em;
        position: relative;
        z-index: 3;
        clear: both;
        width: 100%;
        max-width: calc(100% - 3rem);
      }

      @media (max-width: 900px) {
        [data-jf-ieg2-root="1"] { max-width: 100%; }
        .jf2-body { padding: .6rem .4rem !important; }
      }

      .jf2-box {
        border-radius: 14px;
        overflow: hidden;
        background: rgba(10,10,14,.55);
        border: 1px solid rgba(255,255,255,.10);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }

      .jf2-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        gap: .6rem;
        border: 0;
        margin: 0;
        padding: .7rem 1rem;
        cursor: pointer;
        color: inherit;
        background: rgba(255,255,255,.03);
        text-align: left;
        font: inherit;
        outline: none !important;
        box-shadow: none !important;
        -webkit-tap-highlight-color: transparent;
        transition: background .15s;
      }

      .jf2-toggle:hover { background: rgba(255,255,255,.055); }

      .jf2-toggle-title {
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: .01em;
        opacity: .92;
        flex: 1;
      }

      .jf2-toggle-badge {
        font-size: .7rem;
        font-weight: 700;
        letter-spacing: .06em;
        text-transform: uppercase;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 5px;
        padding: .14rem .42rem;
        opacity: .7;
      }

      .jf2-toggle-chevron {
        transition: transform .18s ease;
        opacity: .65;
        flex: 0 0 auto;
      }

      .jf2-toggle[aria-expanded="true"] .jf2-toggle-chevron {
        transform: rotate(180deg);
      }

      .jf2-panel {
        border-top: 1px solid rgba(255,255,255,.07);
      }

      .jf2-panel[hidden] { display: none !important; }

      .jf2-body {
        padding: .75rem .85rem .9rem;
      }

      .jf2-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .6rem;
        margin-bottom: .72rem;
        flex-wrap: wrap;
      }

      .jf2-legend {
        display: flex;
        flex-wrap: wrap;
        gap: .45rem;
        align-items: center;
      }

      .jf2-legend-item {
        display: flex;
        align-items: center;
        gap: .35rem;
        font-size: .8rem;
        opacity: .84;
        font-weight: 600;
      }

      .jf2-legend-dot {
        width: 11px;
        height: 11px;
        border-radius: 4px;
        flex: 0 0 auto;
      }

      .jf2-btn {
        display: flex;
        align-items: center;
        gap: .3rem;
        border: 1px solid rgba(255,255,255,.13);
        border-radius: 7px;
        background: rgba(255,255,255,.05);
        color: inherit;
        font: inherit;
        font-size: .75rem;
        font-weight: 600;
        letter-spacing: .03em;
        padding: .28rem .62rem;
        cursor: pointer;
        outline: none !important;
        transition: background .14s, border-color .14s;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
      }

      .jf2-btn:hover {
        background: rgba(255,255,255,.10);
        border-color: rgba(255,255,255,.22);
      }

      .jf2-btn svg { opacity: .75; }

      .jf2-btn.jf2-btn-active {
        border-color: rgba(255,255,255,.35) !important;
        background: rgba(255,255,255,.10) !important;
      }

      .jf2-scroll {
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: .15rem;
        max-width: 100%;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,.12) transparent;
      }

      .jf2-scroll::-webkit-scrollbar { height: 4px; }
      .jf2-scroll::-webkit-scrollbar-track { background: transparent; }
      .jf2-scroll::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,.15);
        border-radius: 2px;
      }

      .jf2-grid {
        display: inline-grid;
        gap: .22rem;
        align-items: stretch;
        min-width: max-content;
      }

      .jf2-cell {
        min-width: 2.15rem;
        min-height: 2.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        border-radius: 7px;
        box-sizing: border-box;
        padding: .15rem .2rem;
        line-height: 1;
        border: 1px solid rgba(255,255,255,.07);
        background: rgba(255,255,255,.03);
        font-size: .82rem;
        position: relative;
      }

      .jf2-corner {
        visibility: hidden;
        pointer-events: none;
        border-color: transparent !important;
        background: transparent !important;
      }

      .jf2-season {
        font-weight: 700;
        font-size: .84rem;
        background: rgba(255,255,255,.06) !important;
        border-color: rgba(255,255,255,.11) !important;
        cursor: pointer;
        transition: background .14s, border-color .14s;
        text-decoration: none !important;
        color: inherit !important;
        outline: none !important;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
      }

      .jf2-season:hover {
        background: rgba(255,255,255,.11) !important;
        border-color: rgba(255,255,255,.22) !important;
      }

      .jf2-ep-header {
        font-weight: 700;
        font-size: .82rem;
        background: rgba(255,255,255,.06) !important;
        border-color: rgba(255,255,255,.11) !important;
        position: sticky;
        left: 0;
        z-index: 3;
        white-space: nowrap;
        min-width: 2.8rem;
      }

      .jf2-avg-header {
        font-weight: 700;
        font-size: .8rem;
        background: rgba(255,255,255,.08) !important;
        border-color: rgba(255,255,255,.14) !important;
        color: rgba(255,255,255,.82) !important;
      }

      .jf2-rating {
        cursor: pointer;
        font-weight: 900;
        font-size: 1.18rem;
        letter-spacing: -.03em;
        font-variant-numeric: tabular-nums;
        transition: filter .14s, border-color .14s, transform .1s;
        text-decoration: none !important;
        outline: none !important;
        -webkit-tap-highlight-color: transparent;
        color: #fff !important;
      }

      .jf2-rating:hover {
        filter: brightness(1.3) saturate(1.3);
        transform: scale(1.08);
        z-index: 5;
      }

      .jf2-rating-unknown {
        cursor: pointer;
        font-weight: 900;
        font-size: 1.18rem;
        letter-spacing: -.03em;
        font-variant-numeric: tabular-nums;
        transition: border-color .14s, transform .1s, background .14s;
        text-decoration: none !important;
        outline: none !important;
        -webkit-tap-highlight-color: transparent;
        color: rgba(255,255,255,.72) !important;
      }

      .jf2-rating-unknown:hover {
        transform: scale(1.05);
        border-color: rgba(255,255,255,.24) !important;
        background: rgba(190,190,190,.18) !important;
        z-index: 5;
      }

      .jf2-multi-badge {
        position: absolute;
        top: 2px;
        right: 3px;
        font-size: .48rem;
        font-weight: 800;
        letter-spacing: .03em;
        opacity: .75;
        line-height: 1;
        pointer-events: none;
      }

      .jf2-empty {
        opacity: .10;
        background: rgba(255,255,255,.02) !important;
        cursor: default;
      }

      .jf2-avg-wrap {
        min-width: 2.6rem;
        min-height: 2.25rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: .08rem .15rem .1rem;
        box-sizing: border-box;
        border-radius: 0;
        background: transparent !important;
        border: 0 !important;
      }

      .jf2-avg-value {
        font-weight: 900;
        font-size: 1.02rem;
        letter-spacing: -.02em;
        line-height: 1;
        color: #fff;
        font-variant-numeric: tabular-nums;
      }

      .jf2-avg-value.jf2-avg-unknown {
        color: rgba(255,255,255,.58);
      }

      .jf2-avg-line {
        width: 100%;
        height: 4px;
        margin-top: .34rem;
        border-radius: 999px;
        background: rgba(170,170,170,.55);
      }

      .jf2-tooltip {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        background: rgba(8,8,12,.93);
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 8px;
        padding: .42rem .65rem;
        font-size: .8rem;
        line-height: 1.45;
        max-width: 220px;
        white-space: normal;
        box-shadow: 0 4px 18px rgba(0,0,0,.55);
        backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity .1s;
        transform: translateY(-4px);
      }

      .jf2-tooltip.jf2-tt-show {
        opacity: 1;
        transform: translateY(0);
      }

      .jf2-tooltip-code {
        font-size: .7rem;
        font-weight: 700;
        letter-spacing: .04em;
        opacity: .55;
        margin-bottom: .15rem;
      }

      .jf2-tooltip-title {
        font-weight: 600;
        opacity: .92;
      }

      .jf2-tooltip-rating {
        font-size: .72rem;
        margin-top: .18rem;
        opacity: .60;
      }

      .jf2-tooltip-multi {
        font-size: .7rem;
        font-style: italic;
        opacity: .50;
        margin-top: .1rem;
      }

      .jf2-status {
        font-size: .88rem;
        opacity: .7;
        padding: .2rem .05rem;
      }

      .jf2-fallback-link {
        color: inherit !important;
        text-decoration: none !important;
        font-weight: 700;
        opacity: .75;
        border-bottom: 1px solid rgba(255,255,255,.2);
        padding-bottom: 1px;
      }

      .jf2-fallback-link:hover { opacity: 1; }

      .jf2-shimmer-row {
        display: flex;
        gap: .22rem;
        margin-bottom: .22rem;
      }

      .jf2-shimmer-cell {
        height: 2.25rem;
        border-radius: 7px;
        background: linear-gradient(
          90deg,
          rgba(255,255,255,.04) 25%,
          rgba(255,255,255,.09) 50%,
          rgba(255,255,255,.04) 75%
        );
        background-size: 200% 100%;
        animation: jf2-shimmer 1.4s infinite;
      }

      @keyframes jf2-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── ROUTING HELPERS ─────────────────────────────────────── */
  function isDetailsRoute() {
    const h = String(location.hash || "");
    return h.includes("/details") && (h.includes("id=") || new URL(location.href).searchParams.get("id"));
  }

  function getItemIdFromUrl() {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("id");
    if (id) return id;
    const m = (url.hash || "").match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getBaseUrl() {
    return window.location.origin;
  }

  function getAccessToken() {
    try {
      const raw = localStorage.getItem("jellyfin_credentials");
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const srv = obj?.Servers?.find(s => s.AccessToken);
      return srv ? srv.AccessToken : null;
    } catch {
      return null;
    }
  }

  /* ── SESSION CACHE ───────────────────────────────────────── */
  function cGet(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() > obj.exp) {
        sessionStorage.removeItem(key);
        return null;
      }
      return obj.v;
    } catch {
      return null;
    }
  }

  function cSet(key, value, ttl) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ v: value, exp: Date.now() + ttl }));
    } catch {}
  }

  /* ── JELLYFIN API ────────────────────────────────────────── */
  async function jfGet(path) {
    const token = getAccessToken();
    if (!token) throw new Error("No token");

    const r = await fetch(getBaseUrl() + path, {
      headers: { "X-Emby-Token": token }
    });

    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function fetchItem(itemId) {
    const k = "jf2_item_" + itemId;
    const c = cGet(k);
    if (c) return c;

    const data = await jfGet("/Items/" + itemId + "?Fields=ProviderIds");
    cSet(k, data, CFG.cacheTtlMs);
    return data;
  }

  async function fetchAllEpisodes(seriesId) {
    const k = "jf2_eps_" + seriesId;
    const c = cGet(k);
    if (c) return c;

    const data = await jfGet(
      "/Shows/" + seriesId + "/Episodes" +
      "?Fields=ProviderIds,IndexNumberEnd,ParentIndexNumber,IndexNumber,Name,PremiereDate" +
      "&EnableImages=false"
    );

    const items = data?.Items || [];
    const seasons = {};

    for (const ep of items) {
      const s = ep.ParentIndexNumber;
      const e = ep.IndexNumber;

      if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
      if (s < 1 || e < 1) continue;

      if (!seasons[s]) seasons[s] = [];

      const eEnd = typeof ep.IndexNumberEnd === "number" && ep.IndexNumberEnd >= e
        ? ep.IndexNumberEnd
        : e;

      const imdbId = ep.ProviderIds?.Imdb || ep.ProviderIds?.imdb || "";

      seasons[s].push({
        ep: e,
        epEnd: eEnd,
        name: ep.Name || "",
        jfId: ep.Id || "",
        imdbId: imdbId ? normaliseId(imdbId) : "",
        combined: eEnd > e,
        airDate: ep.PremiereDate || ""
      });
    }

    cSet(k, seasons, CFG.epCacheTtlMs);
    return seasons;
  }

  /* ── PRIMARY DATASET ─────────────────────────────────────── */

  function convertShowDataToArray(showData) {
    const seasons = showData?.seasons;
    if (!seasons) return null;

    const seasonNums = Object.keys(seasons).map(Number).filter(n => n > 0);
    if (!seasonNums.length) return null;

    const maxSeason = Math.max(...seasonNums);
    const result = [];

    for (let s = 1; s <= maxSeason; s++) {
      const seasonEps = seasons[String(s)] || {};
      const episodes = Object.entries(seasonEps)
        .map(([epNum, epData]) => ({
          episode: parseInt(epNum, 10),
          rating: typeof epData.r === "number" ? epData.r : null,
          id: ""
        }))
        .filter(ep => Number.isFinite(ep.episode) && ep.episode > 0);
      result.push(episodes);
    }

    return result.some(arr => arr.length) ? result : null;
  }

  async function fetchImdbDataset(imdbId) {
    const k = "jf2_imdb_" + imdbId;
    const c = cGet(k);
    if (c !== null) return c;

    const r = await fetch(
      CFG.datasetBase + "/" + encodeURIComponent(imdbId) + ".json",
      { credentials: "omit" }
    );

    if (r.status === 404) {
      cSet(k, null, CFG.cacheTtlMs);
      return null;
    }

    if (!r.ok) throw new Error("IMDB dataset HTTP " + r.status);

    const showData = await r.json();
    const converted = convertShowDataToArray(showData);
    cSet(k, converted, CFG.cacheTtlMs);
    return converted;
  }

  async function fetchEpisodeDataset(imdbId) {
    try {
      const data = await fetchImdbDataset(imdbId);
      if (Array.isArray(data) && data.length) {
        return { data, source: "dataset" };
      }
    } catch {}

    return { data: null, source: null };
  }

  /* ── MERGE ───────────────────────────────────────────────── */
  function buildMergedData(imdbData, jfSeasons) {
    const result = [];
    const maxSeason = Math.max(
      imdbData ? imdbData.length : 0,
      Math.max(0, ...Object.keys(jfSeasons).map(Number))
    );

    for (let si = 1; si <= maxSeason; si++) {
      const imdbSeason = ((imdbData && imdbData[si - 1]) || []).filter(ep => Number(ep.episode) > 0);
      const jfEps = (jfSeasons[si] || []).filter(e => Number(e.ep) > 0);

      const imdbByEp = {};
      for (const ep of imdbSeason) {
        const n = Number(ep.episode);
        if (Number.isFinite(n) && n > 0) imdbByEp[n] = ep;
      }

      const allEpNums = new Set([
        ...imdbSeason.map(e => Number(e.episode)).filter(n => Number.isFinite(n) && n > 0),
        ...jfEps.map(e => e.ep).filter(n => Number.isFinite(n) && n > 0)
      ]);

      const episodes = [];
      const seen = new Set();

      for (const epNum of [...allEpNums].sort((a, b) => a - b)) {
        if (!Number.isFinite(epNum) || epNum < 1 || seen.has(epNum)) continue;
        seen.add(epNum);

        const jf = jfEps.find(e => e.ep === epNum);
        const imdb = imdbByEp[epNum];

        let rating = null;
        let imdbEpId = "";

        if (imdb) {
          rating = Number(imdb.rating);
          if (!Number.isFinite(rating) || rating <= 0) rating = null;
          imdbEpId = imdb.id || "";
        }

        const epEnd = jf ? jf.epEnd : epNum;
        const combined = jf ? jf.combined : false;
        const name = jf ? jf.name : "";
        const jfId = jf ? jf.jfId : "";

        if (combined && epEnd > epNum) {
          for (let k = epNum + 1; k <= epEnd; k++) {
            if (k > 0) seen.add(k);
          }
        }

        episodes.push({
          ep: epNum,
          epEnd,
          name,
          jfId,
          imdbEpId,
          rating,
          combined,
          airDate: jf ? jf.airDate : ""
        });
      }

      if (episodes.length) result.push({ num: si, episodes });
    }

    return result;
  }

  /* ── HELPERS ─────────────────────────────────────────────── */
  function normaliseId(id) {
    const s = String(id || "").trim();
    return s ? (s.startsWith("tt") ? s : "tt" + s) : "";
  }

  function getPid(item, key) {
    const ids = item?.ProviderIds;
    if (!ids) return "";
    const t = key.toLowerCase();
    for (const k of Object.keys(ids)) {
      if (k.toLowerCase() === t) return String(ids[k] || "");
    }
    return "";
  }

  function buildSeasonUrl(imdbId, s) {
    return `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/episodes/?season=${s}`;
  }

  function buildEpUrl(epImdbId, fallbackSeasonUrl) {
    return epImdbId
      ? `https://www.imdb.com/title/${encodeURIComponent(epImdbId)}/`
      : fallbackSeasonUrl;
  }

  function buildJfUrl(jfId) {
    return jfId ? `${getBaseUrl()}/web/index.html#!/details?id=${jfId}` : null;
  }

  /* ── DOM HELPERS ─────────────────────────────────────────── */
  function isVisible(el) {
    if (!el?.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function pickBestVisible(els) {
    let best = null;
    let bestArea = 0;

    for (const el of els) {
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    }

    return best || els[els.length - 1] || null;
  }

  function findInsertTarget() {
    const cast = pickBestVisible([...document.querySelectorAll("#castCollapsible")]);
    if (cast?.parentNode) return { parent: cast.parentNode, before: cast };

    const ph = pickBestVisible([...document.querySelectorAll("#peopleHeader")]);
    const sec = ph?.closest(".verticalSection, .detailVerticalSection, .emby-scroller-container");
    if (sec?.parentNode && isVisible(sec)) return { parent: sec.parentNode, before: sec };

    return null;
  }

  function findOfficialImdbLink(imdbId) {
    if (!imdbId) return null;

    return pickBestVisible(
      [...document.querySelectorAll('a[href*="imdb.com/title/"]')].filter(a => {
        if (!a.isConnected || a.closest(CFG.rootSelector)) return false;
        if (!isVisible(a)) return false;
        const m = (a.getAttribute("href") || "").match(/imdb\.com\/(?:[a-z]{2}\/)?title\/(tt\d+)/i);
        return m && m[1] === imdbId;
      })
    );
  }

  function findCurrentBlock(itemId) {
    return [...document.querySelectorAll(CFG.rootSelector)].find(el => el.dataset.itemId === itemId) || null;
  }

  function cleanupForeign(itemId) {
    for (const el of document.querySelectorAll(CFG.rootSelector)) {
      if (el.dataset.itemId !== itemId) el.remove();
    }
  }

  function removeAll() {
    for (const el of document.querySelectorAll(CFG.rootSelector)) el.remove();
  }

  /* ── TOOLTIP ─────────────────────────────────────────────── */
  let tooltip = null;

  function getTooltip() {
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "jf2-tooltip";
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function showTooltip(ev, { code, title, rating, combined, epEnd, unreleased }) {
    const tt = getTooltip();
    tt.innerHTML = `
      <div class="jf2-tooltip-code">${code}</div>
      <div class="jf2-tooltip-title">${title || "Unknown episode"}</div>
      ${unreleased
        ? `<div class="jf2-tooltip-rating">Not yet released</div>`
        : rating != null
          ? `<div class="jf2-tooltip-rating">IMDb ${Number(rating).toFixed(1)}</div>`
          : `<div class="jf2-tooltip-rating">IMDb rating unavailable</div>`}
      ${combined ? `<div class="jf2-tooltip-multi">Combined episodes up to E${epEnd}</div>` : ""}
    `;
    positionTooltip(ev);
    tt.classList.add("jf2-tt-show");
  }

  function hideTooltip() {
    tooltip?.classList.remove("jf2-tt-show");
  }

  function positionTooltip(ev) {
    if (!tooltip) return;
    const tw = 230;
    const th = 90;
    let x = ev.clientX + 12;
    let y = ev.clientY + 12;

    if (x + tw > window.innerWidth) x = ev.clientX - tw - 8;
    if (y + th > window.innerHeight) y = ev.clientY - th - 8;

    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  document.addEventListener("mousemove", ev => {
    if (tooltip?.classList.contains("jf2-tt-show")) positionTooltip(ev);
  });

  /* ── GRID BUILDING ───────────────────────────────────────── */
  function buildSeasonAverages(seasons) {
    return seasons.map(s => {
      const rated = s.episodes.filter(e => e.rating != null && Number.isFinite(e.rating));
      if (!rated.length) return null;
      return rated.reduce((sum, e) => sum + e.rating, 0) / rated.length;
    });
  }

  function buildLegend() {
    const items = [
      { label: "9.5+", h: 210, s: 90, l: 52 },
      { label: "9+",   h: 145, s: 72, l: 24 },
      { label: "8+",   h: 122, s: 58, l: 44 },
      { label: "7+",   h: 48,  s: 90, l: 53 },
      { label: "6+",   h: 25,  s: 88, l: 51 },
      { label: "5+",   h: 0,   s: 78, l: 45 },
      { label: "<5",   h: 275, s: 55, l: 43 },
      { label: "Unknown", grey: true }
    ];

    const wrap = document.createElement("div");
    wrap.className = "jf2-legend";

    for (const it of items) {
      const d = document.createElement("div");
      d.className = "jf2-legend-item";

      if (it.grey) {
        d.innerHTML = `<span class="jf2-legend-dot" style="background:rgba(170,170,170,.7)"></span>${it.label}`;
      } else {
        d.innerHTML = `<span class="jf2-legend-dot" style="background:hsl(${it.h},${it.s}%,${it.l}%)"></span>${it.label}`;
      }

      wrap.appendChild(d);
    }

    return wrap;
  }

  function buildAvgCell(avg) {
    const d = document.createElement("div");
    d.className = "jf2-avg-wrap";

    const value = document.createElement("div");
    value.className = "jf2-avg-value";

    const line = document.createElement("div");
    line.className = "jf2-avg-line";

    if (avg == null) {
      value.classList.add("jf2-avg-unknown");
      value.textContent = "-";
      line.style.cssText = getAvgLineStyle(null);
      d.title = "Season average unavailable";
    } else {
      value.textContent = avg.toFixed(1);
      line.style.cssText = getAvgLineStyle(avg);
      d.title = `Season average: ${avg.toFixed(2)}`;
    }

    d.appendChild(value);
    d.appendChild(line);
    return d;
  }

  function buildGrid(seasons, seriesImdbId, inverted) {
    const avgs = buildSeasonAverages(seasons);

    const allEpNums = [...new Set(
      seasons.flatMap(s => s.episodes.map(e => e.ep)).filter(n => Number.isFinite(n) && n > 0)
    )].sort((a, b) => a - b);

    const wrapper = document.createElement("div");
    wrapper.className = "jf2-scroll";

    const grid = document.createElement("div");
    grid.className = "jf2-grid";

    if (!inverted) {
      const colCount = seasons.length;
      grid.style.gridTemplateColumns = `2.8rem repeat(${colCount}, 2.6rem)`;

      const corner = document.createElement("div");
      corner.className = "jf2-cell jf2-corner";
      grid.appendChild(corner);

      for (const s of seasons) {
        const a = document.createElement("a");
        a.className = "jf2-cell jf2-season";
        a.textContent = "S" + s.num;
        a.href = buildSeasonUrl(seriesImdbId, s.num);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.setAttribute("is", "emby-linkbutton");
        a.classList.add("emby-button", "button-link");
        grid.appendChild(a);
      }

      for (const epNum of allEpNums) {
        const epHeader = document.createElement("div");
        epHeader.className = "jf2-cell jf2-ep-header";
        epHeader.textContent = "E" + epNum;
        grid.appendChild(epHeader);

        for (let si = 0; si < seasons.length; si++) {
          const s = seasons[si];
          const ep = s.episodes.find(e => e.ep === epNum);
          grid.appendChild(buildRatingCell(ep, s.num, epNum, seriesImdbId));
        }
      }

      const avgHeader = document.createElement("div");
      avgHeader.className = "jf2-cell jf2-ep-header jf2-avg-header";
      avgHeader.textContent = "AVG";
      grid.appendChild(avgHeader);

      for (let i = 0; i < seasons.length; i++) {
        grid.appendChild(buildAvgCell(avgs[i]));
      }
    } else {
      const colCount = allEpNums.length + 1;
      grid.style.gridTemplateColumns = `2.8rem repeat(${colCount}, 2.6rem)`;

      const corner = document.createElement("div");
      corner.className = "jf2-cell jf2-corner";
      grid.appendChild(corner);

      for (const epNum of allEpNums) {
        const epHeader = document.createElement("div");
        epHeader.className = "jf2-cell jf2-season";
        epHeader.textContent = "E" + epNum;
        grid.appendChild(epHeader);
      }

      const avgTop = document.createElement("div");
      avgTop.className = "jf2-cell jf2-season jf2-avg-header";
      avgTop.textContent = "AVG";
      grid.appendChild(avgTop);

      for (let si = 0; si < seasons.length; si++) {
        const s = seasons[si];

        const sHeader = document.createElement("a");
        sHeader.className = "jf2-cell jf2-ep-header";
        sHeader.textContent = "S" + s.num;
        sHeader.href = buildSeasonUrl(seriesImdbId, s.num);
        sHeader.target = "_blank";
        sHeader.rel = "noopener noreferrer";
        grid.appendChild(sHeader);

        for (const epNum of allEpNums) {
          const ep = s.episodes.find(e => e.ep === epNum);
          grid.appendChild(buildRatingCell(ep, s.num, epNum, seriesImdbId));
        }

        grid.appendChild(buildAvgCell(avgs[si]));
      }
    }

    wrapper.appendChild(grid);
    return wrapper;
  }

  function buildRatingCell(ep, seasonNum, epNum, seriesImdbId) {
    if (!ep) {
      const d = document.createElement("div");
      d.className = "jf2-cell jf2-empty";
      return d;
    }

    const jfUrl = buildJfUrl(ep.jfId);
    const imdbUrl = buildEpUrl(ep.imdbEpId, buildSeasonUrl(seriesImdbId, seasonNum));
    const targetUrl = jfUrl || imdbUrl;

    const a = document.createElement("a");
    const isUnreleased = ep.airDate ? new Date(ep.airDate) > new Date() : false;
    const isUnknown = isUnreleased || ep.rating == null || !Number.isFinite(Number(ep.rating));

    a.className = `jf2-cell ${isUnknown ? "jf2-rating-unknown" : "jf2-rating"}`;
    a.style.cssText = getCellStyle(isUnknown ? null : ep.rating);
    a.textContent = isUnknown ? "-" : Number(ep.rating).toFixed(1);
    a.href = targetUrl;

    if (!jfUrl) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("is", "emby-linkbutton");
      a.classList.add("emby-button", "button-link");
    }

    const sCode = String(seasonNum).padStart(2, "0");
    const eCode = String(epNum).padStart(2, "0");
    const code = `S${sCode}E${eCode}${ep.combined ? `-E${String(ep.epEnd).padStart(2, "0")}` : ""}`;

    a.title = code + (ep.name ? " • " + ep.name : "");
    a.dataset.code = code;
    a.dataset.name = ep.name || "";
    a.dataset.rating = isUnknown ? "" : String(ep.rating);
    a.dataset.combined = ep.combined ? "1" : "0";
    a.dataset.epEnd = ep.epEnd;

    if (ep.combined) {
      const badge = document.createElement("span");
      badge.className = "jf2-multi-badge";
      badge.textContent = "2+";
      a.appendChild(badge);
    }

    a.addEventListener("mouseenter", ev => {
      showTooltip(ev, {
        code,
        title: ep.name,
        rating: isUnknown ? null : ep.rating,
        combined: ep.combined,
        epEnd: ep.epEnd,
        unreleased: isUnreleased
      });
    });

    a.addEventListener("mouseleave", hideTooltip);

    return a;
  }

  /* ── RENDERING ───────────────────────────────────────────── */
  function renderLoading(body) {
    body.innerHTML = "";

    const shimmer = document.createElement("div");
    const widths = ["2.8rem", "2.6rem", "2.6rem", "2.6rem", "2.6rem", "2.6rem"];

    for (let row = 0; row < 4; row++) {
      const r = document.createElement("div");
      r.className = "jf2-shimmer-row";

      widths.forEach((w, i) => {
        const c = document.createElement("div");
        c.className = "jf2-shimmer-cell";
        c.style.width = w;
        c.style.animationDelay = (row * widths.length + i) * 0.04 + "s";
        r.appendChild(c);
      });

      shimmer.appendChild(r);
    }

    body.appendChild(shimmer);
  }

  function renderFallback(body, imdbId) {
    body.innerHTML = "";
    const p = document.createElement("p");
    p.className = "jf2-status";
    p.innerHTML = `No episode rating data found. <a class="jf2-fallback-link" href="https://www.imdb.com/title/${encodeURIComponent(imdbId)}/ratings/" target="_blank" rel="noopener noreferrer">View on IMDb ↗</a>`;
    body.appendChild(p);
  }

  function renderGrid(body, seasons, seriesImdbId) {
    body.innerHTML = "";

    // Read persisted invert state
    let inverted = getInverted();

    const toolbar = document.createElement("div");
    toolbar.className = "jf2-toolbar";

    toolbar.appendChild(buildLegend());

    const invertBtn = document.createElement("button");
    invertBtn.className = "jf2-btn" + (inverted ? " jf2-btn-active" : "");
    invertBtn.type = "button";
    invertBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 5h12M2 8h12M2 11h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M5 2v12M8 2v12M11 2v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".4"/>
      </svg>
      Invert
    `;

    toolbar.appendChild(invertBtn);
    body.appendChild(toolbar);

    let gridEl = buildGrid(seasons, seriesImdbId, inverted);
    body.appendChild(gridEl);

    invertBtn.addEventListener("click", () => {
      inverted = !inverted;
      setInverted(inverted);
      invertBtn.classList.toggle("jf2-btn-active", inverted);

      const newGrid = buildGrid(seasons, seriesImdbId, inverted);
      gridEl.replaceWith(newGrid);
      gridEl = newGrid;
    });
  }

  /* ── PANEL LOAD ──────────────────────────────────────────── */
  async function loadPanel(root) {
    if (root.dataset.loaded === "1" || root.dataset.loading === "1") return;
    root.dataset.loading = "1";

    const body = root.querySelector(".jf2-body");
    if (!body) {
      root.dataset.loading = "0";
      return;
    }

    renderLoading(body);

    try {
      const imdbId = root.dataset.imdbId;
      const seriesId = root.dataset.itemId;

      const jfSeasons = await fetchAllEpisodes(seriesId).catch(() => ({}));
      const fetched = await fetchEpisodeDataset(imdbId);
      const seasons = buildMergedData(fetched.data, jfSeasons);

      body.innerHTML = "";

      if (!seasons.length || !seasons.some(s => s.episodes.some(e => e.rating != null || e.name || e.jfId))) {
        renderFallback(body, imdbId);
      } else {
        renderGrid(body, seasons, imdbId);
      }

      root.dataset.loaded = "1";
    } catch (err) {
      console.warn("[JF-IEG2] Panel load failed", err);
      renderFallback(body, root.dataset.imdbId);
      root.dataset.loaded = "1";
    } finally {
      root.dataset.loading = "0";
    }
  }

  /* ── BLOCK CREATION ──────────────────────────────────────── */
  function createBlock(itemId, imdbId) {
    const root = document.createElement("section");
    root.setAttribute("data-jf-ieg2-root", "1");
    root.dataset.itemId = itemId;
    root.dataset.imdbId = imdbId;
    root.dataset.loaded = "0";
    root.dataset.loading = "0";

    root.innerHTML = `
      <div class="jf2-box">
        <button type="button" class="jf2-toggle" aria-expanded="false">
          <span class="jf2-toggle-title">Episode Ratings</span>
          <span class="jf2-toggle-badge">IMDb</span>
          <svg class="jf2-toggle-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
            xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="jf2-panel" hidden>
          <div class="jf2-body"></div>
        </div>
      </div>
    `;

    const toggle = root.querySelector(".jf2-toggle");
    const panel = root.querySelector(".jf2-panel");

    loadPanel(root);

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      const next = !expanded;
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
      panel.hidden = !next;

      if (next && root.dataset.loaded !== "1" && root.dataset.loading !== "1") {
        loadPanel(root);
      }
    });

    return root;
  }

  function ensureMounted(itemId, imdbId, target) {
    cleanupForeign(itemId);

    let block = findCurrentBlock(itemId);

    if (block && block.dataset.imdbId !== imdbId) {
      block.remove();
      block = null;
    }

    if (!block) {
      block = createBlock(itemId, imdbId);
      target.parent.insertBefore(block, target.before);
    } else if (block.nextSibling !== target.before) {
      target.parent.insertBefore(block, target.before);
    }
  }

  /* ── MAIN RUN LOOP ───────────────────────────────────────── */
  async function run() {
    const seq = ++runSeq;
    injectStyle();

    if (!isDetailsRoute()) {
      removeAll();
      return;
    }

    const itemId = getItemIdFromUrl();
    if (!itemId) return;

    let item;
    try {
      item = await fetchItem(itemId);
    } catch {
      return;
    }

    if (seq !== runSeq || !item) return;

    if (item.Type !== "Series") {
      removeAll();
      return;
    }

    const imdbId = normaliseId(getPid(item, "imdb"));
    if (!imdbId) {
      removeAll();
      return;
    }

    const existing = findCurrentBlock(itemId);
    if (existing?.dataset.imdbId === imdbId && existing.isConnected && isVisible(existing)) return;

    const started = Date.now();
    let target = null;

    while (Date.now() - started < CFG.maxWaitMs) {
      if (seq !== runSeq) return;
      if (getItemIdFromUrl() !== itemId) return;

      target = findInsertTarget();
      const hasLink = findOfficialImdbLink(imdbId);

      if (target && hasLink) break;
      if (target && Date.now() - started >= CFG.readyAnchorWaitMs) break;

      await sleep(100);
    }

    if (seq !== runSeq || !target) return;
    ensureMounted(itemId, imdbId, target);
  }

  /* ── EVENT BINDINGS ──────────────────────────────────────── */
  window.addEventListener("hashchange", () => scheduleRun(0), true);
  window.addEventListener("popstate", () => scheduleRun(0), true);
  document.addEventListener("viewshow", () => scheduleRun(0), true);
  document.addEventListener("viewbeforeshow", () => scheduleRun(0), true);

  if (document.body) {
    new MutationObserver(() => {
      if (!isDetailsRoute()) return;
      const id = getItemIdFromUrl() || "";
      if (!id) return;
      const b = findCurrentBlock(id);
      if (!b || !b.isConnected || !isVisible(b)) scheduleRun(CFG.reapplyDelayMs);
    }).observe(document.body, { childList: true, subtree: true });
  }

  setInterval(() => {
    if (!isDetailsRoute()) return;

    const id = getItemIdFromUrl() || "";
    const b = id ? findCurrentBlock(id) : null;

    if (id && id !== lastItemId) {
      lastItemId = id;
      scheduleRun(0);
      scheduleRun(350);
      scheduleRun(900);
      return;
    }

    if (id && (!b || !b.isConnected || !isVisible(b))) {
      scheduleRun(CFG.reapplyDelayMs);
    }
  }, CFG.watchDogMs);

  scheduleRun(0);
})();
