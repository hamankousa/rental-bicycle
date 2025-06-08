// --- グローバル変数 ---
const API_BASE_URL = 'http://localhost:3000';
let currentYearMonth = '';
let allBikes = [];
let allResidents = []; // 今月の全登録ユーザーを保持
let selection = {
  residentKey: null
};

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ページの読み込み完了！');
  const now = new Date();
  currentYearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  try {
    const [bikeData, residentData] = await Promise.all([
      fetch(`${API_BASE_URL}/api/master`).then(res => res.json()),
      fetch(`${API_BASE_URL}/api/residents/${currentYearMonth}`).then(res => res.json())
    ]);
    
    allBikes = bikeData.bikes;
    allResidents = residentData;

    initializeUI();
    initializeClock();
    
  } catch (error) {
    console.error('初期化処理中にエラー:', error);
    alert('アプリケーションの初期化に失敗しました。');
  }
});

// --- UI初期化のメイン関数 ---
function initializeUI() {
    createBikeCells();
    setupTabs();
    setupSearchFilters();
    setupRegistrationForm();
    updateResidentList();
    fetchAndReflectCurrentRentals();
    setupAdminControls();
}

function initializeClock() {
    const timeElement = document.getElementById('current-time');
    const updateClock = () => {
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString('ja-JP');
        }
    };
    updateClock();
    setInterval(updateClock, 1000);
}

// --- 1. タブ切り替え機能 ---
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === button.id.replace('btn', 'content')) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// --- 2. ユーザー検索機能 ---
let searchFilters = { wing: null, floor: null, side: null };

function setupSearchFilters() {
    createFilterButtons('wing', [...new Set(allResidents.map(r => r.wing))]);
    createFilterButtons('floor', [...new Set(allResidents.map(r => r.floor))]);
    createFilterButtons('side', [...new Set(allResidents.map(r => r.side))]);
}

function createFilterButtons(type, items) {
    const container = document.getElementById(`search-filter-${type}`);
    if (!container) return;
    container.innerHTML = '';
    items.sort().forEach(item => {
        const button = document.createElement('button');
        button.className = 'selector-button';
        button.textContent = item;
        button.dataset.value = item;
        button.addEventListener('click', () => {
            searchFilters[type] = searchFilters[type] === item ? null : item;
            document.querySelectorAll(`#search-filter-${type} .selector-button`).forEach(btn => {
                btn.classList.toggle('active', searchFilters[type] === btn.dataset.value);
            });
            updateResidentList();
        });
        container.appendChild(button);
    });
}

function updateResidentList() {
    const listContainer = document.getElementById('resident-list');
    listContainer.innerHTML = '';

    const filtered = allResidents.filter(r => 
        (!searchFilters.wing || r.wing === searchFilters.wing) &&
        (!searchFilters.floor || r.floor === searchFilters.floor) &&
        (!searchFilters.side || r.side === searchFilters.side)
    );

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p>該当するユーザーがいません。</p>';
        return;
    }

    filtered.forEach(resident => {
        const button = document.createElement('button');
        button.className = 'selector-button';
        button.textContent = `${resident.name} (${resident.wing}-${resident.floor}-${resident.side})`;
        button.dataset.residentKey = resident.residentKey;
        button.addEventListener('click', () => {
            listContainer.querySelectorAll('.selector-button.active').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selection.residentKey = resident.residentKey;
        });
        listContainer.appendChild(button);
    });
}

// --- 3. 新規登録機能 ---
let registrationData = { wing: null, floors: [], side: null };

function setupRegistrationForm() {
    createRegistrationButtons('wing', ['A', 'B', 'C', 'D', 'E']);
    createRegistrationButtons('floor', ['1', '2', '3', '4', '5']);
    createRegistrationButtons('side', ['内', '外', 'フロア']);
    document.getElementById('register-btn').addEventListener('click', handleRegisterUser);
}

