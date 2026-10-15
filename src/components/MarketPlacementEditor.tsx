import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { DevicePlacement, DevicePlacementInput, MapLocation, MarketFloorPlan } from '../types/map';
import '../styles/market-placement.css';

export interface MarketPlacementEditorProps {
  location: MapLocation | null;
  floorPlans: MarketFloorPlan[];
  placements: DevicePlacement[];
  devices: readonly { device_id: string; location_id: string }[];
  canEdit: boolean;
  onSaveFloorPlan: (plan: MarketFloorPlan) => Promise<void>;
  onSavePlacement: (placement: DevicePlacementInput) => Promise<void>;
}

interface PlacementDraft {
  floorPlanId: string;
  latitude: string;
  longitude: string;
  x: string;
  y: string;
  note: string;
}

interface UploadedImage {
  dataUrl: string;
  width: number;
  height: number;
  filename: string;
}

function percentString(value: number): string {
  return String(Number(value.toFixed(6)));
}

function draftFromPlacement(placement: DevicePlacement | undefined): PlacementDraft {
  return {
    floorPlanId: placement?.floor_plan_id ?? '',
    latitude: placement?.latitude?.toString() ?? '',
    longitude: placement?.longitude?.toString() ?? '',
    x: placement?.floor_x !== null && placement?.floor_x !== undefined ? percentString(placement.floor_x * 100) : '',
    y: placement?.floor_y !== null && placement?.floor_y !== undefined ? percentString(placement.floor_y * 100) : '',
    note: placement?.placement_note ?? '',
  };
}

function readImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取圖片，請重新選擇檔案。'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('無法讀取圖片內容。'));
        return;
      }
      const dataUrl = reader.result;
      const image = new Image();
      image.onerror = () => reject(new Error('圖片格式無法辨識，請使用 PNG、JPEG 或 WebP。'));
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 8000 || image.naturalHeight > 8000) {
          reject(new Error('圖片長、寬皆須介於 1 至 8,000 像素。'));
          return;
        }
        resolve({ dataUrl, width: image.naturalWidth, height: image.naturalHeight, filename: file.name });
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '儲存失敗，請稍後再試。';
}

function validNumber(value: string, min: number, max: number): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
}

/** Indoor image positions and geographic coordinates are intentionally separate. */
export function MarketPlacementEditor(props: MarketPlacementEditorProps) {
  if (!props.location) {
    return (
      <section className="market-placement panel">
        <div className="market-placement__empty">選擇地圖上的市場或夜市，即可查看平面圖與機台位置。</div>
      </section>
    );
  }
  return <LocationPlacementEditor key={props.location.location_id} {...props} location={props.location} />;
}

