// Real map: MapLibre GL + OpenFreeMap vector tiles (OpenStreetMap data).
// Loaded lazily through LazyMap so the ~250 KB library only downloads when a map is shown.

import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import { useEffect, useRef } from "react";
import type { District } from "../../api";
import type { LngLat } from "../../lib/geo";
import { VILNIUS_CENTER } from "../../lib/geo";
import type { ViewStatus } from "../../lib/problemModel";
import "./map.css";

export interface MapPin {
  id: string;
  at: LngLat;
  status: ViewStatus;
  title: string;
  score: number;
  /** Already answered by this user: drawn gray, since there is nothing left to do. */
  checked?: boolean;
}

export interface MapLabel {
  at: LngLat;
  text: string;
}

export interface VilniusMapProps {
  /** Accessible name of the map region. */
  label: string;
  height: number;
  pins?: MapPin[];
  /** Group nearby pins into a count marker (default true). */
  cluster?: boolean;
  /** Draw pins as priority circles (municipality hotspots) instead of status pins. */
  hotspots?: boolean;
  labels?: MapLabel[];
  /** Draw district outlines. */
  districts?: District[];
  onOpen?: (id: string) => void;
  /** Pick mode: pins fade, tapping the map reports the point. */
  onPick?: (at: LngLat) => void;
  mark?: LngLat;
  /** Show the "my location" button; called with the position when found. */
  onLocate?: (at: LngLat) => void;
  center?: LngLat;
  zoom?: number;
  /** Fit the view to the pins on first load (default true when there are pins and no center). */
  fit?: boolean;
  /** Static preview: no panning, zooming or controls. */
  still?: boolean;
}

const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const FONT = ["Noto Sans Bold"];

// Lithuanian strings for MapLibre's built-in controls.
const LOCALE: Record<string, string> = {
  "AttributionControl.ToggleAttribution": "Rodyti šaltinius",
  "GeolocateControl.FindMyLocation": "Mano vieta",
  "GeolocateControl.LocationNotAvailable": "Vieta nepasiekiama",
  "NavigationControl.ZoomIn": "Priartinti",
  "NavigationControl.ZoomOut": "Nutolinti",
  "CooperativeGesturesHandler.WindowsHelpText": "Laikykite Ctrl ir sukite pelės ratuką, kad keistumėte mastelį",
  "CooperativeGesturesHandler.MacHelpText": "Laikykite ⌘ ir sukite pelės ratuką, kad keistumėte mastelį",
  "CooperativeGesturesHandler.MobileHelpText": "Žemėlapį stumkite dviem pirštais",
};

const PIN_IMAGE: Record<ViewStatus, string> = {
  new: "pin-new",
  ok: "pin-red",
  urgent: "pin-red",
  work: "pin-work",
  fixed: "pin-fixed",
};

/** Problems this user has already answered; their status no longer asks anything of them. */
const PIN_CHECKED = "pin-checked";

/** Notched pin (square top-right corner) as a MapLibre image. */
function pinImage(fill: string, size: number, border = "#ffffff") {
  const ratio = 2;
  const px = size * ratio;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const stroke = 3 * ratio;
  const r = (size / 2.9) * ratio;
  ctx.beginPath();
  ctx.roundRect(stroke / 2, stroke / 2, px - stroke, px - stroke, [r, 0, r, r]);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = stroke;
  ctx.strokeStyle = border;
  ctx.stroke();
  return { image: ctx.getImageData(0, 0, px, px), ratio };
}

function addPinImages(map: MLMap) {
  const images: [string, string, number, string?][] = [
    ["pin-new", "#7E2324", 26, "rgba(255,255,255,0.9)"],
    ["pin-red", "#ED1C24", 26],
    ["pin-work", "#FFC629", 26],
    ["pin-fixed", "#1C4B1D", 26],
    ["pin-cluster", "#ED1C24", 32],
    [PIN_CHECKED, "#9A9A9A", 26],
  ];
  for (const [name, fill, size, border] of images) {
    if (map.hasImage(name)) continue;
    const { image, ratio } = pinImage(fill, size, border);
    map.addImage(name, image, { pixelRatio: ratio });
  }
}

function tone(score: number): string {
  return score >= 80 ? "hi" : score >= 50 ? "mid" : "lo";
}

function pinsGeoJSON(pins: MapPin[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p.at },
      properties: {
        id: p.id,
        status: p.status,
        score: p.score,
        tone: tone(p.score),
        title: p.title,
        checked: p.checked === true,
      },
    })),
  };
}

