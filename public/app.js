// ========== 地址解析对比工具 - 前端逻辑 ==========

// DOM 元素引用
const els = {
  googleKey: document.getElementById('googleKey'),
  smartyAuthId: document.getElementById('smartyAuthId'),
  smartyAuthToken: document.getElementById('smartyAuthToken'),
  saveKeysBtn: document.getElementById('saveKeysBtn'),
  keysStatus: document.getElementById('keysStatus'),
  addressInput: document.getElementById('addressInput'),
  originalCoord: document.getElementById('originalCoord'),
  startBtn: document.getElementById('startBtn'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  errorMsg: document.getElementById('errorMsg'),
  resultSection: document.getElementById('resultSection'),
  googleAddress: document.getElementById('googleAddress'),
  googleZip: document.getElementById('googleZip'),
  googlePrecision: document.getElementById('googlePrecision'),
  googleCoord: document.getElementById('googleCoord'),
  googleStatus: document.getElementById('googleStatus'),
  smartyAddress: document.getElementById('smartyAddress'),
  smartyZip: document.getElementById('smartyZip'),
  smartyPrecision: document.getElementById('smartyPrecision'),
  smartyCoord: document.getElementById('smartyCoord'),
  smartyStatus: document.getElementById('smartyStatus'),
  legendDistance: document.getElementById('legendDistance'),
  distanceText: document.getElementById('distanceText'),
  legendOriginal: document.getElementById('legendOriginal'),
  distanceRow: document.getElementById('distanceRow'),
  coordDistance: document.getElementById('coordDistance'),
};

// ========== 地图初始化 ==========
const map = L.map('map').setView([39.8283, -98.5795], 4); // 美国中心

// 使用 Google Maps 瓦片（免费，无需 API Key）
L.tileLayer('https://mt1.googleapis.com/vt?lyrs=m&x={x}&y={y}&z={z}', {
  attribution: '&copy; Google',
  maxZoom: 20,
}).addTo(map);

let googleMarker = null;
let smartyMarker = null;
let originalMarker = null;
let connectLine = null;

// 自定义图标创建
function createIcon(type, label) {
  return L.divIcon({
    className: '',
    html: `<div class="custom-marker marker-${type}"><span>${label}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// ========== 密钥管理（不持久化，刷新即清除） ==========
const STORAGE_KEY = 'address_parser_keys';

function loadKeys() {
  // 刷新时清除旧密钥，不自动加载
  localStorage.removeItem(STORAGE_KEY);
  els.googleKey.value = '';
  els.smartyAuthId.value = '';
  els.smartyAuthToken.value = '';
}

function saveKeys() {
  // 仅当前会话保存（刷新即丢失，不写 localStorage）
  const keys = {
    googleKey: els.googleKey.value.trim(),
    smartyAuthId: els.smartyAuthId.value.trim(),
    smartyAuthToken: els.smartyAuthToken.value.trim(),
  };
  updateKeysStatus('密钥已保存（刷新页面后需重新输入）');
}

function updateKeysStatus(msg) {
  els.keysStatus.textContent = msg;
  els.keysStatus.className = 'keys-status saved';
  setTimeout(() => {
    if (els.keysStatus.textContent === msg) {
      els.keysStatus.textContent = '';
    }
  }, 3000);
}

els.saveKeysBtn.addEventListener('click', saveKeys);

// ========== 地址解析 ==========
async function geocodeGoogle(address, key) {
  const resp = await fetch(`/api/google-geocode?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`);
  const data = await resp.json();

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    return { success: false, error: data.status || '无结果', raw: data };
  }

  const result = data.results[0];

  // 提取邮编
  let zipcode = '';
  if (result.address_components) {
    const postal = result.address_components.find(c => c.types.includes('postal_code'));
    if (postal) zipcode = postal.long_name;
  }

  // 地址精度映射
  const locationType = result.geometry ? result.geometry.location_type : 'UNKNOWN';
  const precisionMap = {
    'ROOFTOP': '屋顶级 (Rooftop)',
    'RANGE_INTERPOLATED': '插值级 (Range Interpolated)',
    'GEOMETRIC_CENTER': '几何中心 (Geometric Center)',
    'APPROXIMATE': '近似级 (Approximate)',
  };

  return {
    success: true,
    address: result.formatted_address || '',
    zipcode: zipcode,
    precision: precisionMap[locationType] || locationType,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    status: data.status,
    partialMatch: !!result.partial_match,
  };
}

async function geocodeSmarty(params) {
  const { address, authId, authToken } = params;

  // 智能拆分地址：识别 "City, State ZIP" 模式
  // 支持: "130 5th Ave, New York, NY 10011"
  let street = address;
  let city = '';
  let state = '';
  let zipcode = '';

  // 匹配末尾的 "City, ST ZIP" 或 "City ST ZIP" 模式
  // 例如: ", New York, NY 10011" 或 " New York, NY 10011"
  const tailPattern = /,?\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/;

  const match = address.match(tailPattern);

  if (match) {
    // match 之前的部分是 street
    const matchIndex = match.index;
    street = address.slice(0, matchIndex).trim();
    // 去掉末尾可能残留的逗号
    street = street.replace(/,+$/, '').trim();
    city = match[1].trim();
    state = match[2];
    zipcode = match[3];
  }

  // 构建查询参数
  const queryParts = [
    `auth_id=${encodeURIComponent(authId)}`,
    `auth_token=${encodeURIComponent(authToken)}`,
    `street=${encodeURIComponent(street)}`,
  ];
  if (city) queryParts.push(`city=${encodeURIComponent(city)}`);
  if (state) queryParts.push(`state=${encodeURIComponent(state)}`);
  if (zipcode) queryParts.push(`zipcode=${encodeURIComponent(zipcode)}`);
  queryParts.push('candidates=1');
  queryParts.push('match=invalid');

  const query = queryParts.join('&');

  const resp = await fetch(`/api/smarty-address?${query}`);
  const data = await resp.json();

  if (!Array.isArray(data) || data.length === 0) {
    const errDetail = data.error || (Array.isArray(data) ? '返回空数组' : JSON.stringify(data));
    return { success: false, error: `未找到匹配地址: ${errDetail}`, raw: data };
  }

  const result = data[0];
  const comp = result.components || {};
  const meta = result.metadata || {};

  const fullAddress = [
    result.delivery_line_1,
    result.last_line,
  ].filter(Boolean).join(', ');

  return {
    success: true,
    address: fullAddress || address,
    zipcode: comp.zipcode ? (comp.zipcode + (comp.plus4_code ? '-' + comp.plus4_code : '')) : '',
    precision: meta.precision || '',
    lat: meta.latitude || null,
    lng: meta.longitude || null,
    status: 'OK',
    dpvMatch: (result.analysis || {}).dpv_match_code || '',
  };
}

// ========== 主流程 ==========
els.startBtn.addEventListener('click', async () => {
  const address = els.addressInput.value.trim();
  if (!address) {
    showError('请输入要解析的地址');
    return;
  }

  const googleKey = els.googleKey.value.trim();
  const smartyAuthId = els.smartyAuthId.value.trim();
  const smartyAuthToken = els.smartyAuthToken.value.trim();

  if (!googleKey) {
    showError('请先配置 Google API Key');
    return;
  }
  if (!smartyAuthId || !smartyAuthToken) {
    showError('请先配置 Smarty Auth ID 和 Auth Token');
    return;
  }

  // 重置状态
  hideError();
  hideResult();
  clearMap();
  els.startBtn.disabled = true;
  els.loadingIndicator.style.display = 'flex';

  // 解析原始经纬度
  const originalCoord = parseOriginalCoord(els.originalCoord.value.trim());

  try {
    // 并行请求两个 API
    const [googleResult, smartyResult] = await Promise.all([
      geocodeGoogle(address, googleKey),
      geocodeSmarty({ address, authId: smartyAuthId, authToken: smartyAuthToken }),
    ]);

    // 展示结果
    displayResults(googleResult, smartyResult);
    showOnMap(googleResult, smartyResult, originalCoord);

    els.resultSection.style.display = 'block';
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (!googleResult.success && !smartyResult.success) {
      showError('Google 和 Smarty 解析均失败，请检查地址和密钥是否正确');
    }
  } catch (err) {
    showError('请求失败: ' + err.message);
  } finally {
    els.startBtn.disabled = false;
    els.loadingIndicator.style.display = 'none';
  }
});

// ========== 结果展示 ==========
function displayResults(google, smarty) {
  // Google 结果
  if (google.success) {
    els.googleAddress.textContent = google.address;
    els.googleZip.textContent = google.zipcode || '无';
    els.googlePrecision.textContent = google.precision;
    els.googleCoord.textContent = `${google.lat.toFixed(6)}, ${google.lng.toFixed(6)}`;
    els.googleStatus.innerHTML = google.partialMatch
      ? '<span style="color:#fa8c16">部分匹配 (Partial Match)</span>'
      : '<span style="color:#52c41a">✓ 成功</span>';
  } else {
    els.googleAddress.textContent = '-';
    els.googleZip.textContent = '-';
    els.googlePrecision.textContent = '-';
    els.googleCoord.textContent = '-';
    els.googleStatus.innerHTML = `<span style="color:#cf1322">✗ ${google.error || '失败'}</span>`;
  }

  // Smarty 结果
  if (smarty.success) {
    els.smartyAddress.textContent = smarty.address;
    els.smartyZip.textContent = smarty.zipcode || '无';
    els.smartyPrecision.textContent = smarty.precision || '未提供';
    els.smartyCoord.textContent = smarty.lat !== null
      ? `${smarty.lat.toFixed(6)}, ${smarty.lng.toFixed(6)}`
      : '无坐标';
    const dpvLabel = smarty.dpvMatch === 'Y' ? '已验证 (DPV: Y)' : `DPV: ${smarty.dpvMatch || 'N/A'}`;
    els.smartyStatus.innerHTML = `<span style="color:#52c41a">✓ 成功 - ${dpvLabel}</span>`;
  } else {
    els.smartyAddress.textContent = '-';
    els.smartyZip.textContent = '-';
    els.smartyPrecision.textContent = '-';
    els.smartyCoord.textContent = '-';
    els.smartyStatus.innerHTML = `<span style="color:#cf1322">✗ ${smarty.error || '失败'}</span>`;
  }

  // 高亮差异
  highlightDiff('googleAddress', 'smartyAddress');
  highlightDiff('googleZip', 'smartyZip');
  highlightDiff('googlePrecision', 'smartyPrecision');

  // 距离差：仅两个图商都有经纬度时才显示
  const gHasCoord = google.success && google.lat != null && google.lng != null;
  const sHasCoord = smarty.success && smarty.lat !== null && smarty.lng !== null;

  if (gHasCoord && sHasCoord) {
    const dist = haversineDistance(
      google.lat, google.lng,
      smarty.lat, smarty.lng
    );
    els.distanceRow.style.display = '';
    els.coordDistance.textContent = dist > 1000
      ? `${(dist / 1000).toFixed(2)} km`
      : `${dist.toFixed(0)} m`;
  } else {
    els.distanceRow.style.display = 'none';
  }
}

function highlightDiff(id1, id2) {
  const el1 = document.getElementById(id1);
  const el2 = document.getElementById(id2);
  el1.classList.remove('match-highlight', 'mismatch-highlight');
  el2.classList.remove('match-highlight', 'mismatch-highlight');

  const v1 = el1.textContent.trim();
  const v2 = el2.textContent.trim();

  if (v1 === '-' || v2 === '-') return;

  if (v1 === v2) {
    el1.classList.add('match-highlight');
    el2.classList.add('match-highlight');
  } else {
    el1.classList.add('mismatch-highlight');
    el2.classList.add('mismatch-highlight');
  }
}

// ========== 地图展示 ==========
function showOnMap(google, smarty, originalCoord) {
  const markers = [];

  if (google.success && google.lat && google.lng) {
    markers.push({
      lat: google.lat,
      lng: google.lng,
      type: 'google',
      label: 'G',
      popup: `<b>Google</b><br>${google.address}`,
    });
  }

  if (smarty.success && smarty.lat !== null && smarty.lng !== null) {
    markers.push({
      lat: smarty.lat,
      lng: smarty.lng,
      type: 'smarty',
      label: 'S',
      popup: `<b>Smarty</b><br>${smarty.address}`,
    });
  }

  // 原始经纬度标记
  if (originalCoord) {
    markers.push({
      lat: originalCoord.lat,
      lng: originalCoord.lng,
      type: 'original',
      label: 'O',
      popup: `<b>原始坐标</b><br>${originalCoord.lat.toFixed(6)}, ${originalCoord.lng.toFixed(6)}`,
    });
    els.legendOriginal.style.display = 'flex';
  } else {
    els.legendOriginal.style.display = 'none';
  }

  if (markers.length === 0) return;

  // 添加标记
  const latLngs = [];
  markers.forEach(m => {
    latLngs.push([m.lat, m.lng]);
    const marker = L.marker([m.lat, m.lng], { icon: createIcon(m.type, m.label) })
      .bindPopup(m.popup)
      .addTo(map);

    if (m.type === 'google') googleMarker = marker;
    if (m.type === 'smarty') smartyMarker = marker;
    if (m.type === 'original') originalMarker = marker;
  });

  // 如果 Google 和 Smarty 都有，画连接线并显示距离
  const gIdx = markers.findIndex(m => m.type === 'google');
  const sIdx = markers.findIndex(m => m.type === 'smarty');
  if (gIdx !== -1 && sIdx !== -1) {
    const gLL = [markers[gIdx].lat, markers[gIdx].lng];
    const sLL = [markers[sIdx].lat, markers[sIdx].lng];

    connectLine = L.polyline([gLL, sLL], {
      color: '#ff4d4f',
      weight: 2,
      dashArray: '6, 4',
      className: 'connect-line',
    }).addTo(map);

    // 计算距离
    const dist = haversineDistance(gLL[0], gLL[1], sLL[0], sLL[1]);
    els.legendDistance.style.display = 'flex';
    els.distanceText.textContent = dist > 1000
      ? `两点距离: ${(dist / 1000).toFixed(2)} km`
      : `两点距离: ${dist.toFixed(0)} m`;
  }

  // 自动缩放适配
  const bounds = L.latLngBounds(latLngs);
  if (latLngs.length === 1) {
    map.setView(latLngs[0], 15);
  } else {
    map.fitBounds(bounds, { padding: [60, 60] });
  }
}

function clearMap() {
  if (googleMarker) { map.removeLayer(googleMarker); googleMarker = null; }
  if (smartyMarker) { map.removeLayer(smartyMarker); smartyMarker = null; }
  if (originalMarker) { map.removeLayer(originalMarker); originalMarker = null; }
  if (connectLine) { map.removeLayer(connectLine); connectLine = null; }
  els.legendDistance.style.display = 'none';
  els.legendOriginal.style.display = 'none';
  els.distanceRow.style.display = 'none';
}

// ========== 辅助函数 ==========
function showError(msg) {
  els.errorMsg.textContent = msg;
  els.errorMsg.style.display = 'block';
}

function hideError() {
  els.errorMsg.style.display = 'none';
}

function hideResult() {
  els.resultSection.style.display = 'none';
}

// ========== 回车键触发解析 ==========
els.addressInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    els.startBtn.click();
  }
});

// ========== 工具函数 ==========

// 原始经纬度输入：失去焦点时自动更新到地图
els.originalCoord.addEventListener('blur', () => {
  const input = els.originalCoord.value.trim();
  const coord = parseOriginalCoord(input);

  // 清除旧的原始坐标标记
  if (originalMarker) {
    map.removeLayer(originalMarker);
    originalMarker = null;
  }

  if (coord) {
    originalMarker = L.marker([coord.lat, coord.lng], { icon: createIcon('original', 'O') })
      .bindPopup(`<b>原始坐标</b><br>${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`)
      .addTo(map);
    els.legendOriginal.style.display = 'flex';

    // 自动缩放
    const allPoints = [[coord.lat, coord.lng]];
    if (googleMarker) allPoints.push(googleMarker.getLatLng());
    if (smartyMarker) allPoints.push(smartyMarker.getLatLng());
    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds, { padding: [60, 60] });
  } else if (input) {
    // 输入了无效格式
    els.legendOriginal.style.display = 'none';
  } else {
    els.legendOriginal.style.display = 'none';
  }
});

// 解析原始经纬度输入：支持 "lat, lng" 或 "lat lng" 格式
function parseOriginalCoord(input) {
  if (!input) return null;
  // 支持逗号、空格、Tab 分隔
  const parts = input.split(/[,\s]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Haversine 公式计算两点间距离（返回米）
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球半径（米）
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ========== 初始加载 ==========
loadKeys();

// 窗口大小改变时调整地图
window.addEventListener('resize', () => {
  map.invalidateSize();
});
