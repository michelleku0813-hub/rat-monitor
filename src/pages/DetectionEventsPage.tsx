import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDetectionEvents, getLocationName } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { Panel } from '../components/Panel';
import {
  formatConfidence,
  formatDateTime,
  reviewStatusLabel,
} from '../utils/format';
import type { DetectionEvent } from '../types';

export function DetectionEventsPage() {
  const [searchParams] = useSearchParams();
  const eventParam = searchParams.get('event');
  const reviewParam = searchParams.get('review');

  const { data, loading } = useAsyncData(() => getDetectionEvents({ limit: 80 }), []);
  const [selected, setSelected] = useState<DetectionEvent | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (reviewParam === 'pending') {
      return data.filter((e) => e.review_status === 'pending');
    }
    return data;
  }, [data, reviewParam]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (!eventParam) return filtered;
    const deepLinked = data.find((e) => e.event_id === eventParam);
    if (deepLinked && !filtered.some((e) => e.event_id === eventParam)) {
      return [deepLinked, ...filtered];
    }
    return filtered;
  }, [data, filtered, eventParam]);

  useEffect(() => {
    if (!rows.length) {
      setSelected(null);
      return;
    }
    if (eventParam) {
      const match = rows.find((e) => e.event_id === eventParam);
      if (match) {
        setSelected(match);
        return;
      }
    }
    setSelected((prev) => {
      if (prev && rows.some((e) => e.event_id === prev.event_id)) return prev;
      return rows[0];
    });
  }, [rows, eventParam]);

  const active = selected ?? rows[0] ?? null;

  return (
    <div>
      <header className="page-header">
        <h1>
          Detection Events
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          最近 AI 偵測結果。Detected Count 為該次影像中偵測到的鼠隻數量，非場域老鼠總數。
          {reviewParam === 'pending' ? '（目前篩選：待審核）' : null}
        </p>
      </header>

      <div className="events-layout">
        <Panel title="最近偵測事件" subtitle="來源：Mock JSON → Data Service">
          {loading || !data ? (
            <div className="loading">載入事件…</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Detection Time</th>
                    <th>Location</th>
                    <th>Device</th>
                    <th>AI Result</th>
                    <th>Detected Count</th>
                    <th>Confidence</th>
                    <th>Model</th>
                    <th>Image</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((event) => (
                    <tr
                      key={event.event_id}
                      onClick={() => setSelected(event)}
                      style={{
                        cursor: 'pointer',
                        background:
                          active?.event_id === event.event_id ? '#f0f7f6' : undefined,
                      }}
                    >
                      <td className="mono">{event.event_id}</td>
                      <td>{formatDateTime(event.captured_at)}</td>
                      <td>{getLocationName(event.location_id)}</td>
                      <td className="mono">{event.device_id}</td>
                      <td>
                        <span className="badge badge--detected">
                          {event.rat_detected ? 'Rat detected' : 'No rat'}
                        </span>
                      </td>
                      <td>{event.detected_count}</td>
                      <td>{formatConfidence(event.confidence)}</td>
                      <td className="mono">{event.model_version}</td>
                      <td>
                        <img
                          className="thumb"
                          src={event.image_url}
                          alt={`偵測影像 ${event.event_id}`}
                        />
                      </td>
                      <td>
                        <span className={`badge badge--${event.review_status}`}>
                          {reviewStatusLabel(event.review_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <aside className="panel preview-panel">
          <h3>影像預覽 · Bounding Box</h3>
          {!active ? (
            <div className="empty-preview">選擇一筆事件以預覽</div>
          ) : (
            <>
              <div className="preview-image-wrap">
                <img src={active.image_url} alt={active.event_id} />
                {(active.bounding_boxes ?? []).map((box, i) => (
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
              </div>
              <div className="preview-meta">
                <div>
                  <span>Event ID</span>
                  <span className="mono">{active.event_id}</span>
                </div>
                <div>
                  <span>Detection Time</span>
                  <span>{formatDateTime(active.captured_at)}</span>
                </div>
                <div>
                  <span>Location</span>
                  <span>{getLocationName(active.location_id)}</span>
                </div>
                <div>
                  <span>Detected Count</span>
                  <span>{active.detected_count}</span>
                </div>
                <div>
                  <span>Confidence</span>
                  <span>{formatConfidence(active.confidence)}</span>
                </div>
                <div>
                  <span>Model Version</span>
                  <span className="mono">{active.model_version}</span>
                </div>
              </div>
              <p className="note">
                Confidence ≠ Accuracy。示意紅外線影像為 Prototype mock，非正式相機畫面。
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
