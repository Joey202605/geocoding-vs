// ===== 全局变量 =====
let map;
let markerGoogle = null;
let markerSmarty = null;
let rawMarker = null;

// ===== 初始化地图 =====
function initMap() {
    map = L.map('map', {
        center: [40.7400, -73.9920],
        zoom: 16,
        zoomControl: true
    });

    // 使用 Google 地图瓦片（需要有效的 Google API Key 才能加载）
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google'
    }).addTo(map);
}

// ===== 密钥显示切换 =====
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
}

// ===== 保存密钥配置到 localStorage =====
function saveConfig() {
    localStorage.setItem('googleApiKey', document.getElementById('googleApiKey').value);
    localStorage.setItem('smartyAuthId', document.getElementById('smartyAuthId').value);
    localStorage.setItem('smartyAuthToken', document.getElementById('smartyAuthToken').value);
    alert('密钥已保存');
}

// ===== 加载已保存的配置 =====
function loadConfig() {
    const googleKey = localStorage.getItem('googleApiKey');
    const smartyId = localStorage.getItem('smartyAuthId');
    const smartyToken = localStorage.getItem('smartyAuthToken');
    if (googleKey) document.getElementById('googleApiKey').value = googleKey;
    if (smartyId) document.getElementById('smartyAuthId').value = smartyId;
    if (smartyToken) document.getElementById('smartyAuthToken').value = smartyToken;
}

// ===== 标签页切换 =====
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    const table = document.getElementById('compareTable');
    if (tabName === 'compare') {
        table.querySelectorAll('.cell-value').forEach(td => td.style.display = '');
        table.querySelectorAll('th')[1].style.display = '';
        table.querySelectorAll('th')[2].style.display = '';
    } else if (tabName === 'google') {
        table.querySelectorAll('#smartyAddress, #smartyZipcode, #smartyPrecision, #smartyLatLng').forEach(td => td.style.display = 'none');
        table.querySelectorAll('#googleAddress, #googleZipcode, #googlePrecision, #googleLatLng').forEach(td => td.style.display = '');
        table.querySelectorAll('th')[1].style.display = '';
        table.querySelectorAll('th')[2].style.display = 'none';
    } else if (tabName === 'smarty') {
        table.querySelectorAll('#googleAddress, #googleZipcode, #googlePrecision, #googleLatLng').forEach(td => td.style.display = 'none');
        table.querySelectorAll('#smartyAddress, #smartyZipcode, #smartyPrecision, #smartyLatLng').forEach(td => td.style.display = '');
        table.querySelectorAll('th')[1].style.display = 'none';
        table.querySelectorAll('th')[2].style.display = '';
    }
}

