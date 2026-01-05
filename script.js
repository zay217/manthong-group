/**
 * MANTHONG FLEET SYSTEM - CORE SCRIPT
 * 修正版：移除导致 CORS 报错的 Cache-Control
 */

// --- [1] 基础配置 ---
const GITHUB_CONFIG = {
    TOKEN: localStorage.getItem('MANTHONG_TOKEN'), 
    OWNER: 'zay217',
    REPO: 'manthong-group', 
    PATH: 'data.json'
};

const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.PATH}`;

// --- [2] 云端同步逻辑 ---

async function fetchFromCloud() {
    if (!GITHUB_CONFIG.TOKEN) {
        console.warn("No Token found. Operating in local mode.");
        return JSON.parse(localStorage.getItem('cars')) || [];
    }
    try {
        const response = await fetch(API_URL, {
            // ✅ 修正：移除了 'Cache-Control'，只保留 Authorization
            headers: { 
                'Authorization': `token ${GITHUB_CONFIG.TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) throw new Error("Cloud file not found");
        
        const data = await response.json();
        localStorage.setItem('gh_sha', data.sha); 
        
        // 解析 Base64 内容
        const content = decodeURIComponent(escape(atob(data.content)));
        const cars = JSON.parse(content);
        
        localStorage.setItem('cars', JSON.stringify(cars));
        return cars;
    } catch (error) {
        console.error("Fetch Error:", error);
        return JSON.parse(localStorage.getItem('cars')) || [];
    }
}

async function saveToCloud(carsArray) {
    if (!GITHUB_CONFIG.TOKEN) {
        alert("错误：未检测到 Token，请在控制台设置！");
        return false;
    }

    const sha = localStorage.getItem('gh_sha');
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(carsArray, null, 2))));

    const body = {
        message: `Inventory update: ${new Date().toLocaleString()}`,
        content: content,
        sha: sha 
    };

    try {
        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            const result = await response.json();
            localStorage.setItem('gh_sha', result.content.sha); 
            console.log("Cloud Sync Success!");
            return true;
        } else {
            const err = await response.json();
            alert("Sync Failed: " + err.message);
            return false;
        }
    } catch (error) {
        console.error("Save Error:", error);
        return false;
    }
}

// --- [3] 渲染逻辑 ---

function renderUserInventory(branch) {
    const cars = JSON.parse(localStorage.getItem('cars')) || [];
    const container = document.getElementById('car-list');
    if (!container) return;

    // 统一转小写对比，防止因为大小写导致查不到车
    const filtered = cars.filter(c => c.branch.toLowerCase() === branch.toLowerCase());

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5"><h4 style="color:#FFCC00">NO STOCK IN ${branch.toUpperCase()}</h4></div>`;
        return;
    }

    container.innerHTML = filtered.map(car => `
        <div class="col-md-4">
            <div class="morph-card">
                <div class="position-relative mb-3">
                    <img src="${car.image}" class="img-fluid rounded" style="height:200px; width:100%; object-fit:cover; border:1px solid rgba(255,255,255,0.1)">
                    <div class="status-badge" style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.8); border:1px solid #FFCC00; padding:2px 10px; font-size:0.7rem; color:white; font-weight:bold;">
                        ${car.status.toUpperCase()}
                    </div>
                </div>
                <h4 class="mb-1 text-white">${car.brand} ${car.model}</h4>
                <p class="text-muted small">${car.year} | ${car.plate}</p>
                <div class="price-tag h3 fw-900" style="color:#FFCC00">RM ${parseFloat(car.price).toLocaleString()}</div>
                <a href="calculator.html?price=${car.price}" class="btn-glow w-100 d-block text-center text-decoration-none mt-3">LOAN CALCULATOR</a>
            </div>
        </div>
    `).join('');
}

function renderAdminInventory() {
    const cars = JSON.parse(localStorage.getItem('cars')) || [];
    const tbody = document.getElementById('inventory-table');
    if (!tbody) return;
    
    tbody.innerHTML = cars.map(car => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: white;">
            <td class="py-3">
                <strong>${car.brand} ${car.model}</strong><br>
                <small class="text-muted">${car.plate} | ${car.year}</small>
            </td>
            <td>${car.branch}</td>
            <td>
                <select onchange="updateStatus(${car.id}, this.value)" class="form-select form-select-sm">
                    <option value="Ready" ${car.status === 'Ready' ? 'selected' : ''}>Ready</option>
                    <option value="Preparing" ${car.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="Pending" ${car.status === 'Pending' ? 'selected' : ''}>Pending</option>
                </select>
            </td>
            <td>
                <button onclick="deleteCar(${car.id})" class="btn btn-sm btn-danger"><i class="fa fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- [4] 功能操作 ---

window.addNewCar = async (event) => {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "PUSHING TO CLOUD...";

    const cars = JSON.parse(localStorage.getItem('cars')) || [];
    const newCar = {
        id: Date.now(),
        brand: document.getElementById('brand').value,
        model: document.getElementById('model').value,
        year: document.getElementById('year').value,
        spec: document.getElementById('spec').value || '',
        colour: document.getElementById('colour').value || '',
        plate: document.getElementById('plate').value || '',
        price: parseInt(document.getElementById('price').value),
        processing_fee: parseInt(document.getElementById('processing_fee').value || 0),
        branch: document.getElementById('branch').value,
        status: document.getElementById('status').value,
        image: document.getElementById('image').value || 'https://via.placeholder.com/400x250'
    };
    
    cars.push(newCar);
    const success = await saveToCloud(cars);
    
    if (success) {
        localStorage.setItem('cars', JSON.stringify(cars));
        alert('Vehicle Added Successfully!');
        location.reload();
    } else {
        btn.disabled = false;
        btn.innerText = "PUSH TO DATABASE";
    }
};

window.updateStatus = async (id, newStatus) => {
    let cars = JSON.parse(localStorage.getItem('cars'));
    cars = cars.map(c => c.id === id ? {...c, status: newStatus} : c);
    const success = await saveToCloud(cars);
    if (success) localStorage.setItem('cars', JSON.stringify(cars));
};

window.deleteCar = async (id) => {
    if(confirm('Delete this car?')) {
        let cars = JSON.parse(localStorage.getItem('cars'));
        cars = cars.filter(c => c.id !== id);
        const success = await saveToCloud(cars);
        if (success) {
            localStorage.setItem('cars', JSON.stringify(cars));
            renderAdminInventory();
        }
    }
};

window.exportDatabase = () => {
    const data = localStorage.getItem('cars');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Manthong_Backup_${new Date().toLocaleDateString()}.json`;
    a.click();
};

// --- [5] 启动引擎 ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 先拉取数据
    await fetchFromCloud();

    // 2. 识别页面
    const pageType = document.body.getAttribute('data-page');
    const branchType = document.body.getAttribute('data-branch');

    // 3. 执行渲染
    if (pageType === 'inventory-view' && branchType) {
        renderUserInventory(branchType);
    } else if (pageType === 'admin-manage') {
        renderAdminInventory();
    }
});
