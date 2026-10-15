import { useEffect, useId, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/taipei-map.css';
import type { DevicePlacement, MapLocation } from '../types/map';

export type TaipeiDeviceStatus = 'online' | 'warning' | 'offline';
export type TaipeiMapLocation = MapLocation;
export interface TaipeiMapDevice {
  device_id: string;
  location_id: string;
  status: TaipeiDeviceStatus;
  battery?: number;
  network?: string;
  signal_strength?: number;
}
export type TaipeiRiskLevel = 'low' | 'medium' | 'high';
export interface TaipeiLocationMetric { risk_level: TaipeiRiskLevel; events_per_100_hours: number }
export interface TaipeiDeviceMapProps {
  locations: readonly MapLocation[];
  devices: readonly TaipeiMapDevice[];
  placements?: readonly DevicePlacement[];
  metrics?: Readonly<Record<string, TaipeiLocationMetric>>;
  selectedLocationId?: string | null;
  onLocationSelect?: (location: MapLocation) => void;
  coordinatePicking?: boolean;
  onCoordinatePick?: (latitude: number, longitude: number) => void;
  className?: string;
  title?: string;
}

type LayerKey = 'markets' | 'nightMarkets' | 'other' | 'risk' | 'devices' | 'sensors';
const LAYERS: { key: LayerKey; label: string; color: string }[] = [
  { key: 'markets', label: '菜市場／果菜市場', color: '#157d73' },
  { key: 'nightMarkets', label: '夜市', color: '#825ab8' },
  { key: 'other', label: '其他場域', color: '#667a87' },
  { key: 'devices', label: '機台設定位置', color: '#173c52' },
  { key: 'sensors', label: '感測器回報', color: '#2987d0' },
  { key: 'risk', label: '監測風險', color: '#d37a42' },
];
const CATEGORY_LAYERS = LAYERS.slice(0, 3);
const OVERLAY_LAYERS = LAYERS.slice(3);
const COLORS: Record<TaipeiRiskLevel, string> = { low: '#5b9f93', medium: '#d99a00', high: '#c73e35' };
const TAIPEI_BOUNDS: L.LatLngBoundsExpression = [[24.96, 121.45], [25.21, 121.665]];
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = import.meta.env.VITE_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function validCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
function tooltip(text: string): HTMLElement {
  const element = document.createElement('span');
  element.textContent = text;
  return element;
}
function sourceLabel(location: MapLocation): string {
  return location.coordinate_source === 'demo' ? '示範座標' : location.coordinate_source === 'reference' ? '公開參考座標・請現場核對' : '人工設定座標';
}

export function TaipeiDeviceMap({ locations, devices, placements = [], metrics, selectedLocationId, onLocationSelect,
  coordinatePicking = false, onCoordinatePick, className, title = '台北市市場與機台地圖' }: TaipeiDeviceMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const groups = useRef<Record<LayerKey, L.LayerGroup> | null>(null);
  const callbacks = useRef({ onLocationSelect, onCoordinatePick, coordinatePicking });
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ markets: true, nightMarkets: true, other: true, risk: true, devices: true, sensors: true });
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('all');
  const [showLayers, setShowLayers] = useState(false);
  const layerPanelId = useId();
  const [resultCount, setResultCount] = useState(12);
  const [tileError, setTileError] = useState(false);
  const [timeNow, setTimeNow] = useState(Date.now);
  const [uncontrolledId, setUncontrolledId] = useState<string | null>(locations[0]?.location_id ?? null);
  const activeId = selectedLocationId === undefined ? uncontrolledId : selectedLocationId;
  const districts = useMemo(() => [...new Set(locations.map((location) => location.district).filter(Boolean))].sort(), [locations]);
  const visible = useMemo(() => locations.filter((location) => (district === 'all' || district === location.district)
    && layers[location.type === 'market' ? 'markets' : location.type === 'night_market' ? 'nightMarkets' : 'other']
    && `${location.name} ${location.address} ${location.location_id}`.toLowerCase().includes(query.trim().toLowerCase())), [locations, query, district, layers]);
  const selected = locations.find((location) => location.location_id === activeId);
  const visibleIds = useMemo(() => new Set(visible.map((location) => location.location_id)), [visible]);

  useEffect(() => { const timer = window.setInterval(() => setTimeNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { callbacks.current = { onLocationSelect, onCoordinatePick, coordinatePicking }; }, [onLocationSelect, onCoordinatePick, coordinatePicking]);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false, minZoom: 3, maxZoom: 19 }).fitBounds(TAIPEI_BOUNDS);
    map.current = instance;
    groups.current = Object.fromEntries(LAYERS.map(({ key }) => [key, L.layerGroup().addTo(instance)])) as Record<LayerKey, L.LayerGroup>;
    const tileLayer = L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 });
    tileLayer.on('tileerror', () => setTileError(true));
    tileLayer.addTo(instance);
    tiles.current = tileLayer;
    L.control.scale({ imperial: false }).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (callbacks.current.coordinatePicking) callbacks.current.onCoordinatePick?.(event.latlng.lat, event.latlng.lng);
    });
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(container.current);
    return () => { resize.disconnect(); instance.remove(); map.current = null; groups.current = null; tiles.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const layerGroups = groups.current;
    if (!instance || !layerGroups) return;
    for (const { key } of LAYERS) {
      layerGroups[key].clearLayers();
      if (layers[key]) instance.addLayer(layerGroups[key]);
      else instance.removeLayer(layerGroups[key]);
    }
    const select = (location: MapLocation) => { setUncontrolledId(location.location_id); callbacks.current.onLocationSelect?.(location); };
    for (const location of visible) {
      if (!validCoordinates(location.latitude, location.longitude)) continue;
      const key: LayerKey = location.type === 'market' ? 'markets' : location.type === 'night_market' ? 'nightMarkets' : 'other';
      const color = LAYERS.find((layer) => layer.key === key)!.color;
      const symbol = location.type === 'market' ? '市' : location.type === 'night_market' ? '夜' : '場';
      const label = `${location.name} · ${location.district} · ${sourceLabel(location)}`;
      const marker = L.marker([location.latitude, location.longitude], {
        icon: L.divIcon({ className: 'taipei-map-pin', html: `<span style="background:${color}" class="${location.location_id === activeId ? 'is-selected' : ''}">${symbol}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
        title: label, alt: label, keyboard: true,
      }).bindTooltip(tooltip(label)).on('click', (event: L.LeafletMouseEvent) => { if (callbacks.current.coordinatePicking) callbacks.current.onCoordinatePick?.(event.latlng.lat, event.latlng.lng); else select(location); }).addTo(layerGroups[key]);
      marker.getElement()?.setAttribute('aria-label', label);
      const metric = metrics?.[location.location_id];
      if (metric) L.circleMarker([location.latitude, location.longitude], {
        radius: 18 + Math.max(0, Math.min(100, metric.events_per_100_hours)) * 0.4,
        color: COLORS[metric.risk_level], weight: 1, fillOpacity: 0.17, interactive: false,
      }).addTo(layerGroups.risk);
    }
    for (const placement of placements) {
      if (!visibleIds.has(placement.location_id)) continue;
      const device = devices.find((item) => item.device_id === placement.device_id);
      const status = device?.status ?? 'unknown';
      const location = locations.find((item) => item.location_id === placement.location_id);
      const selectDevice = () => { if (location && !callbacks.current.coordinatePicking) select(location); };
      if (validCoordinates(placement.latitude, placement.longitude)) {
        const marker = L.marker([placement.latitude, placement.longitude!], {
          icon: L.divIcon({ className: 'taipei-map-device', html: `<span class="is-${status}">▣</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
          title: `${placement.device_id} 設定位置${status === 'unknown' ? '・尚無健康資料' : ''}`, alt: `${placement.device_id} 設定位置`, keyboard: true, zIndexOffset: 500,
        }).bindTooltip(tooltip(`${placement.device_id} · 設定位置 ${placement.latitude.toFixed(6)}, ${placement.longitude!.toFixed(6)}`))
          .on('click', (event: L.LeafletMouseEvent) => { if (callbacks.current.coordinatePicking) callbacks.current.onCoordinatePick?.(event.latlng.lat, event.latlng.lng); else selectDevice(); }).addTo(layerGroups.devices);
        marker.getElement()?.setAttribute('aria-label', `${placement.device_id} 設定位置`);
      }
      const sensor = placement.sensor_position;
      if (sensor && validCoordinates(sensor.latitude, sensor.longitude)) {
        const age = timeNow - new Date(sensor.observed_at).getTime();
        const stale = !Number.isFinite(age) || age > 5 * 60 * 1000;
        const marker = L.marker([sensor.latitude, sensor.longitude], {
          icon: L.divIcon({ className: 'taipei-map-sensor', html: `<span class="${stale ? 'is-stale' : ''}">◎</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
          title: `${placement.device_id} 感測器${stale ? '・舊回報' : ''}`, keyboard: true, zIndexOffset: 600,
        }).bindTooltip(tooltip(`${placement.device_id} · 感測器回報${stale ? '（超過 5 分鐘）' : ''} · ${sensor.observed_at} · 精度 ${sensor.accuracy_m ?? '未知'} m`))
          .on('click', (event: L.LeafletMouseEvent) => { if (callbacks.current.coordinatePicking) callbacks.current.onCoordinatePick?.(event.latlng.lat, event.latlng.lng); else selectDevice(); }).addTo(layerGroups.sensors);
        marker.getElement()?.setAttribute('aria-label', `${placement.device_id} 感測器回報`);
        if (sensor.accuracy_m !== null && sensor.accuracy_m > 0) L.circle([sensor.latitude, sensor.longitude], {
          radius: sensor.accuracy_m, color: '#2987d0', weight: 1, dashArray: '4 4', fillOpacity: 0.08, interactive: false,
        }).addTo(layerGroups.sensors);
      }
    }
  }, [locations, devices, placements, visible, visibleIds, layers, metrics, activeId, timeNow]);

  const selectedId = selected?.location_id;
  const selectedLatitude = selected?.latitude;
  const selectedLongitude = selected?.longitude;
  const selectionKey = `${selectedId}:${selectedLatitude}:${selectedLongitude}`;
  const previousSelection = useRef(selectionKey);
  useEffect(() => {
    if (selectionKey === previousSelection.current) return;
    previousSelection.current = selectionKey;
    if (validCoordinates(selectedLatitude, selectedLongitude)) map.current?.setView([selectedLatitude, selectedLongitude!], 16);
  }, [selectionKey, selectedLatitude, selectedLongitude]);

  const selectFromList = (location: MapLocation) => { setUncontrolledId(location.location_id); onLocationSelect?.(location); };
  return (
    <section className={`taipei-device-map taipei-street-map ${className ?? ''}`} aria-label={title}>
      <header className="taipei-device-map__header">
        <div><h2 className="taipei-device-map__title">{title}</h2><p className="taipei-device-map__subtitle">搜尋市場或夜市，選擇場域查看機台與定位。</p></div>
        <span className="taipei-device-map__count">{locations.length} 個場域</span>
      </header>
      <div className="taipei-map-controls">
        <div className="taipei-map-toolbar">
          <label className="taipei-map-search">
            <span>搜尋場域</span>
            <span className="taipei-map-search__field">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
              <input type="search" placeholder="輸入市場、夜市名稱或地址" value={query} onChange={(event) => { setQuery(event.target.value); setResultCount(12); }} />
            </span>
          </label>
          <label className="taipei-map-district"><span>行政區</span><select value={district} onChange={(event) => { setDistrict(event.target.value); setResultCount(12); }}><option value="all">全台北市</option>{districts.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="taipei-map-reset" type="button" onClick={() => map.current?.fitBounds(TAIPEI_BOUNDS)}>
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.2 6.3M4 4v6h6" /></svg>
            台北市全景
          </button>
        </div>
        <div className="taipei-map-filter-row">
          <fieldset className="taipei-map-categories">
            <legend>分類篩選</legend>
            {CATEGORY_LAYERS.map((layer) => <label key={layer.key} className={layers[layer.key] ? 'is-active' : ''}>
              <input type="checkbox" checked={layers[layer.key]} onChange={(event) => { setLayers((current) => ({ ...current, [layer.key]: event.target.checked })); setResultCount(12); }} />
              <i style={{ background: layer.color }} aria-hidden="true" />{layer.label}
            </label>)}
          </fieldset>
          <button className={`taipei-map-layer-toggle${showLayers ? ' is-active' : ''}`} type="button" aria-expanded={showLayers} aria-controls={layerPanelId} onClick={() => setShowLayers((current) => !current)}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5" /></svg>
            圖層<span className="taipei-map-layer-toggle__count" aria-hidden="true">{OVERLAY_LAYERS.filter((layer) => layers[layer.key]).length}</span>
          </button>
        </div>
        <fieldset id={layerPanelId} className="taipei-map-layers" hidden={!showLayers}>
          <legend>顯示圖層</legend>
          {OVERLAY_LAYERS.map((layer) => <label key={layer.key}><input type="checkbox" checked={layers[layer.key]} onChange={(event) => setLayers((current) => ({ ...current, [layer.key]: event.target.checked }))} /><i style={{ background: layer.color }} aria-hidden="true" />{layer.label}</label>)}
        </fieldset>
      </div>
      {coordinatePicking && <p className="taipei-map-notice" role="status">座標選取中：請點選街道地圖，將座標帶入場域設定。</p>}
      {tileError && <p className="taipei-map-notice is-error" role="status">部分街道圖磚載入失敗。場域座標與下方列表仍可使用。<button type="button" onClick={() => { setTileError(false); tiles.current?.redraw(); }}>重試底圖</button></p>}
      <div ref={container} className={`taipei-map-surface${coordinatePicking ? ' is-picking' : ''}`} role="region" aria-label="台北市互動街道地圖，可用方向鍵移動、加減鍵縮放" />
      <div className="taipei-map-legend">
        <div className="taipei-map-legend__items"><span><b className="taipei-map-legend__market">市</b> 市場</span><span><b className="taipei-map-legend__night">夜</b> 夜市</span><span><b className="taipei-map-legend__device">▣</b> 機台</span><span><b className="taipei-map-legend__sensor">◎</b> 感測器</span></div>
        <details className="taipei-map-legend__details"><summary>圖例說明</summary><div><p>機台狀態：<i className="is-online" />正常 <i className="is-warning" />留意 <i className="is-offline" />離線 <i className="is-unknown" />尚無健康資料</p><p>感測器灰色表示回報超過 5 分鐘。</p><p>風險圈：綠低／黃中／紅高；大小表示事件率，非影響範圍。</p><p>「場」標記表示其他場域。</p></div></details>
      </div>
      <div className="taipei-map-results"><div className="taipei-map-results__head"><strong>場域列表 <span className="taipei-map-results__total">{visible.length}</span></strong><span>符合條件 {visible.length} 個 · 顯示 {Math.min(resultCount, visible.length)} 個</span></div><div className="taipei-map-results__grid">{visible.slice(0, resultCount).map((location) => <button key={location.location_id} type="button" className={activeId === location.location_id ? 'is-selected' : ''} aria-pressed={activeId === location.location_id} onClick={() => selectFromList(location)}><strong>{location.name}</strong><small>{location.district} · {location.type === 'night_market' ? '夜市' : location.type === 'market' ? '市場' : '場域'} · {sourceLabel(location)}</small></button>)}</div>{visible.length > resultCount && <button type="button" className="taipei-map-more" onClick={() => setResultCount((count) => count + 12)}>顯示更多場域</button>}{visible.length === 0 && <p className="taipei-map-results__empty">沒有符合條件的場域，請調整搜尋、行政區或分類。</p>}</div>
      {selected && <div className="taipei-map-selected"><div><strong>{selected.name}</strong><p>{selected.address}</p><small>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)} · {sourceLabel(selected)}</small></div>{selected.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer">查看資料來源 ↗</a>}</div>}
    </section>
  );
}
