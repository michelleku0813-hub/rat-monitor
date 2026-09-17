import type { BoundingBox, CameraSnapshot } from '../types';
import { getCameraSnapshots, getLocationName } from '../services/dataService';
import { DEMO_NOW } from '../data/mock/devices';
import { cameraHealthLabel, deviceStatusLabel, formatFrameAge } from '../utils/format';
import { usePolling } from '../hooks/usePolling';
import { Panel } from './Panel';

function BBoxOverlay({ boxes }: { boxes: BoundingBox[] }) {
  return (
    <>
      {boxes.map((box, i) => (
        <div
          key={`${box.label}-${i}`}
          className="live-bbox"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
          }}
        >
          <span className="live-bbox__label">
            {box.label} {box.confidence.toFixed(2)}
          </span>
        </div>
      ))}
    </>
  );
}

function CameraTile({ snap }: { snap: CameraSnapshot }) {
  const muted = snap.stream_status !== 'live';
  const locationName = getLocationName(snap.location_id);

  return (
    <article className={`camera-tile${muted ? ' camera-tile--muted' : ''}`}>
      <div className="camera-tile__frame">
        <img src={snap.image_url} alt={`${snap.device_id} 監測畫面`} />
        {snap.activity_detected && snap.bounding_boxes.length > 0 ? (
          <BBoxOverlay boxes={snap.bounding_boxes} />
        ) : null}
        {muted ? (
          <div className="camera-tile__mask">
            <span>
              {snap.stream_status === 'offline'
                ? 'Stream Offline'
                : snap.camera_health !== 'normal'
                  ? `${cameraHealthLabel(snap.camera_health)} · 不計入監測`
                  : 'Degraded'}
            </span>
          </div>
        ) : null}
        <div className="camera-tile__hud">
          <span className={`stream-dot stream-dot--${snap.stream_status}`} />
          <span className="camera-tile__hud-text">
            {snap.stream_status === 'live' ? 'LIVE' : snap.stream_status.toUpperCase()}
          </span>
          {snap.activity_detected ? (
            <span className="camera-tile__detect">Rat activity detected</span>
          ) : null}
        </div>
      </div>
      <div className="camera-tile__meta">
        <div className="camera-tile__title">
          <strong>{locationName}</strong>
          <span className="mono">{snap.device_id}</span>
        </div>
        <div className="camera-tile__sub">
          <span className={`badge badge--${snap.device_status}`}>
            {deviceStatusLabel(snap.device_status)}
          </span>
          <span>Frame {formatFrameAge(snap.captured_at, DEMO_NOW)}</span>
        </div>
      </div>
    </article>
  );
}

const POLL_MS = 6000;

export function LiveMonitor() {
  const { data, loading } = usePolling(() => getCameraSnapshots(), POLL_MS, []);

  return (
    <Panel
      title="即時影像監看"
      subtitle="監測畫面／偵測快照 · 非老鼠個體數"
      action={<span className="live-badge">Simulated Live · Demo Data</span>}
    >
      {loading && !data ? (
        <div className="loading">載入監測畫面…</div>
      ) : (
        <div className="camera-grid">
          {(data ?? []).map((snap) => (
            <CameraTile key={snap.device_id} snap={snap} />
          ))}
        </div>
      )}
      <p className="note">
        Prototype 以輪詢模擬即時快照（約每 {POLL_MS / 1000} 秒更新）。未來可替換為
        snapshot API / MJPEG / WebRTC，UI 無需重寫。
      </p>
    </Panel>
  );
}