function createRegistrationButtons(type, items) {
    const container = document.getElementById(`reg-selector-${type}`);
    if (!container) return;
    container.innerHTML = '';
    items.forEach(item => {
        const button = document.createElement('button');
        button.className = 'selector-button';
        button.textContent = item;
        button.dataset.value = item;

        if (type === 'floor') {
            button.addEventListener('click', () => {
                const floorValue = button.dataset.value;
                const index = registrationData.floors.indexOf(floorValue);
                if (index > -1) {
                    registrationData.floors.splice(index, 1);
                } else {
                    if (registrationData.floors.length < 2) {
                        registrationData.floors.push(floorValue);
                    }
                }
                registrationData.floors.sort((a, b) => a - b);
                button.classList.toggle('active', registrationData.floors.includes(floorValue));
            });
        } else {
            button.addEventListener('click', () => {
                registrationData[type] = registrationData[type] === item ? null : item;
                container.querySelectorAll('.selector-button').forEach(btn => {
                    btn.classList.toggle('active', registrationData[type] === btn.dataset.value);
                });
            });
        }
        container.appendChild(button);
    });
}

async function handleRegisterUser() {
    const name = document.getElementById('reg-name').value.trim();
    const { wing, floors, side } = registrationData;

    if (!wing || floors.length === 0 || !side || !name) {
        alert('すべての項目を選択・入力してください。');
        return;
    }

    const floorValue = floors.join('-');
    const newResidentData = { wing, floor: floorValue, side, name };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/residents/${currentYearMonth}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newResidentData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        alert('ユーザー登録が完了しました！');
        document.getElementById('reg-name').value = '';
        registrationData = { wing: null, floors: [], side: null };
        document.querySelectorAll('#tab-content-register .selector-button.active').forEach(b => b.classList.remove('active'));
        
        allResidents = await fetch(`${API_BASE_URL}/api/residents/${currentYearMonth}`).then(res => res.json());
        setupSearchFilters();
        updateResidentList();
        document.getElementById('tab-btn-search').click();

    } catch (error) {
        alert(`登録に失敗しました: ${error.message}`);
    }
}

// --- 自転車関連の関数 ---

function createBikeCells() {
  const bikeGrid = document.getElementById('bike-grid');
  bikeGrid.innerHTML = '';
  allBikes.forEach(bike => {
    const cell = document.createElement('div');
    cell.classList.add('bike-cell', 'available');
    cell.textContent = bike.name;
    cell.dataset.bikeId = bike.id;
    cell.dataset.bikeName = bike.name;
    cell.addEventListener('click', handleBikeClick);
    bikeGrid.appendChild(cell);
  });
}