function LocationPlacementEditor({
  location, floorPlans, placements, devices, canEdit, onSaveFloorPlan, onSavePlacement,
}: MarketPlacementEditorProps & { location: MapLocation }) {
  const fieldPrefix = useId();
  const [newDeviceId, setNewDeviceId] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationId, setRegistrationId] = useState('');
  const registrationValid = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(registrationId.trim());
  const registrationDuplicate = devices.some((device) => device.device_id === registrationId.trim())
    || placements.some((placement) => placement.device_id === registrationId.trim());
  const availableDevices = useMemo(() => newDeviceId && !devices.some((device) => device.device_id === newDeviceId)
    ? [...devices, { device_id: newDeviceId, location_id: location.location_id }] : devices,
  [devices, newDeviceId, location.location_id]);
  const locationDevices = useMemo(() => availableDevices.filter((device) => (
    placements.find((placement) => placement.device_id === device.device_id)?.location_id ?? device.location_id
  ) === location.location_id), [availableDevices, placements, location.location_id]);
  const otherDevices = availableDevices.filter((device) => !locationDevices.some((local) => local.device_id === device.device_id));
  const [addedPlans, setAddedPlans] = useState<MarketFloorPlan[]>([]);
  const plans = useMemo(() => [
    ...floorPlans.filter((plan) => plan.location_id === location.location_id),
    ...addedPlans.filter((plan) => !floorPlans.some((saved) => saved.floor_plan_id === plan.floor_plan_id)),
  ], [floorPlans, addedPlans, location.location_id]);
  const [deviceId, setDeviceId] = useState(() => locationDevices[0]?.device_id ?? '');
  const initialPlacement = placements.find((placement) => placement.device_id === deviceId && placement.location_id === location.location_id);
  const [planId, setPlanId] = useState(() => plans.some((plan) => plan.floor_plan_id === initialPlacement?.floor_plan_id)
    ? initialPlacement!.floor_plan_id! : plans[0]?.floor_plan_id ?? '');
  const [draft, setDraft] = useState<PlacementDraft>(() => draftFromPlacement(initialPlacement));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upload, setUpload] = useState<UploadedImage | null>(null);
  const [planName, setPlanName] = useState('');
  const [planSource, setPlanSource] = useState('');
  const [readingImage, setReadingImage] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const [sensorOpen, setSensorOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const imageRequest = useRef(0);
  const alive = useRef(true);
  const busy = saving || savingPlan;
  const selectedPlan = plans.find((plan) => plan.floor_plan_id === planId);
  const selectedPlacement = placements.find((placement) => placement.device_id === deviceId && placement.location_id === location.location_id);
  const sensor = placements.find((placement) => placement.device_id === deviceId)?.sensor_position;
  const isMoving = Boolean(deviceId && !locationDevices.some((device) => device.device_id === deviceId));
  const isNewDevice = Boolean(deviceId && deviceId === newDeviceId && !placements.some((placement) => placement.device_id === deviceId));
  const sensorTime = sensor ? Date.parse(sensor.observed_at) : NaN;
  const sensorStale = !Number.isFinite(sensorTime) || now - sensorTime > 5 * 60 * 1000;
  const coordinateEmpty = draft.latitude.trim() === '' && draft.longitude.trim() === '';
  const coordinateValid = coordinateEmpty || (validNumber(draft.latitude, -90, 90) && validNumber(draft.longitude, -180, 180));
  const pointEmpty = draft.x.trim() === '' && draft.y.trim() === '';
  const pointValid = pointEmpty || (plans.some((plan) => plan.floor_plan_id === draft.floorPlanId) && validNumber(draft.x, 0, 100) && validNumber(draft.y, 0, 100));
  const hasPoint = !pointEmpty && pointValid;
  const visiblePoint = draft.floorPlanId === planId;
  const originalDraft = draftFromPlacement(selectedPlacement);
  const dirty = JSON.stringify(draft) !== JSON.stringify(originalDraft);
  const canSave = canEdit && availableDevices.some((device) => device.device_id === deviceId)
    && coordinateValid && pointValid && dirty && !busy
    && (!coordinateEmpty || hasPoint || Boolean(selectedPlacement));

  useEffect(() => {
    alive.current = true;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { alive.current = false; imageRequest.current += 1; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (deviceId && availableDevices.some((device) => device.device_id === deviceId)) return;
    const nextId = locationDevices[0]?.device_id ?? '';
    setDeviceId(nextId);
    const nextPlacement = placements.find((placement) => placement.device_id === nextId && placement.location_id === location.location_id);
    setDraft(draftFromPlacement(nextPlacement));
    setStatus('');
    setError('');
  }, [deviceId, availableDevices, locationDevices, placements, location.location_id]);

  useEffect(() => {
    setImageFailed(false);
  }, [selectedPlan?.image_url]);

  // Newly fetched plans can appear after the editor first mounts.
  useEffect(() => {
    if (planId && plans.some((plan) => plan.floor_plan_id === planId)) return;
    const nextPlanId = plans[0]?.floor_plan_id ?? '';
    if (nextPlanId === planId) return;
    setPlanId(nextPlanId);
  }, [planId, plans]);

  const updateDraft = (key: keyof PlacementDraft, value: string) => {
    setDraft((current) => {
      if (key === 'x' || key === 'y') {
        return { ...current, floorPlanId: planId, ...(current.floorPlanId !== planId ? { x: '', y: '' } : {}), [key]: value };
      }
      return { ...current, [key]: value };
    });
    setError('');
    setStatus('');
  };

  const selectDevice = (nextId: string) => {
    if (busy) return;
    const saved = placements.find((placement) => placement.device_id === nextId && placement.location_id === location.location_id);
    const nextPlan = plans.some((plan) => plan.floor_plan_id === saved?.floor_plan_id) ? saved!.floor_plan_id! : planId;
    setDeviceId(nextId);
    setPlanId(nextPlan);
    setDraft(draftFromPlacement(saved));
    setError('');
    setStatus('');
  };

  const selectPlan = (nextId: string) => {
    setPlanId(nextId);
    setError('');
    setStatus('');
  };

  const beginNewDevice = () => {
    if (!canEdit || busy || !registrationValid || registrationDuplicate) return;
    const id = registrationId.trim();
    setNewDeviceId(id);
    setDeviceId(id);
    setDraft({ ...draftFromPlacement(undefined), latitude: location.latitude.toString(), longitude: location.longitude.toString() });
    setRegistrationOpen(false);
    setRegistrationId('');
    setError('');
    setStatus('已建立新機台設定草稿；確認位置後按「新增並儲存機台」完成新增。');
  };

  const setPoint = (event: MouseEvent<HTMLButtonElement>) => {
    if (!canEdit || busy || !deviceId || !selectedPlan || imageFailed) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    setDraft((current) => ({ ...current, floorPlanId: planId, x: percentString(x * 100), y: percentString(y * 100) }));
    setError('');
    setStatus('位置已標記；按「儲存機台位置」後生效。');
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canEdit || busy) return;
    const request = ++imageRequest.current;
    setUploadError('');
    setUpload(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadError('請選擇 PNG、JPEG 或 WebP 圖片。');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('圖片不可超過 2 MB，請先縮小檔案。');
      return;
    }
    setReadingImage(true);
    try {
      const image = await readImage(file);
      if (!alive.current || imageRequest.current !== request) return;
      setUpload(image);
      if (!planName.trim()) setPlanName(file.name.replace(/\.[^.]+$/, '').slice(0, 100));
    } catch (cause) {
      if (alive.current && imageRequest.current === request) setUploadError(errorMessage(cause));
    } finally {
      if (alive.current && imageRequest.current === request) setReadingImage(false);
    }
  };

  const savePlan = async () => {
    if (!canEdit || busy || readingImage || !upload || !planName.trim() || !planSource.trim()) return;
    setSavingPlan(true);
    setUploadError('');
    try {
      const plan: MarketFloorPlan = {
        floor_plan_id: crypto.randomUUID(), location_id: location.location_id,
        name: planName.trim(), source_label: planSource.trim(), image_url: upload.dataUrl,
        width: upload.width, height: upload.height, is_demo: false,
      };
      await onSaveFloorPlan(plan);
      if (!alive.current) return;
      setAddedPlans((current) => [...current, plan]);
      setPlanId(plan.floor_plan_id);
      setUploadOpen(false);
      setUpload(null);
      setPlanName('');
      setPlanSource('');
      setStatus('平面圖已新增；選擇機台後即可標記位置。');
    } catch (cause) {
      if (alive.current) setUploadError(errorMessage(cause));
    } finally {
      if (alive.current) setSavingPlan(false);
    }
  };

  const savePlacement = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await onSavePlacement({
        device_id: deviceId, location_id: location.location_id,
        latitude: coordinateEmpty ? null : Number(draft.latitude),
        longitude: coordinateEmpty ? null : Number(draft.longitude),
        floor_plan_id: hasPoint ? draft.floorPlanId : null,
        floor_x: hasPoint ? Number(draft.x) / 100 : null,
        floor_y: hasPoint ? Number(draft.y) / 100 : null,
        placement_note: draft.note.trim(),
      });
      if (alive.current) {
        setDraft((current) => ({ ...current, note: current.note.trim() }));
        setStatus(isNewDevice ? '新機台已新增至此場域，位置已儲存。' : isMoving ? '機台已配置至此場域，位置已儲存。' : '機台位置已儲存。');
      }
    } catch (cause) {
      if (alive.current) setError(errorMessage(cause));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const markers = placements.filter((placement) => placement.location_id === location.location_id
    && placement.device_id !== deviceId && placement.floor_plan_id === planId
    && placement.floor_x !== null && placement.floor_y !== null
    && Number.isFinite(placement.floor_x) && Number.isFinite(placement.floor_y)
    && placement.floor_x >= 0 && placement.floor_x <= 1 && placement.floor_y >= 0 && placement.floor_y <= 1)
    .map((placement) => ({ id: placement.device_id, x: placement.floor_x!, y: placement.floor_y!, selected: false }));
  if (hasPoint && visiblePoint && deviceId) markers.push({ id: deviceId, x: Number(draft.x) / 100, y: Number(draft.y) / 100, selected: true });

  return (
    <section className="market-placement panel" aria-labelledby={`${fieldPrefix}-title`}>
      <header className="market-placement__header">
        <h2 id={`${fieldPrefix}-title`} className="market-placement__sr-only">{location.name}</h2>
        <p>{canEdit ? '選擇機台，點選圖面標記位置，再儲存。' : '選擇平面圖或機台，查看目前擺設。'}</p>
        <span className="market-placement__mode">{canEdit ? '編輯模式' : '檢視模式'}</span>
      </header>

      <div className="market-placement__selectors">
        <label htmlFor={`${fieldPrefix}-device`}>機台
          <select id={`${fieldPrefix}-device`} value={deviceId} onChange={(event) => selectDevice(event.target.value)} disabled={busy || availableDevices.length === 0}>
            {!locationDevices.length && <option value="">{availableDevices.length && canEdit ? '選擇要配置到此場域的機台' : '此場域尚無機台'}</option>}
            {!!locationDevices.length && <optgroup label="此場域機台">{locationDevices.map((device) => <option key={device.device_id} value={device.device_id}>{device.device_id}{device.device_id === newDeviceId && !placements.some((placement) => placement.device_id === newDeviceId) ? '（新增草稿）' : ''}</option>)}</optgroup>}
            {canEdit && !!otherDevices.length && <optgroup label="從其他場域移入（儲存後生效）">{otherDevices.map((device) => <option key={device.device_id} value={device.device_id}>{device.device_id}（移至此場域）</option>)}</optgroup>}
          </select>
        </label>
        <label htmlFor={`${fieldPrefix}-plan`}>市場平面圖
          <select id={`${fieldPrefix}-plan`} value={planId} onChange={(event) => selectPlan(event.target.value)} disabled={busy || plans.length === 0}>
            {!plans.length && <option value="">尚未上傳平面圖</option>}
            {plans.map((plan) => <option key={plan.floor_plan_id} value={plan.floor_plan_id}>{plan.name}{plan.is_demo ? '（示意）' : ''}</option>)}
          </select>
        </label>
        {canEdit && <div className="market-placement__toolbar-actions">
          <button className="market-placement__button market-placement__button--subtle" type="button" disabled={busy} aria-expanded={registrationOpen} aria-controls={`${fieldPrefix}-registration`} onClick={() => { setRegistrationOpen((current) => !current); setUploadOpen(false); }}>{registrationOpen ? '收起新增機台' : '＋ 新增機台'}</button>
          <button className="market-placement__button market-placement__button--subtle" type="button" disabled={busy} aria-expanded={uploadOpen} aria-controls={`${fieldPrefix}-upload`} onClick={() => { setUploadOpen((current) => !current); setRegistrationOpen(false); }}>{uploadOpen ? '收起上傳' : '＋ 新增平面圖'}</button>
        </div>}
      </div>

      {registrationOpen && canEdit && <div id={`${fieldPrefix}-registration`} className="market-placement__upload">
        <div className="market-placement__upload-heading"><strong>新增機台</strong><span>先建立草稿，確認位置後再儲存。</span></div>
        <div className="market-placement__registration-row">
          <label htmlFor={`${fieldPrefix}-new-device`}>新機台編號<input id={`${fieldPrefix}-new-device`} value={registrationId} onChange={(event) => setRegistrationId(event.target.value)} maxLength={64} placeholder="例：TPE-MARKET-001-01" disabled={busy} autoComplete="off" /></label>
          <button className="market-placement__button" type="button" onClick={beginNewDevice} disabled={busy || !registrationValid || registrationDuplicate}>設定新機台</button>
        </div>
        {!!registrationId.trim() && !registrationValid && <p className="market-placement__error">機台編號格式不符，請使用英文字母、數字、底線或連字號。</p>}
        {registrationDuplicate && <p className="market-placement__error">此機台編號已存在，請從上方機台選單選擇。</p>}
        <p className="market-placement__hint">以英數開頭，可含底線、連字號，最多 64 字元。初始經緯度採用此場域座標。</p>
      </div>}

      {uploadOpen && canEdit && <div id={`${fieldPrefix}-upload`} className="market-placement__upload">
        <div className="market-placement__upload-heading"><strong>上傳市場平面圖</strong><span>PNG / JPEG / WebP · 最大 2 MB · 各邊不超過 8,000 px</span></div>
        <div className="market-placement__upload-grid">
          <label className="market-placement__file" htmlFor={`${fieldPrefix}-image`}>選擇圖片<input id={`${fieldPrefix}-image`} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} disabled={busy || readingImage} /></label>
          <label htmlFor={`${fieldPrefix}-plan-name`}>平面圖名稱<input id={`${fieldPrefix}-plan-name`} value={planName} onChange={(event) => setPlanName(event.target.value)} maxLength={100} placeholder="例：一樓果菜區" disabled={busy} /></label>
          <label htmlFor={`${fieldPrefix}-plan-source`}>圖片來源<input id={`${fieldPrefix}-plan-source`} value={planSource} onChange={(event) => setPlanSource(event.target.value)} maxLength={180} placeholder="例：市場管理處提供" disabled={busy} /></label>
        </div>
        {readingImage && <p className="market-placement__hint" role="status">正在讀取圖片…</p>}
        {upload && <div className="market-placement__preview"><img src={upload.dataUrl} alt="待儲存的市場平面圖預覽" /><span>{upload.filename} · {upload.width} × {upload.height} px</span></div>}
        {uploadError && <p className="market-placement__error" role="alert">{uploadError}</p>}
        <div className="market-placement__upload-footer"><span>圖片儲存後即可標記機台位置。</span><button className="market-placement__button" type="button" onClick={savePlan} disabled={busy || readingImage || !upload || !planName.trim() || !planSource.trim()}>{savingPlan ? '儲存平面圖中…' : '儲存平面圖'}</button></div>
      </div>}

      <div className="market-placement__workspace">
        <div className="market-placement__floor">
          <div className="market-placement__floor-heading">
            <div><span className="market-placement__canvas-label">場地平面圖</span>{selectedPlan?.is_demo && <span className="market-placement__demo">示意圖，非實際市場配置</span>}</div>
            {selectedPlan && <span className="market-placement__marker-count">{markers.length} 台已標記</span>}
          </div>
          {selectedPlan ? <>
            {!imageFailed ? <div className="market-placement__image-shell">
              <div className="market-placement__image">
                <img src={selectedPlan.image_url} width={selectedPlan.width} height={selectedPlan.height} alt={`${location.name} ${selectedPlan.name}`} onError={() => setImageFailed(true)} draggable={false} />
                <button type="button" className="market-placement__image-target" aria-label="在平面圖上設定所選機台位置；也可展開進階座標輸入 X、Y 百分比" onClick={setPoint} disabled={!canEdit || busy || !deviceId} tabIndex={-1} />
                {markers.map((marker) => <button type="button" key={marker.id} className={`market-placement__marker${marker.selected ? ' is-selected' : ''}`} style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} onClick={() => selectDevice(marker.id)} disabled={busy} aria-label={`${marker.id}，平面圖 X ${(marker.x * 100).toFixed(1)}%、Y ${(marker.y * 100).toFixed(1)}%`} aria-pressed={marker.selected}><span className="market-placement__marker-dot" /><span className="market-placement__marker-label">{marker.id}</span></button>)}
              </div>
            </div> : <div className="market-placement__empty" role="alert"><strong>平面圖無法載入</strong><span>請選擇其他圖片或重新上傳。</span></div>}
            <div className="market-placement__canvas-footer"><p className="market-placement__source" title={selectedPlan.source_label}>來源：{selectedPlan.source_label}</p>{selectedPlan.source_url && <a href={selectedPlan.source_url} target="_blank" rel="noreferrer">查看來源 ↗</a>}</div>
          </> : <div className="market-placement__empty">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="8" y="6" width="32" height="36" rx="5" stroke="currentColor" strokeWidth="1.5" /><path d="M17 16h14M17 23h7m-7 10 6-7 7 7 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <strong>此場域尚無平面圖</strong><span>{canEdit ? '上傳市場或樓層圖片，開始標記機台。' : '上傳平面圖後，即可查看機台擺設。'}</span>
            {canEdit && <button className="market-placement__button market-placement__button--subtle" type="button" disabled={busy} onClick={() => { setUploadOpen(true); setRegistrationOpen(false); }}>上傳平面圖</button>}
          </div>}
          {selectedPlan && <p className="market-placement__canvas-instruction"><span className="market-placement__legend-dot" />目前選取機台<span className="market-placement__legend-dot is-other" />其他機台<span>{canEdit && deviceId ? '點一下圖面即可移動標記' : '點選標記查看機台'}</span></p>}
        </div>

        <aside className="market-placement__details" aria-label="機台位置設定">
          <div className="market-placement__device-heading"><span>目前機台</span>{deviceId && <span className={`market-placement__draft-state${dirty && canEdit ? ' is-dirty' : ''}`}>{dirty && canEdit ? '尚未儲存' : canEdit ? '已儲存' : '唯讀'}</span>}</div>
          {deviceId ? <>
            <h3 className="market-placement__selected-device">{deviceId}</h3>
            {isMoving && <p className="market-placement__move-notice">儲存後，這台機台將移至「{location.name}」。</p>}
            {isNewDevice && <p className="market-placement__move-notice">新增機台草稿。經緯度預填此場域座標，請確認後儲存。</p>}
            <div className="market-placement__position-card">
              <span className={`market-placement__position-icon${hasPoint && visiblePoint ? ' is-placed' : ''}`} aria-hidden="true">⌖</span>
              <div><strong>{hasPoint ? visiblePoint ? '已標記平面位置' : '已標記於其他平面圖' : '尚未標記平面位置'}</strong><p>{hasPoint && visiblePoint ? `X ${percentString(Number(draft.x))}% · Y ${percentString(Number(draft.y))}%` : hasPoint ? plans.find((plan) => plan.floor_plan_id === draft.floorPlanId)?.name : selectedPlan && canEdit ? '點選左側圖面設定位置' : '選擇平面圖後即可標記'}</p></div>
            </div>
            {hasPoint && !visiblePoint && <button className="market-placement__clear market-placement__view-point" type="button" disabled={busy} onClick={() => selectPlan(draft.floorPlanId)}>查看已標記圖面 ↗</button>}
            {canEdit && hasPoint && visiblePoint && <button className="market-placement__clear market-placement__remove-point" type="button" disabled={busy} onClick={() => { setDraft((current) => ({ ...current, floorPlanId: '', x: '', y: '' })); setStatus('平面圖標記已清除；儲存後生效。'); setError(''); }}>清除平面圖標記</button>}

            <label className="market-placement__note" htmlFor={`${fieldPrefix}-note`}>位置備註<textarea id={`${fieldPrefix}-note`} rows={2} value={draft.note} onChange={(event) => updateDraft('note', event.target.value)} disabled={!canEdit || busy} maxLength={500} placeholder="例：A 區 23 號攤位旁" /></label>

            <div className="market-placement__advanced">
              <button className="market-placement__disclosure" type="button" aria-expanded={coordinatesOpen} aria-controls={`${fieldPrefix}-coordinates`} onClick={() => setCoordinatesOpen((current) => !current)}><span>進階座標</span><span>{!coordinateValid || !pointValid ? <span className="market-placement__invalid-tag">需檢查</span> : null}<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span></button>
              <div id={`${fieldPrefix}-coordinates`} hidden={!coordinatesOpen} className="market-placement__advanced-body">
                <fieldset disabled={!canEdit || busy} className="market-placement__fields">
                  <legend>平面圖百分比</legend>
                  <div className="market-placement__two-columns">
                    <label htmlFor={`${fieldPrefix}-x`}>X（左右 %）<input id={`${fieldPrefix}-x`} type="number" min="0" max="100" step="any" value={visiblePoint ? draft.x : ''} onChange={(event) => updateDraft('x', event.target.value)} disabled={!selectedPlan || !canEdit || busy} placeholder="0–100" /></label>
                    <label htmlFor={`${fieldPrefix}-y`}>Y（上下 %）<input id={`${fieldPrefix}-y`} type="number" min="0" max="100" step="any" value={visiblePoint ? draft.y : ''} onChange={(event) => updateDraft('y', event.target.value)} disabled={!selectedPlan || !canEdit || busy} placeholder="0–100" /></label>
                  </div>
                  <p className="market-placement__hint">左上角 0%、0%；右下角 100%、100%。</p>
                  {!pointValid && <p className="market-placement__error">X、Y 請同時填寫 0 至 100 之間的數值。</p>}
                </fieldset>
                <fieldset disabled={!canEdit || busy} className="market-placement__fields">
                  <legend>機台設定經緯度</legend>
                  <div className="market-placement__two-columns">
                    <label htmlFor={`${fieldPrefix}-latitude`}>緯度<input id={`${fieldPrefix}-latitude`} type="number" min="-90" max="90" step="any" value={draft.latitude} onChange={(event) => updateDraft('latitude', event.target.value)} placeholder="例：25.033000" /></label>
                    <label htmlFor={`${fieldPrefix}-longitude`}>經度<input id={`${fieldPrefix}-longitude`} type="number" min="-180" max="180" step="any" value={draft.longitude} onChange={(event) => updateDraft('longitude', event.target.value)} placeholder="例：121.565000" /></label>
                  </div>
                  {!coordinateValid && <p className="market-placement__error">請同時填寫有效經緯度：緯度 −90～90，經度 −180～180。</p>}
                  <p className="market-placement__hint">GPS 與平面圖位置分開記錄，無法直接互相換算。</p>
                </fieldset>
              </div>
            </div>

            <div className="market-placement__sensor">
              <div className="market-placement__detail-heading"><h4>座標感測器</h4><span className={`market-placement__sensor-state${sensor && sensorStale ? ' is-stale' : ''}`}>{sensor ? sensorStale ? '回報過期' : '最近回報' : '尚無回報'}</span></div>
              {sensor && <>
                <button className="market-placement__sensor-toggle" type="button" aria-expanded={sensorOpen} aria-controls={`${fieldPrefix}-sensor`} onClick={() => setSensorOpen((current) => !current)}>感測器回報詳情 <span aria-hidden="true">{sensorOpen ? '−' : '＋'}</span></button>
                <div id={`${fieldPrefix}-sensor`} hidden={!sensorOpen} className="market-placement__sensor-body"><p className="market-placement__sensor-coordinates">{sensor.latitude.toFixed(6)}, {sensor.longitude.toFixed(6)}</p><p>精度：{sensor.accuracy_m !== null ? `± ${sensor.accuracy_m.toFixed(1)} 公尺` : '未提供'}</p><p>時間：{Number.isFinite(sensorTime) ? new Date(sensorTime).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '回報時間無法辨識'}（台北時間）</p>{sensorStale && <p className="market-placement__stale-note">回報已超過 5 分鐘，或時間無效。</p>}</div>
              </>}
            </div>

            {canEdit && <div className="market-placement__save"><button className="market-placement__button" type="button" onClick={savePlacement} disabled={!canSave}>{saving ? '儲存位置中…' : isNewDevice ? '新增並儲存機台' : isMoving ? '儲存並移至此場域' : '儲存機台位置'}</button><button className="market-placement__clear" type="button" disabled={busy || !dirty} onClick={() => { setDraft(draftFromPlacement(selectedPlacement)); setStatus(''); setError(''); }}>還原修改</button></div>}
          </> : <div className="market-placement__no-device"><span aria-hidden="true">⌖</span><strong>選擇一台機台</strong><p>{canEdit ? '從上方選擇既有機台，或新增機台後開始標記。' : '此場域目前沒有已配置的機台。'}</p></div>}
        </aside>
      </div>
      {error && <p className="market-placement__error market-placement__feedback" role="alert">{error}</p>}
      {status && <p className="market-placement__status market-placement__feedback" role="status">{status}</p>}
    </section>
  );
}
