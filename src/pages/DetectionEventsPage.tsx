import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDetectionEvents, getLocationName, submitEventReview } from '../services/dataService';
import { LOCATIONS } from '../data/mock/locations';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAppUser } from '../hooks/useAppUser';
import { Panel } from '../components/Panel';
import { InfoTip } from '../components/InfoTip';
import { MethodologyBar } from '../components/MethodologyBar';
import {
  formatConfidence,
  formatDateTime,
  formatDuration,
  reviewStatusLabel,
} from '../utils/format';
import type { DetectionEvent, ReviewStatus } from '../types';

/** URL filter values: a single status, or 'human' for any human decision. */
type ReviewFilter = 'all' | 'pending' | 'human' | 'confirmed' | 'false_positive';

const REVIEW_FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待人工複核' },
  { value: 'human', label: '已人工複核' },
  { value: 'confirmed', label: '人工確認' },
  { value: 'false_positive', label: '人工判定誤報' },
];

const MAX_ROWS = 120;

const isHumanReviewed = (e: DetectionEvent) => e.review_status !== 'pending';

function matchesReview(e: DetectionEvent, filter: ReviewFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'human') return isHumanReviewed(e);
  return e.review_status === filter;
}

/** Events excluded from metrics: merged re-entries and review-rejected detections. */
function isExcluded(event: DetectionEvent): boolean {
  return !event.is_independent || event.review_status === 'false_positive';
}

function ReviewCell({ event }: { event: DetectionEvent }) {
  if (!isHumanReviewed(event)) {
    return <span className="review-tag review-tag--pending">AI 偵測 · 待複核</span>;
  }
  return (
    <span className="review-cell">
      <span className={`review-tag review-tag--${event.review_status}`}>
        <span aria-hidden>{event.review_status === 'confirmed' ? '✓' : '✕'}</span>
        {reviewStatusLabel(event.review_status)}
      </span>
      <small>{event.reviewed_by}</small>
    </span>
  );
}