// ===== 创建自定义标记图标 =====
function createMarkerIcon(letter, color, bgColor) {
    return L.divIcon({
        html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:${bgColor};color:#fff;font-weight:bold;
            font-size:14px;display:flex;align-items:center;
            justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.35);
            border:2px solid white;">${letter}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

const ICON_GOOGLE = createMarkerIcon('G', '#fff', '#4285F4');
const ICON_SMARTY = createMarkerIcon('S', '#fff', '#FF9800');
const ICON_CENTER = createMarkerIcon('', '#fff', '#4CAF50');

// ===== 清除地图标记 =====
function clearMarkers() {
    if (markerGoogle) { map.removeLayer(markerGoogle); markerGoogle = null; }
    if (markerSmarty) { map.removeLayer(markerSmarty); markerSmarty = null; }
    if (rawMarker) { map.removeLayer(rawMarker); rawMarker = null; }
}

// ===== 判断两个坐标是否相同 =====
function sameCoord(lat1, lng1, lat2, lng2) {
    return lat1 === lat2 && lng1 === lng2;
}

// ===== 在地图上显示标记 =====
function showMarkers(googleResult, smartyResult, rawCoords) {
    clearMarkers();

    const bounds = [];
    // 微偏移量（约 3 米），按不同方向偏移避免重叠
    const OFFSET = 0.00003;

    const hasGoogle = googleResult && googleResult.lat !== undefined && googleResult.lng !== undefined;
    const hasSmarty = smartyResult && smartyResult.lat !== undefined && smartyResult.lng !== undefined;
    const hasRaw = rawCoords && rawCoords.lat !== undefined && rawCoords.lng !== undefined;

    let gLat = hasGoogle ? googleResult.lat : 0;
    let gLng = hasGoogle ? googleResult.lng : 0;
    let sLat = hasSmarty ? smartyResult.lat : 0;
    let sLng = hasSmarty ? smartyResult.lng : 0;
    let rLat = hasRaw ? rawCoords.lat : 0;
    let rLng = hasRaw ? rawCoords.lng : 0;

    // 判断各点之间是否重叠
    const gsSame = hasGoogle && hasSmarty && sameCoord(gLat, gLng, sLat, sLng);
    const grSame = hasGoogle && hasRaw && sameCoord(gLat, gLng, rLat, rLng);
    const srSame = hasSmarty && hasRaw && sameCoord(sLat, sLng, rLat, rLng);
    const allSame = gsSame && grSame; // 三者都在同一位置

    // 计算偏移方向
    let gOffLat = 0, gOffLng = 0;
    let sOffLat = 0, sOffLng = 0;
    let rOffLat = 0, rOffLng = 0;

    if (allSame) {
        // 三者重叠：Google 不动，Smarty 向右上，原始向右下
        sOffLat = OFFSET;
        sOffLng = OFFSET;
        rOffLat = -OFFSET;
        rOffLng = OFFSET;
    } else if (gsSame) {
        // G 和 S 重叠，原始独立
        sOffLat = OFFSET;
        sOffLng = OFFSET;
    } else if (grSame) {
        // G 和 原始 重叠，Smarty 独立
        rOffLat = OFFSET;
        rOffLng = OFFSET;
    } else if (srSame) {
        // S 和 原始 重叠，Google 独立
        rOffLat = OFFSET;
        rOffLng = OFFSET;
    }

    let overlapNotes = [];
    if (gsSame) overlapNotes.push({ marker: 'S', note: '实际与 Google 坐标相同' });
    if (grSame) overlapNotes.push({ marker: 'R', note: '实际与 Google 坐标相同' });
    if (srSame) overlapNotes.push({ marker: 'R', note: '实际与 Smarty 坐标相同' });

    if (hasGoogle) {
        markerGoogle = L.marker([gLat + gOffLat, gLng + gOffLng], { icon: ICON_GOOGLE })
            .addTo(map)
            .bindPopup(`
                <strong style="color:#4285F4">🔵 Google 解析结果</strong><br/>
                <b>地址:</b> ${escapeHtml(googleResult.address || '-')}<br/>
                <b>精度:</b> ${escapeHtml(googleResult.precision || '-')}<br/>
                <b>坐标:</b> ${gLat.toFixed(6)}, ${gLng.toFixed(6)}
            `);
        bounds.push([gLat + gOffLat, gLng + gOffLng]);
    }

    if (hasSmarty) {
        const popupExtra = overlapNotes.filter(n => n.marker === 'S').map(n => `<br/><i style="color:#999">(${n.note})</i>`).join('');
        markerSmarty = L.marker([sLat + sOffLat, sLng + sOffLng], { icon: ICON_SMARTY })
            .addTo(map)
            .bindPopup(`
                <strong style="color:#FF9800">🟠 Smarty 解析结果</strong><br/>
                <b>地址:</b> ${escapeHtml(smartyResult.address || '-')}<br/>
                <b>精度:</b> ${escapeHtml(smartyResult.precision || '-')}<br/>
                <b>坐标:</b> ${sLat.toFixed(6)}, ${sLng.toFixed(6)}
                ${popupExtra}
            `);
        bounds.push([sLat + sOffLat, sLng + sOffLng]);
    }

    if (hasRaw) {
        const popupExtra = overlapNotes.filter(n => n.marker === 'R').map(n => `<br/><i style="color:#999">(${n.note})</i>`).join('');
        rawMarker = L.marker([rLat + rOffLat, rLng + rOffLng], { icon: ICON_CENTER })
            .addTo(map)
            .bindPopup(`<strong style="color:#4CAF50">🟢 原始坐标</strong><br/>${rLat.toFixed(6)}, ${rLng.toFixed(6)}${popupExtra}`);
        bounds.push([rLat + rOffLat, rLng + rOffLng]);
    }

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [60, 60] });
    }
}

