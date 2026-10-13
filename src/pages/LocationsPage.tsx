import { useCallback, useEffect, useMemo, useState } from 'react';
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

  return (
    <div>
      <header className="page-header">
        <h1>
          台北市地圖與機台部署
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          查看菜市場、果菜市場與夜市，設定場域經緯度、平面圖擺設與機台定位；監測風險仍以近 7 日每 100 監測小時活動事件數計算。
        </p>
      </header>

      <MethodologyBar />
      <p className="map-data-notice">{MAP_DATA_MODE === 'api' ? '地圖設定儲存於後端；感測器回報每 15 秒更新。監測統計仍為 Demo Data。' : '示範模式：地圖設定只儲存在此瀏覽器；尚未連接真實定位感測器。'} 市場與夜市參考座標請於部署前現場核對。</p>
      {mapError && <div className="map-load-error" role="alert">{mapError} <button type="button" onClick={() => setReload((value) => value + 1)}>重新載入</button></div>}

      {locationsLoading || devicesLoading || !locations || !devices ? (
        <div className="loading">載入場域…</div>
      ) : (
        <div className="locations-dashboard">
          <div className="locations-dashboard__map panel">
            {!mapState ? <div className="loading">載入地圖設定…</div> : <TaipeiDeviceMap
              locations={mapLocations}
              devices={mapDevices}
              metrics={metrics}
              placements={mapState?.placements ?? []}
              coordinatePicking={coordinatePicking}
              onCoordinatePick={(latitude, longitude) => { setPickedCoordinates({ latitude, longitude }); setCoordinatePicking(false); }}
              selectedLocationId={activeLocationId}
              onLocationSelect={(location) => { setSelectedLocationId(location.location_id); setCoordinatePicking(false); setPickedCoordinates(null); }}
            />}
          </div>

          <aside className="panel deployment-summary">
            <div className="deployment-summary__head">
              <div>
                <div className="eyebrow">Priority</div>
                <h2>優先處理順序</h2>
              </div>
            </div>
            <div className="deployment-summary__metrics">
              <div>
                <strong>{locations.length}</strong>
                <span>監測場域</span>
              </div>
              <div>
                <strong className={highRiskCount ? 'is-alert' : ''}>{highRiskCount}</strong>
                <span>高風險場域</span>
              </div>
              <div>
                <strong>
                  {effectiveCount}/{devices.length}
                </strong>
                <span>有效監測設備</span>
              </div>
            </div>
            <div className="deployment-list" role="list" aria-label="場域風險排序">
              {ranked.map((loc, index) => {
                const selected = loc.location_id === activeLocationId;
                return (
                  <button
                    key={loc.location_id}
                    type="button"
                    className={`deployment-list__item${selected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedLocationId(loc.location_id)}
                    role="listitem"
                  >
                    <span className="deployment-list__rank">{index + 1}</span>
                    <span className="deployment-list__copy">
                      <strong>{loc.name}</strong>
                      <small>
                        {loc.district} · 每 100h {loc.events_per_100_hours} · 趨勢{' '}
                        {formatChange(loc.trend_change_percentage)}
                      </small>
                    </span>
                    <RiskBadge risk={loc.risk} showInfo={false} />
                  </button>
                );
              })}
            </div>
          </aside>

          {mapState && canEdit && <MapLocationEditor
            location={selectedMapLocation} pickedCoordinates={pickedCoordinates} picking={coordinatePicking}
            onPick={() => { setPickedCoordinates(null); setCoordinatePicking(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onCancelPick={() => { setCoordinatePicking(false); setPickedCoordinates(null); }} onSave={saveLocation}
          />}
          {mapState && <div className="map-placement-panel"><MarketPlacementEditor
            location={selectedMapLocation} floorPlans={mapState.floor_plans} placements={mapState.placements}
            devices={deploymentDevices} canEdit={canEdit} onSaveFloorPlan={savePlan} onSavePlacement={savePlacement}
          /></div>}
          <div className="location-grid locations-dashboard__cards">
            {ranked.map((loc) => (
              <article key={loc.location_id} className="panel location-card">
                <div className="location-card__head">
                  <div>
                    <h3>{loc.name}</h3>
                    <div className="location-card__type">
                      {loc.district} · {locationTypeLabel(loc.type)} · {loc.location_id}
                    </div>
                  </div>
                  <RiskBadge risk={loc.risk} />
                </div>
                <div className="stat-list">
                  <div className="stat-row">
                    <span>每 100 監測小時事件（近 7 日）</span>
                    <span>
                      <b>{loc.events_per_100_hours}</b>
                    </span>
                  </div>
                  <div className="stat-row">
                    <span>較前 7 日</span>
                    <span
                      className={
                        (loc.trend_change_percentage ?? 0) >= 10
                          ? 'is-up'
                          : (loc.trend_change_percentage ?? 0) <= -10
                            ? 'is-down'
                            : ''
                      }
                    >
                      {formatChange(loc.trend_change_percentage)}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span>獨立活動事件（近 7 日）</span>
                    <span>{loc.detection_event_count} 次</span>
                  </div>
                  <div className="stat-row">
                    <span>有效監測時數（近 7 日）</span>
                    <span>{loc.monitoring_hours} h</span>
                  </div>
                  <div className="stat-row">
                    <span>活動高峰時段</span>
                    <span>{loc.peak_hour}</span>
                  </div>
                  <div className="stat-row">
                    <span>設備數量</span>
                    <span>{loc.device_count} 台</span>
                  </div>
                  <div className="stat-row">
                    <span>最近活動</span>
                    <span>{formatDateTime(loc.latest_detection)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setSelectedLocationId(loc.location_id)}
                >
                  地圖定位
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
