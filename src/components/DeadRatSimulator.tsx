import { useState } from 'react';
import { LOCATIONS } from '../data/mock/locations';
import { simulateDeadRatNotification } from '../services/dataService';
import type { DeadRatNotification } from '../types';

export function DeadRatSimulator() {
  const [locationId, setLocationId] = useState(LOCATIONS[0].location_id);
  const [notification, setNotification] = useState<DeadRatNotification | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSimulation() {
    setIsSending(true);
    setNotification(null);
    try {
      const sent = await simulateDeadRatNotification(locationId);
      setNotification(sent);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="dead-rat-simulator" aria-labelledby="dead-rat-title">
      <div className="dead-rat-simulator__visual" aria-hidden>
        <div className="dead-rat-simulator__visual-head">
          <span className="vision-status-dot" />
          <span>VISION AI · MORTALITY CHECK</span>
        </div>
        <div className="dead-rat-simulator__frame">
          <img src="/mock/rat-003.svg" alt="" />
          <span className="dead-rat-simulator__bbox" />
          <span className="dead-rat-simulator__bbox-label">DEAD RAT · 98%</span>
          <span className="dead-rat-simulator__scanline" />
        </div>
        <p>影像與辨識框為前端情境模擬</p>
      </div>

      <div className="dead-rat-simulator__control">
        <div className="eyebrow eyebrow--critical">Priority workflow</div>
        <h2 id="dead-rat-title">死鼠辨識與通知演練</h2>
        <p>
          模擬 AI 在監控畫面中判別死鼠，並自動建立一封包含辨識結果、時間與地點的通知信。
        </p>

        <div className="simulator-form">
          <label htmlFor="dead-rat-location">模擬偵測地點</label>
          <div className="simulator-form__row">
            <select
              id="dead-rat-location"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              disabled={isSending}
            >
              {LOCATIONS.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.name} · {location.district}
                </option>
              ))}
            </select>
            <button
              className="button button--critical"
              type="button"
              onClick={() => void handleSimulation()}
              disabled={isSending}
            >
              {isSending ? '正在建立通知…' : '模擬辨識並寄送'}
            </button>
          </div>
        </div>

        <div className="simulation-note">
          <span>ⓘ</span>
          <span>這是前端原型：不會實際寄送 Email，也不會觸發外部服務。</span>
        </div>

        <div className="notification-result" aria-live="polite">
          {notification ? (
            <div className="notification-email">
              <div className="notification-email__status">
                <span className="notification-email__check">✓</span>
                <span>通知信已模擬寄送</span>
                <time>剛剛</time>
              </div>
              <div className="notification-email__meta">
                <div>
                  <span>收件者</span>
                  <strong>{notification.recipient}</strong>
                </div>
                <div>
                  <span>主旨</span>
                  <strong>{notification.subject}</strong>
                </div>
              </div>
              <div className="notification-email__body">{notification.body}</div>
            </div>
          ) : (
            <div className="notification-result__empty">
              通知信預覽會在模擬辨識完成後顯示於這裡。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