async function fetchAndReflectCurrentRentals() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rentals/current`);
    const currentRentals = await response.json();
    currentRentals.forEach(rental => {
      const cell = document.querySelector(`.bike-cell[data-bike-id="${rental.bikeId}"]`);
      if (cell) {
        cell.classList.remove('available');
        cell.classList.add('rented');
        const startTime = parseFirestoreTimestamp(rental.startAt);
        cell.dataset.startTime = startTime.toISOString();
        cell.dataset.residentName = rental.residentKey.split('-').pop();
        updateCellDisplay(cell);
        if (cell.dataset.timerId) clearInterval(cell.dataset.timerId);
        const timerId = setInterval(() => updateCellDisplay(cell), 60000);
        cell.dataset.timerId = timerId;
      }
    });
  } catch (error) {
    console.error('現在の貸出状況の取得に失敗:', error);
  }
}

async function handleBikeClick(event) {
  const cell = event.currentTarget;
  const isAvailable = cell.classList.contains('available');
  const bikeId = cell.dataset.bikeId;
  let residentKey = null;

  if (isAvailable) {
    if (!selection.residentKey) {
      alert('先に利用者を選択してください！');
      return;
    }
    residentKey = selection.residentKey;
  }

  const confirmMessage = isAvailable
    ? `${residentKey.split('-').pop()}さん、${bikeId} を借りますか？`
    : `${bikeId} を返しますか？`;

  if (!confirm(confirmMessage)) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/rentals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isAvailable ? 'start' : 'end', bikeId, residentKey }),
    });

    if (!response.ok) throw new Error(`サーバーエラー: ${response.statusText}`);
    const result = await response.json();
    if (!result.rental) throw new Error('サーバーからレンタル情報が返されませんでした。');
    
    const rentalInfo = result.rental;

    if (isAvailable) {
      cell.classList.remove('available');
      cell.classList.add('rented');
      const startTime = parseFirestoreTimestamp(rentalInfo.startAt);
      cell.dataset.startTime = startTime.toISOString();
      cell.dataset.residentName = rentalInfo.residentKey.split('-').pop();
      updateCellDisplay(cell);
      if (cell.dataset.timerId) clearInterval(cell.dataset.timerId);
      const timerId = setInterval(() => updateCellDisplay(cell), 60000);
      cell.dataset.timerId = timerId;
      selection.residentKey = null;
      document.querySelectorAll('#resident-list .selector-button.active').forEach(btn => btn.classList.remove('active'));
    } else {
      cell.classList.remove('rented');
      cell.classList.add('available');
      if (cell.dataset.timerId) clearInterval(cell.dataset.timerId);
      cell.textContent = cell.dataset.bikeName;
      delete cell.dataset.startTime;
      delete cell.dataset.timerId;
      delete cell.dataset.residentName;
    }
  } catch (error) {
    console.error('リクエスト送信中にエラーが発生しました:', error);
    alert(`処理に失敗しました: ${error.message}`);
  }
}

function updateCellDisplay(cell) {
  if (!cell || !cell.classList.contains('rented')) return;
  const bikeName = cell.dataset.bikeName;
  const residentName = cell.dataset.residentName;
  const startTime = new Date(cell.dataset.startTime);
  const startHours = String(startTime.getHours()).padStart(2, '0');
  const startMinutes = String(startTime.getMinutes()).padStart(2, '0');
  const elapsedMs = new Date() - startTime;
  const elapsedHours = Math.floor(elapsedMs / 3600000);
  const elapsedMinutes = Math.floor((elapsedMs % 3600000) / 60000);

  cell.innerHTML = `
    ${bikeName}
    <small>${residentName}</small>
    <small>開始: ${startHours}:${startMinutes}</small>
    <small>経過: ${elapsedHours}h ${elapsedMinutes}m</small>
  `;
}

function parseFirestoreTimestamp(timestamp) {
  if (!timestamp) return new Date();
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (timestamp && typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
  }
  return new Date();
}

// 管理者用UIの初期設定を行う関数
function setupAdminControls() {
    const yearSelect = document.getElementById('admin-select-year');
    const monthSelect = document.getElementById('admin-select-month');
    const downloadBtn = document.getElementById('admin-download-csv-btn');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // --- 年の選択肢を生成 (過去5年分) ---
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        const option = new Option(year, year);
        yearSelect.add(option);
    }

    // --- 月の選択肢を生成 (1月～12月) ---
    for (let i = 1; i <= 12; i++) {
        const option = new Option(`${i}月`, i);
        monthSelect.add(option);
    }

    // 現在の年月をデフォルトで選択状態にする
    yearSelect.value = currentYear;
    monthSelect.value = currentMonth;


    // --- ダウンロードボタンのクリックイベント ---
    downloadBtn.addEventListener('click', () => {
        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value.toString().padStart(2, '0');
        const yearMonth = `${selectedYear}${selectedMonth}`;

        console.log(`CSVダウンロードリクエスト: ${yearMonth}`);

        // APIエンドポイントのURLを作成
        const downloadUrl = `${API_BASE_URL}/api/billing/csv/${yearMonth}`;

        // サーバーからのレスポンスをファイルとしてダウンロードさせる
        fetch(downloadUrl)
            .then(async res => {
                if (res.ok) {
                    return {
                        blob: await res.blob(),
                        filename: `billing-${yearMonth}.csv`
                    };
                }
                // 404エラーなどの場合
                const errorText = await res.text();
                throw new Error(errorText);
            })
            .then(({ blob, filename }) => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            })
            .catch(error => {
                console.error('CSVダウンロードエラー:', error);
                alert(`CSVのダウンロードに失敗しました。\n理由: ${error.message}`);
            });
    });
}