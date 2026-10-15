import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TaipeiDeviceMap, type TaipeiLocationMetric } from '../components/TaipeiDeviceMap';
import { MapLocationEditor } from '../components/MapLocationEditor';
import { MarketPlacementEditor } from '../components/MarketPlacementEditor';
import { getMapState, MAP_DATA_MODE, saveDevicePlacement, saveFloorPlan, saveMapLocation } from '../services/mapService';
import { useAppUser } from '../hooks/useAppUser';
import type { DevicePlacementInput, MapLocation, MapState, MarketFloorPlan } from '../types/map';
import { RiskBadge } from '../components/RiskBadge';
import { MethodologyBar } from '../components/MethodologyBar';
import { getDevices, getLocations } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatChange, formatDateTime, locationTypeLabel } from '../utils/format';
import type { DeviceHealth, RiskLevel } from '../types';
import '../styles/locations.css';

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** Reuse unchanged records so a GPS poll does not reset an administrator's draft. */
function reconcileMapState(previous: MapState | null, next: MapState): MapState {
  if (!previous) return next;
  const reuse = <T,>(before: T[], after: T[], key: (item: T) => string): T[] => {
    const saved = new Map(before.map((item) => [key(item), item]));
    const stable = after.map((item) => {
      const old = saved.get(key(item));
      return old && JSON.stringify(old) === JSON.stringify(item) ? old : item;
    });
    return stable.length === before.length && stable.every((item, index) => item === before[index]) ? before : stable;
  };
  const locations = reuse(previous.locations, next.locations, (item) => item.location_id);
  const floor_plans = reuse(previous.floor_plans, next.floor_plans, (item) => item.floor_plan_id);
  const placements = reuse(previous.placements, next.placements, (item) => item.device_id);
  return locations === previous.locations && floor_plans === previous.floor_plans && placements === previous.placements
    ? previous : { locations, floor_plans, placements };
}


/** Treat a stale heartbeat as offline so the map reflects real data availability. */
function effectiveStatus(device: DeviceHealth): DeviceHealth['status'] {
  if (device.heartbeat_stale) return 'offline';
  if (device.camera_health !== 'normal') return 'warning';
  return device.status;
}