// ===== HTML 转义 =====
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ===== 调用 Google Geocoding API（通过 CORS 代理或直接调用）=====
async function callGoogleAPI(address, apiKey) {
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            console.warn('Google API 返回:', data.status, data.error_message || '');
            return { error: `Google: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}` };
        }

        const result = data.results[0];
        let addressStr = '';
        let zipcode = '-';
        let precision = '-';

        for (const comp of result.address_components) {
            if (comp.types.includes('postal_code')) {
                zipcode = comp.long_name;
            }
        }

        // 精度映射
        const precisionMap = {
            'ROOFTOP': 'Rooftop',
            'RANGE_INTERPOLATED': 'Range Interpolated',
            'GEOMETRIC_CENTER': 'Geometric Center',
            'APPROXIMATE': 'Approximate'
        };
        precision = precisionMap[result.geometry.location_type] || result.geometry.location_type || '-';

        // 格式化地址
        addressStr = result.formatted_address || '-';

        return {
            address: addressStr,
            zipcode: zipcode,
            precision: precision,
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng
        };
    } catch (err) {
        console.error('Google API 调用失败:', err);
        return { error: `Google API 错误: ${err.message}` };
    }
}

// ===== 调用 Smarty Streets US Street API =====
async function callSmartyAPI(address, authId, authToken) {
    try {
        // 智能拆分地址：street / city / state / zipcode
        const parts = address.split(',').map(s => s.trim()).filter(s => s);
        let street = '', city = '', state = '', zipcode = '';

        if (parts.length === 1) {
            street = parts[0];
        } else if (parts.length === 2) {
            street = parts[0];
            // 尝试解析 city, state zip
            const match = parts[1].match(/^(.+?)\s+([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);
            if (match) {
                city = match[1];
                state = match[2];
                zipcode = match[3] || '';
            } else {
                city = parts[1];
            }
        } else {
            // 多段拆分：第一部分是街道，最后一部分是 city/state/zip
            street = parts[0];
            const lastPart = parts[parts.length - 1];
            const match = lastPart.match(/^(.+?)\s+([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);
            if (match) {
                city = match[1];
                state = match[2];
                zipcode = match[3] || '';
            } else {
                city = lastPart;
            }
            // 中间部分也加入 street
            if (parts.length > 2) {
                street = parts.slice(0, parts.length - 1).join(', ');
            }
        }

        // 构建 Smarty API URL
        let url = `https://us-street.api.smartystreets.com/street-address?auth-id=${encodeURIComponent(authId)}&auth-token=${encodeURIComponent(authToken)}`;
        if (street) url += `&street=${encodeURIComponent(street)}`;
        if (city) url += `&city=${encodeURIComponent(city)}`;
        if (state) url += `&state=${encodeURIComponent(state)}`;
        if (zipcode) url += `&zipcode=${encodeURIComponent(zipcode)}`;

        // Smarty API 本身支持 CORS（会返回 Access-Control-Allow-Origin 头），直接 fetch 即可
        console.log('[Smarty] 直连 API...');
        const response = await fetch(url);
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            return { error: 'Smarty: 无匹配结果' };
        }

        const result = data[0];

        // 组装标准地址
        const addrParts = [];
        if (result.delivery_line_1) addrParts.push(result.delivery_line_1);
        if (result.last_line) addrParts.push(result.last_line);
        const addressStr = addrParts.length > 0 ? addrParts.join(', ') : '-';

        const zip = result.components?.zipcode
            ? `${result.components.zipcode}${result.components.plus4_code ? '-' + result.components.plus4_code : ''}`
            : '-';

        // 精度映射
        const precisionMap = {
            'Y': 'Premise (精确)',
            'N': '街道级别',
            'D': 'Premise (精确)',
            'S': '街道级别',
            '': '未知'
        };
        const dpv = result.analysis?.dpv_match_code || '';
        const precision = result.metadata?.latitude && result.metadata?.longitude
            ? (precisionMap[dpv] || dpv || 'Rooftop')
            : '-';

        return {
            address: addressStr,
            zipcode: zip,
            precision: precision,
            lat: result.metadata?.latitude ?? undefined,
            lng: result.metadata?.longitude ?? undefined
        };
    } catch (err) {
        console.error('Smarty API 调用失败:', err);
        return { error: `Smarty API 错误: ${err.message}` };
    }
}

// ===== 计算 DPI（两点间距离，单位：米）=====
function calculateDPI(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) *
              Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

// ===== 填充单个结果到表格 =====
function fillGoogleResult(result) {
    if (result.error) {
        document.getElementById('googleAddress').textContent = result.error;
        document.getElementById('googleZipcode').textContent = '-';
        document.getElementById('googlePrecision').textContent = '-';
        document.getElementById('googleLatLng').textContent = '-';
    } else {
        document.getElementById('googleAddress').textContent = result.address;
        document.getElementById('googleZipcode').textContent = result.zipcode;
        document.getElementById('googlePrecision').textContent = result.precision;
        document.getElementById('googleLatLng').textContent =
            `${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`;
    }
}

function fillSmartyResult(result) {
    if (result.error) {
        document.getElementById('smartyAddress').textContent = result.error;
        document.getElementById('smartyZipcode').textContent = '-';
        document.getElementById('smartyPrecision').textContent = '-';
        document.getElementById('smartyLatLng').textContent = '-';
    } else {
        document.getElementById('smartyAddress').textContent = result.address;
        document.getElementById('smartyZipcode').textContent = result.zipcode;
        document.getElementById('smartyPrecision').textContent = result.precision;
        document.getElementById('smartyLatLng').textContent =
            `${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`;
    }
}

function updateStatus(googleResult, smartyResult) {
    const statusRow = document.getElementById('statusRow');
    const statusText = document.getElementById('statusText');
    const compareText = document.getElementById('compareText');
    statusRow.style.display = 'flex';

    const bothOk = !googleResult.error && !smartyResult.error &&
        googleResult.lat !== undefined && smartyResult.lat !== undefined;
    const bothFail = googleResult.error && smartyResult.error;

    // 状态：成功 / 失败 / 部分成功
    if (bothOk) {
        statusText.textContent = '✓ 状态：成功';
        statusText.className = 'status-badge badge-success';
    } else if (bothFail) {
        statusText.textContent = '✕ 状态：失败';
        statusText.className = 'status-badge badge-fail';
    } else {
        statusText.textContent = '⚠ 状态：部分成功';
        statusText.className = 'status-badge badge-partial';
    }

    // 对比结果：经纬度距离（仅两个都有结果时显示）
    if (bothOk) {
        const dist = calculateDPI(googleResult.lat, googleResult.lng, smartyResult.lat, smartyResult.lng);
        compareText.style.display = 'inline-block';
        if (dist <= 5) {
            compareText.textContent = `对比结果：${dist} m ✓ 一致`;
            compareText.className = 'compare-result compare-green';
        } else {
            compareText.textContent = `对比结果：${dist} m ✕ 偏差较大`;
            compareText.className = 'compare-result compare-red';
        }
    } else {
        compareText.style.display = 'none';
    }
}

function updateMap(googleResult, smartyResult) {
    const rawCoords = parseRawCoord();
    showMarkers(
        googleResult.error ? null : googleResult,
        smartyResult.error ? null : smartyResult,
        rawCoords
    );
}

// ===== 主解析函数 =====
async function parseAddress() {
    const addressInput = document.getElementById('userAddress').value.trim();
    const apiKey = document.getElementById('googleApiKey').value.trim();
    const authId = document.getElementById('smartyAuthId').value.trim();
    const authToken = document.getElementById('smartyAuthToken').value.trim();

    if (!addressInput) {
        alert('请输入用户地址');
        return;
    }
    if (!apiKey || !authId || !authToken) {
        alert('请先配置完整的 API 密钥（Google API Key、Smarty Auth ID 和 Auth Token）');
        return;
    }

    const btn = document.getElementById('btnParse');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-overlay"></span> 解析中...';

    // 先显示结果区域
    document.getElementById('resultSection').style.display = 'block';

    let googleResult = null;
    let smartyResult = null;
    let googleDone = false;
    let smartyDone = false;

    try {
        // 并行调用，先到先显示
        const googlePromise = callGoogleAPI(addressInput, apiKey).then(r => {
            googleResult = r;
            fillGoogleResult(r);
            googleDone = true;
            if (smartyDone) {
                updateStatus(googleResult, smartyResult);
                updateMap(googleResult, smartyResult);
            }
        });

        const smartyPromise = callSmartyAPI(addressInput, authId, authToken).then(r => {
            smartyResult = r;
            fillSmartyResult(r);
            smartyDone = true;
            if (googleDone) {
                updateStatus(googleResult, smartyResult);
                updateMap(googleResult, smartyResult);
            }
        });

        await Promise.all([googlePromise, smartyPromise]);

        // 确保最终状态更新
        updateStatus(googleResult, smartyResult);
        updateMap(googleResult, smartyResult);

    } catch (err) {
        alert(`解析出错: ${err.message}`);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '▶ 开始解析';
    }
}

// ===== 从原始坐标输入框解析坐标 =====
function parseRawCoord() {
    const raw = document.getElementById('rawCoord').value.trim();
    if (!raw) return null;
    // 支持逗号或空格分隔
    const parts = raw.split(/[，,\s]+/).filter(p => p !== '');
    if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
        }
    }
    return null;
}

// ===== 原始坐标失去焦点时自动标记到地图 =====
function onRawCoordBlur() {
    const coords = parseRawCoord();
    if (coords) {
        // 清除旧的原始坐标标记
        if (rawMarker) { map.removeLayer(rawMarker); rawMarker = null; }

        // 检查是否与已有 Google / Smarty 标记重叠，做相应偏移
        let rOffLat = 0, rOffLng = 0;
        const OFFSET = 0.00003;
        let note = '';

        const overlapG = markerGoogle && sameCoord(coords.lat, coords.lng, markerGoogle.getLatLng().lat, markerGoogle.getLatLng().lng);
        const overlapS = markerSmarty && sameCoord(coords.lat, coords.lng, markerSmarty.getLatLng().lat, markerSmarty.getLatLng().lng);

        if (overlapG && overlapS) {
            rOffLat = -OFFSET;
            rOffLng = OFFSET;
            note = '<br/><i style="color:#999">(实际与 Google、Smarty 坐标相同)</i>';
        } else if (overlapG) {
            rOffLat = OFFSET;
            rOffLng = OFFSET;
            note = '<br/><i style="color:#999">(实际与 Google 坐标相同)</i>';
        } else if (overlapS) {
            rOffLat = OFFSET;
            rOffLng = OFFSET;
            note = '<br/><i style="color:#999">(实际与 Smarty 坐标相同)</i>';
        }

        rawMarker = L.marker([coords.lat + rOffLat, coords.lng + rOffLng], { icon: ICON_CENTER })
            .addTo(map)
            .bindPopup(`<strong style="color:#4CAF50">🟢 原始坐标</strong><br/>${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}${note}`);

        map.setView([coords.lat, coords.lng], map.getZoom());
    }
}

// ===== 页面初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadConfig();

    // 回车触发解析
    document.getElementById('userAddress').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') parseAddress();
    });

    // 原始坐标输入框失去焦点时自动标记到地图
    document.getElementById('rawCoord').addEventListener('blur', onRawCoordBlur);
});
