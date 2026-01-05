/**
 * MANTHONG FLEET SYSTEM - CORE SCRIPT (V3 - 全员同步版)
 */

// --- [1] 基础配置 ---
const GITHUB_CONFIG = {
    TOKEN: localStorage.getItem('MANTHONG_TOKEN'), 
    OWNER: 'zay217',
    REPO: 'manthong-group', 
    PATH: 'data.json'
};

// 写入用 API URL
const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.PATH}`;
// 读取用 RAW URL (无需 Token 即可读取公开仓库)
const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/main/${GITHUB_CONFIG.PATH}`;

// --- [2] 云端同步逻辑 ---

async function fetchFromCloud() {
    try {
        // ✅ 优化：无论有没有 Token，所有人都通过 RAW 链接抓取最新数据
        // 加上时间戳 ?t= 防止手机浏览器缓存旧数据
        const response = await fetch(`${RAW_URL}?t=${Date.now()}`);
        
        if (!response.ok) throw new Error("Cloud file sync failed");
        
        const cars = await response.json();
        
        // 更新本地缓存
        localStorage.setItem('cars', JSON.stringify(cars));
        console.log("Inventory Synced from Cloud");

        // ✅ 如果是管理员，额外去拿一次 SHA，否则无法写入
        if (GITHUB_CONFIG.TOKEN) {
            const apiRes = await fetch(API_URL, {
                headers: { 'Authorization': `token ${GITHUB_CONFIG.TOKEN}` }
            });
            const apiData = await apiRes.json();
            localStorage.setItem('gh_sha', apiData.sha);
        }
        
        return cars;
    } catch (error) {
        console.error("Sync Error, using local data:", error);
        return JSON.parse(localStorage.getItem('cars')) || [];
    }
}

async function saveToCloud(carsArray) {
    if (!GITHUB_CONFIG.TOKEN) {
        alert("Action Denied: No Admin Token found.");
        return false;
    }

    const sha = localStorage.getItem('gh_sha');
    // 处理中文/特殊字符的 Base64 编码
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(carsArray, null, 2))));

    const body = {
        message: `Inventory Update: ${new Date().toLocaleString()}`,
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
            return true;
        } else {
            const err = await response.json();
            alert("Cloud Save Failed: " + err.message);
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

    const filtered = cars.filter(c => c.branch.toLowerCase() === branch.toLowerCase());

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5"><h4 style="color:#FFCC00">NO STOCK IN ${branch.toUpperCase()}</h4></div>`;
        return;
    }

    container.innerHTML = filtered.map(car => `
        <div class="col-md-4 mb-4">
            <div class="morph-card">
                <div class="position-relative mb-3">
                    <img src="${car.image || 'https://via.placeholder.com/400x250'}" class="img-fluid rounded" style="height:200px; width:100%; object-fit:cover; border:1px solid rgba(255,255,255,0.1)">
                    <div class="status-badge" style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.8); border:1px solid #FFCC00; padding:2px 10px; font-size:0.7rem; color:white; font-weight:bold;">
                        ${(car.status || 'Ready').toUpperCase()}
                    </div>
                </div>
                <h4 class="mb-1 text-white">${car.brand} ${car.model}</h4>
                <p class="text-muted small">${car.year} | ${car.plate}</p>
                <div class="price-tag h3 fw-900" style="color:#FFCC00">RM ${parseFloat(car.price || 0).toLocaleString()}</div>
                <a href="calculator.html?price=${car.price}" class="btn-glow w-100 d-block text-center text-decoration-none mt-3">LOAN CALCULATOR</a>
            </div>
        </div>
    `).join('');
}

function renderAdminInventory() {
    const cars = JSON.parse(localStorage.getItem('cars')) || [];
    const tbody = document.getElementById('inventory-table');
    if (!tbody) return;
    
    tbody.innerHTML = cars.map((car, index) => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: white;">
            <td class="py-3">
                <strong>${car.brand} ${car.model}</strong><br>
                <small class="text-muted">${car.plate} | ${car.year}</small>
            </td>
            <td>${car.branch}</td>
            <td>
                <select onchange="updateStatusByIndex(${index}, this.value)" class="form-select form-select-sm bg-dark text-white border-secondary">
                    <option value="Ready" ${car.status === 'Ready' ? 'selected' : ''}>Ready</option>
                    <option value="Preparing" ${car.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="Pending" ${car.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Sold" ${car.status === 'Sold' ? 'selected' : ''}>Sold</option>
                </select>
            </td>
            <td>
                <button onclick="deleteCarByIndex(${index})" class="btn btn-sm btn-danger"><i class="fa fa-trash"></i></button>
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

    let cars = JSON.parse(localStorage.getItem('cars')) || [];
    const newCar = {
        id: Date.now(), // 使用时间戳作为唯一ID
        brand: document.getElementById('brand').value,
        model: document.getElementById('model').value,
        year: document.getElementById('year').value,
        spec: document.getElementById('spec').value || '',
        colour: document.getElementById('colour').value || '',
        plate: document.getElementById('plate').value || '',
        price: parseInt(document.getElementById('price').value) || 0,
        processing_fee: parseInt(document.getElementById('processing_fee').value || 0),
        branch: document.getElementById('branch').value,
        status: document.getElementById('status').value,
        image: document.getElementById('image').value || ''
    };
    
    // 新车插到最前面
    cars.unshift(newCar);
    
    const success = await saveToCloud(cars);
    
    if (success) {
        localStorage.setItem('cars', JSON.stringify(cars));
        alert('Success: Inventory Updated for all branches!');
        location.reload();
    } else {
        btn.disabled = false;
        btn.innerText = "PUSH TO DATABASE";
    }
};

window.updateStatusByIndex = async (index, newStatus) => {
    let cars = JSON.parse(localStorage.getItem('cars'));
    cars[index].status = newStatus;
    const success = await saveToCloud(cars);
    if (success) {
        localStorage.setItem('cars', JSON.stringify(cars));
        console.log("Status updated!");
    }
};

window.deleteCarByIndex = async (index) => {
    if(confirm('Delete this vehicle from global database?')) {
        let cars = JSON.parse(localStorage.getItem('cars'));
        cars.splice(index, 1);
        const success = await saveToCloud(cars);
        if (success) {
            localStorage.setItem('cars', JSON.stringify(cars));
            renderAdminInventory();
        }
    }
};

// --- [5] 启动 ---
document.addEventListener('DOMContentLoaded', async () => {
    // 强制先同步云端
    await fetchFromCloud();

    const pageType = document.body.getAttribute('data-page');
    const branchType = document.body.getAttribute('data-branch');

    if (pageType === 'inventory-view' && branchType) {
        renderUserInventory(branchType);
    } else if (pageType === 'admin-manage') {
        renderAdminInventory();
    }
});