function districtsGeoJSON(districts: District[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: districts.map((d) => ({ type: "Feature", geometry: d.boundary, properties: { name: d.name } })),
  };
}

function labelsGeoJSON(labels: MapLabel[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: labels.map((l) => ({ type: "Feature", geometry: { type: "Point", coordinates: l.at }, properties: { text: l.text } })),
  };
}

function markGeoJSON(mark?: LngLat): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: mark ? [{ type: "Feature", geometry: { type: "Point", coordinates: mark }, properties: {} }] : [],
  };
}

function prefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** The base styles label places in English ("New Town"); show the Lithuanian names instead. */
function applyLithuanianLabels(map: MLMap) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== "symbol") continue;
    const field = map.getLayoutProperty(layer.id, "text-field");
    if (JSON.stringify(field ?? "").includes("name_en")) {
      map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name:lt"], ["get", "name"]]);
    }
  }
}

/** Sources and layers on top of the base style (re-added after every style change). */
function install(map: MLMap, props: VilniusMapProps) {
  applyLithuanianLabels(map);
  addPinImages(map);
  const pick = Boolean(props.onPick);

  map.addSource("districts", { type: "geojson", data: districtsGeoJSON(props.districts ?? []) });
  map.addLayer({ id: "district-line", type: "line", source: "districts", paint: { "line-color": "#414454", "line-opacity": 0.35, "line-width": 1.5, "line-dasharray": [3, 2] } });

  map.addSource("problems", {
    type: "geojson",
    data: pinsGeoJSON(props.pins ?? []),
    cluster: !props.hotspots && props.cluster !== false,
    clusterRadius: 36,
    clusterMaxZoom: 15,
  });

  if (props.hotspots) {
    const color: maplibregl.ExpressionSpecification = ["match", ["get", "tone"], "hi", "#ED1C24", "mid", "#F09F86", "#B1B7C9"];
    map.addLayer({ id: "spot-halo", type: "circle", source: "problems", paint: { "circle-color": color, "circle-opacity": 0.3, "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 8, 100, 30] } });
    map.addLayer({ id: "spot-core", type: "circle", source: "problems", paint: { "circle-color": color, "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 4, 100, 12], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
  } else {
    map.addLayer({
      id: "pulse",
      type: "circle",
      source: "problems",
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "status"], "new"], ["!", ["get", "checked"]]],
      paint: { "circle-color": "#ED1C24", "circle-radius": 14, "circle-opacity": 0.3 },
      layout: { visibility: pick ? "none" : "visible" },
    });
    map.addLayer({
      id: "clusters",
      type: "symbol",
      source: "problems",
      filter: ["has", "point_count"],
      layout: { "icon-image": "pin-cluster", "icon-allow-overlap": true, "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 13, "text-allow-overlap": true },
      paint: { "text-color": "#ffffff", "icon-opacity": pick ? 0.45 : 1, "text-opacity": pick ? 0.6 : 1 },
    });
    map.addLayer({
      id: "pins",
      type: "symbol",
      source: "problems",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": [
          "case",
          ["get", "checked"],
          PIN_CHECKED,
          ["match", ["get", "status"], "new", PIN_IMAGE.new, "work", PIN_IMAGE.work, "fixed", PIN_IMAGE.fixed, PIN_IMAGE.ok],
        ],
        "icon-allow-overlap": true,
        "text-field": ["case", ["all", ["==", ["get", "status"], "new"], ["!", ["get", "checked"]]], "?", ""],
        "text-font": FONT,
        "text-size": 12,
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff", "icon-opacity": pick ? 0.45 : 1 },
    });
  }

  map.addSource("labels", { type: "geojson", data: labelsGeoJSON(props.labels ?? []) });
  map.addLayer({
    id: "labels",
    type: "symbol",
    source: "labels",
    layout: { "text-field": ["get", "text"], "text-font": FONT, "text-size": 12, "text-offset": [0, -2.2], "text-allow-overlap": true },
    paint: { "text-color": "#3C3C3C", "text-halo-color": "#ffffff", "text-halo-width": 6 },
  });

  map.addSource("mark", { type: "geojson", data: markGeoJSON(props.mark) });
  map.addLayer({ id: "mark-ring", type: "circle", source: "mark", paint: { "circle-radius": 16, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ED1C24", "circle-stroke-width": 3 } });
  map.addLayer({ id: "mark-dot", type: "circle", source: "mark", paint: { "circle-radius": 5, "circle-color": "#ED1C24" } });
}

export default function VilniusMap(props: VilniusMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const p = latest.current;
    const map = new maplibregl.Map({
      container: container.current,
      style: prefersDark() ? STYLE.dark : STYLE.light,
      center: p.center ?? VILNIUS_CENTER,
      zoom: p.zoom ?? 11.5,
      attributionControl: { compact: true },
      cooperativeGestures: !p.still,
      interactive: !p.still,
      locale: LOCALE,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();

    if (!p.still) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    if (p.onLocate) {
      const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showUserLocation: true });
      geo.on("geolocate", (e: GeolocationPosition) => latest.current.onLocate?.([e.coords.longitude, e.coords.latitude]));
      map.addControl(geo, "top-right");
    }

    map.on("style.load", () => {
      install(map, latest.current);
      ready.current = true;
    });

    // The compact OpenStreetMap credit opens itself once the tiles' attribution arrives.
    // Collapse it to its "ⓘ" button the first time that happens; tapping ⓘ still shows it.
    const attrib = container.current.querySelector(".maplibregl-ctrl-attrib");
    const collapseOnce = new MutationObserver(() => {
      if (attrib?.classList.contains("maplibregl-compact-show")) {
        attrib.classList.remove("maplibregl-compact-show");
        collapseOnce.disconnect();
      }
    });
    if (attrib) collapseOnce.observe(attrib, { attributes: true, attributeFilter: ["class"] });

    map.once("load", () => {
      const cur = latest.current;
      if ((cur.fit ?? !cur.center) && cur.pins?.length) {
        const bounds = new maplibregl.LngLatBounds();
        for (const pin of cur.pins) bounds.extend(pin.at);
        map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });
      }
    });

    // Interactions (layers may not exist in every mode; MapLibre ignores unknown ids).
    const openFeature = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (id && !latest.current.onPick) latest.current.onOpen?.(String(id));
    };
    for (const layer of ["pins", "spot-core", "spot-halo"]) {
      map.on("click", layer, openFeature);
      map.on("mouseenter", layer, () => !latest.current.onPick && (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("click", "clusters", async (e) => {
      if (latest.current.onPick) return;
      const feature = e.features?.[0];
      const source = map.getSource("problems") as GeoJSONSource | undefined;
      if (!feature || !source) return;
      const zoom = await source.getClusterExpansionZoom(Number(feature.properties?.cluster_id));
      map.easeTo({ center: (feature.geometry as Point).coordinates as LngLat, zoom });
    });
    map.on("click", (e) => latest.current.onPick?.([e.lngLat.lng, e.lngLat.lat]));
    if (p.onPick) map.getCanvas().style.cursor = "crosshair";

    // Gentle pulse on unconfirmed pins (static when the user prefers reduced motion).
    let frame = 0;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const animate = (t: number) => {
      if (ready.current && map.getLayer("pulse")) {
        const phase = (t % 1600) / 1600;
        map.setPaintProperty("pulse", "circle-radius", 10 + phase * 14);
        map.setPaintProperty("pulse", "circle-opacity", 0.45 * (1 - phase));
      }
      frame = requestAnimationFrame(animate);
    };
    if (!reduced) frame = requestAnimationFrame(animate);

    // Follow the system theme.
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onTheme = () => {
      ready.current = false;
      map.setStyle(media.matches ? STYLE.dark : STYLE.light);
    };
    media?.addEventListener("change", onTheme);

    return () => {
      cancelAnimationFrame(frame);
      media?.removeEventListener("change", onTheme);
      collapseOnce.disconnect();
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
  }, []);

  // Push data changes into the existing sources.
  const { pins, districts, labels, mark } = props;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("problems") as GeoJSONSource | undefined)?.setData(pinsGeoJSON(pins ?? []));
    (map.getSource("districts") as GeoJSONSource | undefined)?.setData(districtsGeoJSON(districts ?? []));
    (map.getSource("labels") as GeoJSONSource | undefined)?.setData(labelsGeoJSON(labels ?? []));
    (map.getSource("mark") as GeoJSONSource | undefined)?.setData(markGeoJSON(mark));
  }, [pins, districts, labels, mark]);

  // Recentre when asked (e.g. "use my location" in the report flow).
  const { center } = props;
  useEffect(() => {
    if (center && mapRef.current && ready.current) mapRef.current.easeTo({ center, zoom: Math.max(mapRef.current.getZoom(), 15) });
  }, [center]);

  return <div ref={container} className="vmap" style={{ height: props.height }} role="region" aria-label={props.label} />;
}