export function DetectionEventsPage() {
  const { username, role } = useAppUser();
  const canReview = role !== 'viewer';
  const [searchParams, setSearchParams] = useSearchParams();
  const eventParam = searchParams.get('event');
  const reviewParam = searchParams.get('review');
  const reviewFilter: ReviewFilter = REVIEW_FILTERS.some((f) => f.value === reviewParam)
    ? (reviewParam as ReviewFilter)
    : 'all';

  const [locationId, setLocationId] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0);
  const [independentOnly, setIndependentOnly] = useState(false);

  const { data, loading } = useAsyncData(() => getDetectionEvents(), []);
  /** Review results saved this session, layered over the loaded list. */
  const [updates, setUpdates] = useState<Record<string, DetectionEvent>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const events = useMemo(() => (data ?? []).map((e) => updates[e.event_id] ?? e), [data, updates]);

  const scoped = useMemo(
    () =>
      events
        .filter((e) => locationId === 'all' || e.location_id === locationId)
        .filter((e) => e.mean_confidence >= minConfidence)
        .filter((e) => !independentOnly || e.is_independent),
    [events, locationId, minConfidence, independentOnly],
  );

  const counts = useMemo(() => {
    const human = scoped.filter(isHumanReviewed);
    return {
      all: scoped.length,
      pending: scoped.length - human.length,
      human: human.length,
      confirmed: human.filter((e) => e.review_status === 'confirmed').length,
      false_positive: human.filter((e) => e.review_status === 'false_positive').length,
    } satisfies Record<ReviewFilter, number>;
  }, [scoped]);

  const rows = useMemo(() => {
    const filtered = scoped.filter((e) => matchesReview(e, reviewFilter)).slice(0, MAX_ROWS);
    if (!eventParam || filtered.some((e) => e.event_id === eventParam)) return filtered;
    const deepLinked = events.find((e) => e.event_id === eventParam);
    return deepLinked ? [deepLinked, ...filtered] : filtered;
  }, [scoped, events, reviewFilter, eventParam]);

  useEffect(() => {
    if (eventParam && rows.some((e) => e.event_id === eventParam)) {
      setSelectedId(eventParam);
    }
  }, [eventParam, rows]);

  const active =
    rows.find((e) => e.event_id === selectedId) ??
    events.find((e) => e.event_id === selectedId) ??
    rows[0] ??
    null;

  const setReviewFilter = (value: ReviewFilter) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('review');
    else next.set('review', value);
    next.delete('event');
    setSearchParams(next, { replace: true });
  };

  const review = useCallback(
    async (decision: ReviewStatus) => {
      if (!active || !canReview || saving) return;
      setSaving(true);
      setSaveError(null);
      // Pick the next row now: the reviewed row may leave the filtered list.
      const index = rows.findIndex((e) => e.event_id === active.event_id);
      const nextRow = rows.slice(index + 1).find((e) => e.review_status === 'pending');
      try {
        const updated = await submitEventReview(active.event_id, decision, username);
        setUpdates((prev) => ({ ...prev, [updated.event_id]: updated }));
        if (decision !== 'pending' && nextRow) setSelectedId(nextRow.event_id);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : '複核儲存失敗');
      } finally {
        setSaving(false);
      }
    },
    [active, canReview, saving, rows, username],
  );

  // Keyboard review: Y = confirm, N = false positive (ignored while typing in a field).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || event.metaKey || event.ctrlKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'y') void review('confirmed');
      if (key === 'n') void review('false_positive');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [review]);

  const reviewRate = counts.all ? Math.round((counts.human / counts.all) * 100) : 0;

  return (
    <div>
      <header className="page-header">
        <h1>
          偵測事件
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          每一列是一次去重後的活動事件（一條追蹤軌跡）。檢視影像後以人工複核確認或排除，誤報不列入任何統計。
        </p>
      </header>

      <MethodologyBar />

      <div className="review-summary" role="group" aria-label="依複核狀態篩選">
        {REVIEW_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`review-summary__chip review-summary__chip--${f.value}${reviewFilter === f.value ? ' is-active' : ''}`}
            aria-pressed={reviewFilter === f.value}
            onClick={() => setReviewFilter(f.value)}
          >
            <span>{f.label}</span>
            <strong>{counts[f.value]}</strong>
          </button>
        ))}
        <span className="review-summary__rate">
          人工複核率 <b>{reviewRate}%</b>
        </span>
      </div>

      <div className="filters">
        <div className="filter-field">
          <label htmlFor="ev-loc">場域</label>
          <select id="ev-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="all">全部場域</option>
            {LOCATIONS.map((loc) => (
              <option key={loc.location_id} value={loc.location_id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="ev-conf">最低信心分數</label>
          <select id="ev-conf" value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))}>
            <option value={0}>不限</option>
            <option value={0.6}>≥ 60%</option>
            <option value={0.7}>≥ 70%</option>
            <option value={0.8}>≥ 80%</option>
            <option value={0.9}>≥ 90%</option>
          </select>
        </div>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={independentOnly}
            onChange={(e) => setIndependentOnly(e.target.checked)}
          />
          只看獨立事件
        </label>
      </div>

      <div className="events-layout">
        <Panel
          title="活動事件清單"
          subtitle={`顯示 ${rows.length} 筆${rows.length >= MAX_ROWS ? `（最多 ${MAX_ROWS} 筆）` : ''}`}
        >
          {loading || !data ? (
            <div className="loading">載入事件…</div>
          ) : rows.length === 0 ? (
            <div className="empty-preview">沒有符合條件的事件</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>複核</th>
                    <th>開始時間</th>
                    <th>場域</th>
                    <th>影像</th>
                    <th>持續時間</th>
                    <th>
                      平均信心
                      <InfoTip label="信心分數說明">
                        模型對每個框的信心分數平均值，<b>不等於準確率</b>。準確率需以人工複核計算 Precision／Recall。
                      </InfoTip>
                    </th>
                    <th>
                      同時最大偵測數
                      <InfoTip label="同時最大偵測數說明">
                        單一畫面中同時出現的最多框數，只能解讀為「至少 N 隻」的下限，不代表場域老鼠總數。
                      </InfoTip>
                    </th>
                    <th>
                      Tracking ID
                      <InfoTip label="Tracking ID 說明">
                        同一條 ByteTrack 軌跡的編號。軌跡在去重間隔 T 內再次出現時會併入同一事件，標示為「併入」。
                      </InfoTip>
                    </th>
                    <th>事件 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((event) => {
                    const classes = [
                      'data-table__row',
                      isExcluded(event) ? 'is-excluded' : '',
                      isHumanReviewed(event) ? 'is-human-reviewed' : '',
                      active?.event_id === event.event_id ? 'is-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <tr key={event.event_id} onClick={() => setSelectedId(event.event_id)} className={classes}>
                        <td>
                          <ReviewCell event={event} />
                        </td>
                        <td>{formatDateTime(event.event_start)}</td>
                        <td>{getLocationName(event.location_id)}</td>
                        <td>
                          <img className="thumb" src={event.image_url} alt={`偵測影像 ${event.event_id}`} />
                        </td>
                        <td>{formatDuration(event.duration_sec)}</td>
                        <td>{formatConfidence(event.mean_confidence)}</td>
                        <td>≥ {event.max_simultaneous_count}</td>
                        <td className="mono">
                          {event.tracking_id}
                          {!event.is_independent ? <span className="tag-merged">併入</span> : null}
                        </td>
                        <td className="mono">{event.event_id}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <aside className="panel preview-panel">
          <h3>影像預覽 · 人工複核</h3>
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

              <section className={`review-box review-box--${active.review_status}`} aria-live="polite">
                <div className="review-box__status">
                  {isHumanReviewed(active) ? (
                    <>
                      <span className={`review-tag review-tag--${active.review_status}`}>
                        <span aria-hidden>{active.review_status === 'confirmed' ? '✓' : '✕'}</span>
                        {reviewStatusLabel(active.review_status)}
                      </span>
                      <small>
                        {active.reviewed_by} · {formatDateTime(active.reviewed_at)}
                      </small>
                    </>
                  ) : (
                    <>
                      <span className="review-tag review-tag--pending">AI 偵測 · 待複核</span>
                      <small>尚未經人工確認，暫計入統計</small>
                    </>
                  )}
                </div>

                <div className="review-box__actions">
                  <button
                    type="button"
                    className="review-button review-button--confirm"
                    disabled={!canReview || saving || active.review_status === 'confirmed'}
                    onClick={() => void review('confirmed')}
                  >
                    ✓ 確認是鼠隻 <kbd>Y</kbd>
                  </button>
                  <button
                    type="button"
                    className="review-button review-button--reject"
                    disabled={!canReview || saving || active.review_status === 'false_positive'}
                    onClick={() => void review('false_positive')}
                  >
                    ✕ 標記為誤報 <kbd>N</kbd>
                  </button>
                </div>
                {isHumanReviewed(active) && canReview ? (
                  <button
                    type="button"
                    className="text-button review-box__undo"
                    disabled={saving}
                    onClick={() => void review('pending')}
                  >
                    撤銷複核，改回待複核
                  </button>
                ) : null}
                {!canReview ? <p className="review-box__note">目前帳號為唯讀，無法進行複核。</p> : null}
                {saveError ? <p className="review-box__error">{saveError}</p> : null}
              </section>

              {isExcluded(active) ? (
                <p className="preview-excluded">
                  {active.review_status === 'false_positive'
                    ? '已人工判定為誤報，不列入任何統計。'
                    : `此軌跡在 ${active.independence_interval_sec / 60} 分鐘內再次出現，已併入前一事件，不重複計數。`}
                </p>
              ) : null}

              <div className="preview-meta">
                <div>
                  <span>時間</span>
                  <span>
                    {formatDateTime(active.event_start)}（{formatDuration(active.duration_sec)}）
                  </span>
                </div>
                <div>
                  <span>場域 · 設備</span>
                  <span>
                    {getLocationName(active.location_id)} · <span className="mono">{active.device_id}</span>
                  </span>
                </div>
                <div>
                  <span>平均信心</span>
                  <span>{formatConfidence(active.mean_confidence)}</span>
                </div>
                <div>
                  <span>同時最大偵測數</span>
                  <span>至少 {active.max_simultaneous_count} 隻（下限）</span>
                </div>
                <div>
                  <span>Tracking ID</span>
                  <span className="mono">{active.tracking_id}</span>
                </div>
                <div>
                  <span>事件 ID</span>
                  <span className="mono">{active.event_id}</span>
                </div>
                <div>
                  <span>模型版本</span>
                  <span className="mono">{active.model_version}</span>
                </div>
              </div>
              <p className="note">示意紅外線影像為 Prototype mock，非正式相機畫面。</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