export function LocationsPage() {
  const { data: locations, loading: locationsLoading } = useAsyncData(() => getLocations(), []);
  const { data: devices, loading: devicesLoading } = useAsyncData(() => getDevices(), []);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [mapState, setMapState] = useState<MapState | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [workspace, setWorkspace] = useState<'map' | 'placement'>('map');
  const mapArea = useRef<HTMLDivElement>(null);
  const [coordinatePicking, setCoordinatePicking] = useState(false);
  const [pickedCoordinates, setPickedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const { role } = useAppUser();
  const canEdit = role !== 'viewer';

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await getMapState();
        if (!cancelled) { setMapState((old) => reconcileMapState(old, next)); setMapError(null); }
      } catch (error) {
        if (!cancelled) setMapError(error instanceof Error ? error.message : '無法載入地圖設定。');
      }
      if (!cancelled && MAP_DATA_MODE === 'api') timer = setTimeout(() => { void load(); }, 15000);
    };
    void load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [reload]);
  const refreshMap = useCallback(async () => { const next = await getMapState(); setMapState((old) => reconcileMapState(old, next)); }, []);
  const saveLocation = async (location: MapLocation) => {
    await saveMapLocation(location); await refreshMap(); setSelectedLocationId(location.location_id);
  };
  const savePlan = async (plan: MarketFloorPlan) => { await saveFloorPlan(plan); await refreshMap(); };
  const savePlacement = async (placement: DevicePlacementInput) => { await saveDevicePlacement(placement); await refreshMap(); };


  const ranked = useMemo(
    () =>
      [...(locations ?? [])].map((location) => ({ ...location, ...mapState?.locations.find((site) => site.location_id === location.location_id) })).sort(
        (a, b) =>
          RISK_ORDER[a.risk.level] - RISK_ORDER[b.risk.level] ||
          b.events_per_100_hours - a.events_per_100_hours,
      ),
    [locations, mapState?.locations],
  );

  const mapDevices = useMemo(
    () => (devices ?? []).map((d) => ({ ...d, location_id: mapState?.placements.find((p) => p.device_id === d.device_id)?.location_id ?? d.location_id, status: effectiveStatus(d) })),
    [devices, mapState?.placements],
  );

  const deploymentDevices = useMemo(() => [
    ...mapDevices.map(({ device_id, location_id }) => ({ device_id, location_id })),
    ...(mapState?.placements ?? []).filter((placement) => !mapDevices.some((device) => device.device_id === placement.device_id))
      .map(({ device_id, location_id }) => ({ device_id, location_id })),
  ], [mapDevices, mapState?.placements]);

  const metrics = useMemo(
    () =>
      Object.fromEntries(
        ranked.map((loc) => [
          loc.location_id,
          { risk_level: loc.risk.level, events_per_100_hours: loc.events_per_100_hours },
        ]),
      ) as Record<string, TaipeiLocationMetric>,
    [ranked],
  );

  const activeLocationId = selectedLocationId ?? mapState?.floor_plans[0]?.location_id ?? ranked[0]?.location_id ?? mapState?.locations[0]?.location_id ?? null;
  const selectedMapLocation = mapState?.locations.find((location) => location.location_id === activeLocationId) ?? null;
  const mapLocations = useMemo(() => {
    const ids = new Map(ranked.map((location, index) => [location.location_id, index]));
    return [...(mapState?.locations ?? [])].sort((a, b) => (ids.get(a.location_id) ?? 999) - (ids.get(b.location_id) ?? 999));
  }, [ranked, mapState?.locations]);
  const effectiveCount = devices?.filter((device) => device.effective_monitoring).length ?? 0;
  const highRiskCount = ranked.filter((loc) => loc.risk.level === 'high').length;

  const selectedPlans = mapState?.floor_plans.filter((plan) => plan.location_id === activeLocationId) ?? [];
  const selectedDevices = deploymentDevices.filter((device) => device.location_id === activeLocationId);
  const selectedMetric = ranked.find((location) => location.location_id === activeLocationId);
  const selectLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    setCoordinatePicking(false);
    setPickedCoordinates(null);
  };
  const activateWorkspace = (next: 'map' | 'placement', focus = false) => {
    setWorkspace(next);
    if (next === 'placement') setCoordinatePicking(false);
    if (focus) document.getElementById(`workspace-tab-${next}`)?.focus();
  };
  const locationGroups = [...new Set(mapLocations.map((location) => location.district))].sort();

  return (
    <div className="locations-workspace">
      <header className="page-header locations-workspace__heading">
        <div>
          <span className="locations-workspace__eyebrow">場域管理</span>
          <h1>台北市地圖與機台部署</h1>
          <p>選擇場域，在場地圖上標記與管理機台位置。</p>
        </div>
        <span className="locations-workspace__storage">
          <i aria-hidden="true" />
          {MAP_DATA_MODE === 'api' ? '地圖設定同步儲存' : '設定儲存於此瀏覽器'}
        </span>
      </header>

      {mapError && <div className="map-load-error" role="alert">{mapError} <button type="button" onClick={() => setReload((value) => value + 1)}>重新載入</button></div>}

      {locationsLoading || devicesLoading || !locations || !devices ? (
        <div className="loading">載入場域…</div>
      ) : (
        <>
          <div className="locations-workspace__navigation">
            <div className="locations-workspace__tabs" role="tablist" aria-label="地圖工作區" onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 'map' : event.key === 'End' ? 'placement' : workspace === 'map' ? 'placement' : 'map';
              activateWorkspace(next, true);
            }}>
              <button id="workspace-tab-map" type="button" role="tab" aria-selected={workspace === 'map'} aria-controls="workspace-map" tabIndex={workspace === 'map' ? 0 : -1} onClick={() => activateWorkspace('map')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" /><path d="M9 3v16m6-14v16" /></svg>
                台北市地圖
              </button>
              <button id="workspace-tab-placement" type="button" role="tab" aria-selected={workspace === 'placement'} aria-controls="workspace-placement" tabIndex={workspace === 'placement' ? 0 : -1} onClick={() => activateWorkspace('placement')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 11h8v9m0-9V4m0 10h8" /><circle cx="16" cy="8" r="1.5" /></svg>
                場地圖與機台
              </button>
            </div>
            <div className="locations-workspace__context">
              <label htmlFor="workspace-location">目前場域</label>
              <div className="locations-workspace__site-select">
                <select id="workspace-location" value={activeLocationId ?? ''} disabled={!mapState} onChange={(event) => selectLocation(event.target.value)}>
                  {!mapState && <option value="">載入中…</option>}
                  {locationGroups.map((district) => <optgroup key={district} label={district || '其他'}>
                    {mapLocations.filter((location) => location.district === district).map((location) => <option key={location.location_id} value={location.location_id}>{location.name}</option>)}
                  </optgroup>)}
                </select>
              </div>
              <span className="locations-workspace__site-address" title={selectedMapLocation?.address}>{selectedMapLocation?.address}</span>
              <span className="locations-workspace__site-counts"><span>{selectedPlans.length} 張場地圖</span><span>{selectedDevices.length} 台機台</span></span>
            </div>
          </div>

          <section id="workspace-map" role="tabpanel" aria-labelledby="workspace-tab-map" hidden={workspace !== 'map'} className="locations-workspace__panel">
            <div className="locations-overview" ref={mapArea}>
              <div className="locations-overview__map panel">
                {!mapState ? <div className="loading">載入地圖設定…</div> : <TaipeiDeviceMap
                  locations={mapLocations} devices={mapDevices} metrics={metrics} placements={mapState.placements}
                  coordinatePicking={coordinatePicking}
                  onCoordinatePick={(latitude, longitude) => { setPickedCoordinates({ latitude, longitude }); setCoordinatePicking(false); }}
                  selectedLocationId={activeLocationId}
                  onLocationSelect={(location) => selectLocation(location.location_id)}
                />}
              </div>
              <aside className="locations-site-card panel" aria-label="選取場域摘要">
                <div className="locations-site-card__heading"><span className="locations-workspace__eyebrow">已選取場域</span><span className="locations-site-card__type">{selectedMapLocation ? locationTypeLabel(selectedMapLocation.type) : '選擇場域'}</span></div>
                <h2>{selectedMapLocation?.name ?? '尚未選擇場域'}</h2>
                <p className="locations-site-card__address">{selectedMapLocation?.address ?? '從地圖或搜尋結果選擇一個場域。'}</p>
                <div className="locations-site-card__numbers">
                  <div><strong>{selectedPlans.length}</strong><span>場地圖</span></div>
                  <div><strong>{selectedDevices.length}</strong><span>機台</span></div>
                </div>
                <button type="button" className="locations-primary-button" disabled={!selectedMapLocation} onClick={() => activateWorkspace('placement', true)}>前往場地圖擺設 <span aria-hidden="true">→</span></button>
                <p className="locations-site-card__hint">{selectedPlans.length ? '選擇機台後，點選圖面即可標記位置。' : canEdit ? '此場域尚未上傳場地圖，可於擺設工作區新增。' : '此場域尚未上傳場地圖。'}</p>
                <div className="locations-site-card__monitoring">
                  <h3>監測狀態 <span>示範資料</span></h3>
                  {selectedMetric ? <>
                    <div className="locations-site-card__risk"><span>場域風險</span><RiskBadge risk={selectedMetric.risk} showInfo={false} /></div>
                    <div className="locations-site-card__risk"><span>每 100 監測小時事件</span><strong>{selectedMetric.events_per_100_hours}</strong></div>
                  </> : <p>尚無此場域的監測統計。</p>}
                </div>
                <div className="locations-site-card__guide"><span>操作流程</span><ol><li>搜尋或選擇場域</li><li>開啟場地圖與機台</li><li>標記位置並儲存</li></ol></div>
              </aside>
            </div>
          </section>

          <section id="workspace-placement" role="tabpanel" aria-labelledby="workspace-tab-placement" hidden={workspace !== 'placement'} className="locations-workspace__panel">
            {mapState ? <MarketPlacementEditor
              location={selectedMapLocation} floorPlans={mapState.floor_plans} placements={mapState.placements}
              devices={deploymentDevices} canEdit={canEdit} onSaveFloorPlan={savePlan} onSavePlacement={savePlacement}
            /> : <div className="loading">載入場地圖設定…</div>}
          </section>

          {mapState && canEdit && <MapLocationEditor
            location={selectedMapLocation} pickedCoordinates={pickedCoordinates} picking={coordinatePicking}
            onPick={() => {
              setWorkspace('map'); setPickedCoordinates(null); setCoordinatePicking(true);
              requestAnimationFrame(() => mapArea.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
            }}
            onCancelPick={() => { setCoordinatePicking(false); setPickedCoordinates(null); }} onSave={saveLocation}
          />}

          <details className="locations-monitoring panel">
            <summary><span>監測摘要與統計</span><small>{locations.length} 個監測場域 · {highRiskCount} 個高風險 · {effectiveCount}/{devices.length} 台有效監測</small><span className="locations-disclosure-chevron" aria-hidden="true">⌄</span></summary>
            <div className="locations-monitoring__body">
              <MethodologyBar />
              <div className="location-grid">
                {ranked.map((loc) => (
                  <article key={loc.location_id} className="location-card">
                    <div className="location-card__head"><div><h3>{loc.name}</h3><div className="location-card__type">{loc.district} · {locationTypeLabel(loc.type)}</div></div><RiskBadge risk={loc.risk} /></div>
                    <div className="stat-list">
                      <div className="stat-row"><span>每 100 監測小時事件（近 7 日）</span><b>{loc.events_per_100_hours}</b></div>
                      <div className="stat-row"><span>較前 7 日</span><span>{formatChange(loc.trend_change_percentage)}</span></div>
                      <div className="stat-row"><span>獨立活動事件（近 7 日）</span><span>{loc.detection_event_count} 次</span></div>
                      <div className="stat-row"><span>有效監測時數（近 7 日）</span><span>{loc.monitoring_hours} h</span></div>
                      <div className="stat-row"><span>活動高峰時段</span><span>{loc.peak_hour}</span></div>
                      <div className="stat-row"><span>設備數量</span><span>{loc.device_count} 台</span></div>
                      <div className="stat-row"><span>最近活動</span><span>{formatDateTime(loc.latest_detection)}</span></div>
                    </div>
                    <button type="button" className="text-button" onClick={() => { selectLocation(loc.location_id); setWorkspace('map'); mapArea.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}>在地圖中查看 →</button>
                  </article>
                ))}
              </div>
            </div>
          </details>
          <details className="locations-data-note">
            <summary>資料與儲存說明</summary>
            <p>{MAP_DATA_MODE === 'api' ? '地圖設定儲存於後端；感測器回報每 15 秒更新。監測統計仍為示範資料。' : '地圖設定僅儲存於此瀏覽器；目前使用示範監測資料，尚未連接真實定位感測器。'} 市場與夜市的公開參考座標請於現場核對。</p>
          </details>
        </>
      )}
    </div>
  );
}
