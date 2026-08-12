import { Link } from 'react-router-dom';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDetectionEvents, getLocationName } from '../services/dataService';
import { formatDateTime } from '../utils/format';
import { Panel } from './Panel';

export function RecentEventsStrip() {
  const { data, loading } = useAsyncData(
    () => getDetectionEvents({ limit: 8 }),
    [],
  );

  return (
    <Panel
      title="最近活動"
      subtitle="最近 Detection Events 縮圖"
      action={
        <Link to="/events" className="panel-link">
          查看全部
        </Link>
      }
    >
      {loading || !data ? (
        <div className="loading">載入最近活動…</div>
      ) : (
        <div className="recent-strip">
          {data.map((event) => (
            <Link
              key={event.event_id}
              to={`/events?event=${encodeURIComponent(event.event_id)}`}
              className="recent-card"
            >
              <div className="recent-card__thumb">
                <img src={event.image_url} alt="" />
                {event.bounding_boxes?.[0] ? (
                  <span
                    className="recent-card__bbox"
                    style={{
                      left: `${event.bounding_boxes[0].x * 100}%`,
                      top: `${event.bounding_boxes[0].y * 100}%`,
                      width: `${event.bounding_boxes[0].w * 100}%`,
                      height: `${event.bounding_boxes[0].h * 100}%`,
                    }}
                  />
                ) : null}
              </div>
              <div className="recent-card__meta">
                <strong>{getLocationName(event.location_id)}</strong>
                <span>{formatDateTime(event.captured_at)}</span>
                <span className="mono">{event.event_id}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
