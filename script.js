// 1. 安全配置：不再直接写 Token
const GITHUB_CONFIG = {
    // 关键：从本地浏览器存储读取，不再硬编码在 JS 文件里
    TOKEN: localStorage.getItem('MANTHONG_TOKEN'), 
    OWNER: 'zay217',
    REPO: 'manthong-group', // 确认你的仓库名是 group 还是 system
    PATH: 'data.json'
};

const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.PATH}`;

// 在 fetch 和 save 函数里，如果发现没有 TOKEN，提醒用户
function checkToken() {
    if (!GITHUB_CONFIG.TOKEN) {
        alert("请先设置安全访问密钥 (Token)");
        return false;
    }
    return true;
}
// 3. 核心：从 GitHub 获取数据
async function fetchFromCloud() {
    try {
        const response = await fetch(API_URL, {
            // 注意：这里必须用 GITHUB_CONFIG.TOKEN (全大写)
            headers: { 'Authorization': `token ${GITHUB_CONFIG.TOKEN}` }
        });
        
        if (!response.ok) throw new Error("Cloud file not found");
        
        const data = await response.json();
        // 保存指纹 SHA 用于下次更新
        localStorage.setItem('gh_sha', data.sha);
        
        // 解码内容 (处理中文/特殊字符)
        const content = decodeURIComponent(escape(atob(data.content)));
        const cars = JSON.parse(content);
        
        // 更新本地备份
        localStorage.setItem('cars', JSON.stringify(cars));
        return cars;
    } catch (error) {
        console.error("Fetch Error:", error);
        // 如果云端失败，尝试用本地旧数据
        return JSON.parse(localStorage.getItem('cars')) || [];
    }
}

// 4. 核心：上传数据到 GitHub
async function saveToCloud(carsArray) {
    const sha = localStorage.getItem('gh_sha');
    // 把 JSON 转成 Base64 编码
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
                'Authorization': `token ${GITHUB_CONFIG.TOKEN}`, // 注意：TOKEN 大写
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            const result = await response.json();
            // 保存新的 SHA 指纹
            localStorage.setItem('gh_sha', result.content.sha);
            console.log("Cloud Sync Success!");
        } else {
            const err = await response.json();
            alert("Sync Failed: " + err.message);
        }
    } catch (error) {
        console.error("Save Error:", error);
    }
}

// 5. 初始化页面
document.addEventListener('DOMContentLoaded', async () => {
    // 强制先从云端拉取最新数据
    await fetchFromCloud();

    const pageType = document.body.getAttribute('data-page');
    const branchType = document.body.getAttribute('data-branch');

    if (pageType === 'inventory-view') {
        renderUserInventory(branchType);
    } else if (pageType === 'admin-manage') {
        renderAdminInventory();
    }
});

// [展示层] 渲染给客户看的分行页面
function renderUserInventory(branch) {
    const cars = JSON.parse(localStorage.getItem('cars')) || [];
    const container = document.getElementById('car-list');
    const filtered = cars.filter(c => c.branch === branch);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5"><h4 style="color:var(--gold)">NO STOCK IN ${branch.toUpperCase()}</h4></div>`;
        return;
    }

    container.innerHTML = filtered.map(car => `
        <div class="col-md-4">
            <div class="morph-card">
                <div class="position-relative mb-3">
                    <img src="${car.image}" class="img-fluid rounded" style="height:200px; width:100%; object-fit:cover; border:1px solid rgba(255,255,255,0.1)">
                    <div class="status-badge" style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.8); border:1px solid var(--gold); padding:2px 10px; font-size:0.7rem; color:white; font-weight:bold;">
                        ${car.status.toUpperCase()}
                    </div>
                    <div style="position:absolute; bottom:10px; right:10px; background:#000; color:#fff; padding:2px 8px; font-size:0.8rem; border:1px solid #444;">
                        ${car.plate}
                    </div>
                </div>
                <h4 class="mb-1 text-white">${car.brand} ${car.model}</h4>
                <p class="text-muted small">${car.year} | ${car.spec} | ${car.colour}</p>
                <div class="price-tag h3 fw-900" style="color:var(--gold)">RM ${parseFloat(car.price).toLocaleString()}</div>
                <div class="small text-muted mb-3">+ RM ${car.processing_fee} (Processing Fee)</div>
                <a href="calculator.html?price=${car.price}" class="btn-glow w-100 d-block text-center text-decoration-none">LOAN CALCULATOR</a>
            </div>
        </div>
    `).join('');
}

// [管理层] 渲染后台表格
function renderAdminInventory() {
    const cars = JSON.parse(localStorage.getItem('cars')) || [];
    const tbody = document.getElementById('inventory-table');
    
    tbody.innerHTML = cars.map(car => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: white;">
            <td class="py-3">
                <strong>${car.brand} ${car.model}</strong><br>
                <small class="text-muted">${car.plate} | ${car.year}</small>
            </td>
            <td>${car.branch}</td>
            <td>
                <select onchange="updateStatus(${car.id}, this.value)" class="form-select form-select-sm bg-white text-black fw-bold">
                    <option value="Ready" ${car.status === 'Ready' ? 'selected' : ''}>Ready</option>
                    <option value="Preparing" ${car.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="Pending" ${car.status === 'Pending' ? 'selected' : ''}>Pending</option>
                </select>
            </td>
            <td>
                <button onclick="deleteCar(${car.id})" class="btn btn-sm btn-danger">Delete</button>
            </td>
        </tr>
    `).join('');
}

// [功能层] 操作函数
window.addNewCar = async (event) => {
    event.preventDefault();
    const cars = JSON.parse(localStorage.getItem('cars')) || [];
    const newCar = {
        id: Date.now(),
        brand: document.getElementById('brand').value,
        model: document.getElementById('model').value,
        year: document.getElementById('year').value,
        spec: document.getElementById('spec').value,
        colour: document.getElementById('colour').value,
        plate: document.getElementById('plate').value,
        price: parseInt(document.getElementById('price').value),
        processing_fee: parseInt(document.getElementById('processing_fee').value || 0),
        branch: document.getElementById('branch').value,
        status: document.getElementById('status').value,
        image: document.getElementById('image').value || 'https://via.placeholder.com/400x250'
    };
    
    cars.push(newCar);
    localStorage.setItem('cars', JSON.stringify(cars));
    
    await saveToCloud(cars);
    
    alert('Vehicle Added & Cloud Synced!');
    location.reload();
};

window.updateStatus = async (id, newStatus) => {
    let cars = JSON.parse(localStorage.getItem('cars'));
    cars = cars.map(c => c.id === id ? {...c, status: newStatus} : c);
    localStorage.setItem('cars', JSON.stringify(cars));
    
    await saveToCloud(cars);
};

window.deleteCar = async (id) => {
    if(confirm('Delete this car?')) {
        let cars = JSON.parse(localStorage.getItem('cars'));
        cars = cars.filter(c => c.id !== id);
        localStorage.setItem('cars', JSON.stringify(cars));
        
        await saveToCloud(cars);
        renderAdminInventory();
    }
};

window.exportDatabase = () => {
    const data = localStorage.getItem('cars');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manthong_Fleet_Backup.json`;
    a.click();
};

