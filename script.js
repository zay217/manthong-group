// 1. GitHub 全局配置 (严格检查大小写)
const GITHUB_CONFIG = {
    // 这里用大写的 TOKEN
    TOKEN: localStorage.getItem('MANTHONG_TOKEN'), 
    OWNER: 'zay217',
    REPO: 'manthong-group', // 确认是 group
    PATH: 'data.json'
};

// 2. 这里的变量名也要对应
const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.PATH}`;

// 3. 在 fetch 函数里修正 (注意把 .token 改成 .TOKEN)
async function fetchFromCloud() {
    if (!GITHUB_CONFIG.TOKEN) return []; 
    try {
        const response = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_CONFIG.TOKEN}` } // 修正为大写
        });
        if (!response.ok) throw new Error("Cloud file not found");
        
        const data = await response.json();
        localStorage.setItem('gh_sha', data.sha);
        
        const content = decodeURIComponent(escape(atob(data.content)));
        const cars = JSON.parse(content);
        
        localStorage.setItem('cars', JSON.stringify(cars));
        return cars;
    } catch (error) {
        console.error("Fetch Error:", error);
        return JSON.parse(localStorage.getItem('cars')) || [];
    }
}

// 3. 核心：上传数据到 GitHub
async function saveToCloud(carsArray) {
    if (!GITHUB_CONFIG.TOKEN) {
        alert("错误：请先设置 Token！");
        return;
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
        } else {
            const err = await response.json();
            alert("Sync Failed: " + err.message);
        }
    } catch (error) {
        console.error("Save Error:", error);
    }
}

// 4. 初始化页面
document.addEventListener('DOMContentLoaded', async () => {
    await fetchFromCloud();

    const pageType = document.body.getAttribute('data-page');
    const branchType = document.body.getAttribute('data-branch');

    if (pageType === 'inventory-view') {
        renderUserInventory(branchType);
    } else if (pageType === 'admin-manage') {
        renderAdminInventory();
    }
});

// ... 其余渲染逻辑 (renderUserInventory, renderAdminInventory, addNewCar 等) 保持不变 ...

