import { useEffect, useRef, useState } from 'react';
import type { MapLocation, MapLocationType } from '../types/map';

interface Props {
  location: MapLocation | null;
  pickedCoordinates: { latitude: number; longitude: number } | null;
  picking: boolean;
  onPick: () => void;
  onCancelPick: () => void;
  onSave: (location: MapLocation) => Promise<void>;
}

interface LocationForm {
  name: string;
  type: MapLocationType;
  district: string;
  address: string;
  latitude: string;
  longitude: string;
}

function formFromLocation(location: MapLocation | null): LocationForm {
  return {
    name: location?.name ?? '', type: location?.type ?? 'market',
    district: location?.district ?? '', address: location?.address ?? '',
    latitude: location ? String(location.latitude) : '', longitude: location ? String(location.longitude) : '',
  };
}

export function MapLocationEditor({ location, pickedCoordinates, picking, onPick, onCancelPick, onSave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(() => formFromLocation(location));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const previousLocationId = useRef(location?.location_id ?? null);
  const savedLocationId = useRef<string | null>(null);

  useEffect(() => {
    const nextId = location?.location_id ?? null;
    setAdding(false);
    setForm(formFromLocation(location));
    if (nextId !== savedLocationId.current) { setError(''); setMessage(''); }
    if (nextId !== previousLocationId.current) {
      setExpanded(false);
      previousLocationId.current = nextId;
    }
  }, [location]);

  useEffect(() => {
    if (picking || pickedCoordinates) setExpanded(true);
    if (pickedCoordinates) {
      setForm((current) => ({ ...current, latitude: pickedCoordinates.latitude.toFixed(6), longitude: pickedCoordinates.longitude.toFixed(6) }));
      setMessage('已帶入地圖座標，儲存後生效。');
    }
  }, [picking, pickedCoordinates]);

  const valid = form.name.trim().length > 0 && form.district.trim().length > 0 && form.address.trim().length > 0
    && form.latitude.trim() !== '' && form.longitude.trim() !== '' && Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude))
    && Number(form.latitude) >= 21.5 && Number(form.latitude) <= 26.5 && Number(form.longitude) >= 118 && Number(form.longitude) <= 123;

  function updateField<Key extends keyof LocationForm>(key: Key, value: LocationForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(''); setMessage('');
  }

  const startAdding = () => {
    setExpanded(true); setAdding(true); setForm(formFromLocation(null));
    savedLocationId.current = null;
    setError(''); setMessage(''); onCancelPick();
  };

  const cancelEditing = () => {
    setAdding(false); setForm(formFromLocation(location)); setExpanded(false);
    savedLocationId.current = null;
    setError(''); setMessage(''); onCancelPick();
  };

  return (
    <section className="panel map-settings-panel map-location-settings">
      <details className="map-location-settings__details" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="map-location-settings__summary">
          <span className="map-location-settings__summary-copy">
            <span className="map-location-settings__eyebrow">場域資料</span>
            <strong className="map-location-settings__name">{adding ? form.name.trim() || '新增場域' : location?.name ?? '尚未選擇場域'}</strong>
            <span className="map-location-settings__meta">{adding ? '填寫新場域的名稱、地址與座標' : location ? [location.district, location.address].filter(Boolean).join(' · ') : '選擇一個場域，或展開新增場域'}</span>
          </span>
          <span className="map-location-settings__toggle">{expanded ? '收合設定' : '編輯場域資料'}</span>
        </summary>

        <div className="map-location-settings__content">
          <h2 className="map-location-settings__title">{adding ? '新增市場／夜市場域' : '場域基本資料'}</h2>
          <p className="map-data-notice">請使用現場確認的 WGS84 座標。修改場域座標不會改動機台的獨立位置。</p>
          <form className="map-settings-form" onSubmit={async (event) => {
            event.preventDefault(); if (!valid || saving) return;
            setSaving(true); setError(''); setMessage('');
            const savedLocation: MapLocation = {
              location_id: adding || !location ? `LOC-${crypto.randomUUID()}` : location.location_id,
              name: form.name.trim(), type: form.type, district: form.district.trim(), address: form.address.trim(),
              latitude: Number(form.latitude), longitude: Number(form.longitude), coordinate_source: 'manual',
            };
            try {
              await onSave(savedLocation);
              savedLocationId.current = savedLocation.location_id;
              setAdding(false); setExpanded(false); setMessage('場域已儲存。'); onCancelPick();
            } catch (err) {
              setExpanded(true);
              setError(err instanceof Error ? err.message : '無法儲存場域。');
            } finally { setSaving(false); }
          }}>
            <label>場域名稱<input required maxLength={120} value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="例如：第一果菜批發市場" disabled={saving} /></label>
            <label>類型<select value={form.type} onChange={(event) => updateField('type', event.target.value as MapLocationType)} disabled={saving}><option value="market">菜市場／果菜市場</option><option value="night_market">夜市</option><option value="alley">巷道</option><option value="other">其他</option></select></label>
            <label>行政區<input required maxLength={30} value={form.district} onChange={(event) => updateField('district', event.target.value)} placeholder="例如：萬華區" disabled={saving} /></label>
            <label>地址<input required maxLength={250} value={form.address} onChange={(event) => updateField('address', event.target.value)} disabled={saving} /></label>
            <label>緯度 Latitude<input required type="number" step="any" min="21.5" max="26.5" value={form.latitude} onChange={(event) => updateField('latitude', event.target.value)} disabled={saving} /></label>
            <label>經度 Longitude<input required type="number" step="any" min="118" max="123" value={form.longitude} onChange={(event) => updateField('longitude', event.target.value)} disabled={saving} /></label>
            <div className="map-settings-actions">
              <button type="submit" disabled={!valid || saving}>{saving ? '儲存中…' : '儲存場域'}</button>
              <button type="button" disabled={saving} onClick={() => { setExpanded(true); if (picking) onCancelPick(); else onPick(); }}>{picking ? '取消座標選取' : '從地圖選取經緯度'}</button>
              <button type="button" disabled={saving} onClick={startAdding}>新增場域</button>
              <button type="button" disabled={saving} onClick={cancelEditing}>{adding ? '取消新增' : '取消編輯'}</button>
            </div>
          </form>
        </div>
      </details>
      {message && <p className="is-success map-location-settings__feedback" role="status">{message}</p>}
      {error && <p className="map-action-error map-location-settings__feedback" role="alert">{error}</p>}
    </section>
  );
}
