import { useEffect, useState } from 'react';
import type { MapLocation, MapLocationType } from '../types/map';

interface Props {
  location: MapLocation | null;
  pickedCoordinates: { latitude: number; longitude: number } | null;
  picking: boolean;
  onPick: () => void;
  onCancelPick: () => void;
  onSave: (location: MapLocation) => Promise<void>;
}
export function MapLocationEditor({ location, pickedCoordinates, picking, onPick, onCancelPick, onSave }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<MapLocationType>('market');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    setAdding(false); setName(location?.name ?? ''); setType(location?.type ?? 'market');
    setDistrict(location?.district ?? ''); setAddress(location?.address ?? '');
    setLatitude(location ? String(location.latitude) : ''); setLongitude(location ? String(location.longitude) : '');
    setError(''); setMessage('');
  }, [location]);
  useEffect(() => { if (pickedCoordinates) { setLatitude(pickedCoordinates.latitude.toFixed(6)); setLongitude(pickedCoordinates.longitude.toFixed(6)); setMessage('已帶入地圖座標，儲存後生效。'); } }, [pickedCoordinates]);
  const valid = name.trim().length > 0 && district.trim().length > 0 && address.trim().length > 0
    && latitude.trim() !== '' && longitude.trim() !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    && Number(latitude) >= 21.5 && Number(latitude) <= 26.5 && Number(longitude) >= 118 && Number(longitude) <= 123;
  const startAdding = () => { setAdding(true); setName(''); setType('market'); setDistrict(''); setAddress(''); setLatitude(''); setLongitude(''); setError(''); setMessage(''); onCancelPick(); };
  return <section className="panel map-settings-panel"><h2>{adding ? '新增市場／夜市場域' : '場域名稱與經緯度設定'}</h2><p className="map-data-notice">請使用現場確認的 WGS84 座標。修改場域座標不會改動機台的獨立位置。</p>
    <form className="map-settings-form" onSubmit={async (event) => {
      event.preventDefault(); if (!valid || saving) return;
      setSaving(true); setError(''); setMessage('');
      try {
        await onSave({ location_id: adding || !location ? `LOC-${crypto.randomUUID()}` : location.location_id,
          name: name.trim(), type, district: district.trim(), address: address.trim(), latitude: Number(latitude), longitude: Number(longitude), coordinate_source: 'manual' });
        setAdding(false); setMessage('場域已儲存。'); onCancelPick();
      } catch (err) { setError(err instanceof Error ? err.message : '無法儲存場域。'); }
      finally { setSaving(false); }
    }}>
      <label>場域名稱<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：第一果菜批發市場" disabled={saving} /></label>
      <label>類型<select value={type} onChange={(event) => setType(event.target.value as MapLocationType)} disabled={saving}><option value="market">菜市場／果菜市場</option><option value="night_market">夜市</option><option value="alley">巷道</option><option value="other">其他</option></select></label>
      <label>行政區<input required maxLength={30} value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="例如：萬華區" disabled={saving} /></label>
      <label>地址<input required maxLength={250} value={address} onChange={(event) => setAddress(event.target.value)} disabled={saving} /></label>
      <label>緯度 Latitude<input required type="number" step="any" min="21.5" max="26.5" value={latitude} onChange={(event) => setLatitude(event.target.value)} disabled={saving} /></label>
      <label>經度 Longitude<input required type="number" step="any" min="118" max="123" value={longitude} onChange={(event) => setLongitude(event.target.value)} disabled={saving} /></label>
      <div className="map-settings-actions"><button type="submit" disabled={!valid || saving}>{saving ? '儲存中…' : '儲存場域'}</button><button type="button" disabled={saving} onClick={picking ? onCancelPick : onPick}>{picking ? '取消座標選取' : '從地圖選取經緯度'}</button><button type="button" disabled={saving} onClick={startAdding}>新增場域</button><span className="is-success" role="status">{message}</span></div>
    </form>{error && <p className="map-action-error" role="alert">{error}</p>}
  </section>;
}
