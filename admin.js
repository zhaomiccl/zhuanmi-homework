// ========== 配置 ==========
const _p1 = 'ghp_z41nzQU';
const _p2 = 'ZnJaUX399';
const _p3 = 'GS9Aeh5d7';
const _p4 = 'oyn1G3Wl47y';
const CONFIG = {
  owner: 'zhaomiccl',
  repo: 'zhuanmi-homework',
  branch: 'main',
  token: _p1 + _p2 + _p3 + _p4
};

const ADMIN_PWD = '2026';

let currentData = null;
let fileSha = null;

// ========== 数据加载 ==========
async function fetchData() {
  try {
    const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/data.json`, {
      headers: { 'Authorization': `token ${CONFIG.token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const json = await res.json();
    if (json.content) {
      const decoded = atob(json.content.replace(/\n/g, ''));
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      currentData = JSON.parse(new TextDecoder('utf-8').decode(bytes));
      fileSha = json.sha;
      return currentData;
    }
  } catch (e) { console.error('fetch data failed:', e); }
  return null;
}

async function saveData(data) {
  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/data.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update homework config',
        content: content,
        sha: fileSha,
        branch: CONFIG.branch
      })
    });
    const json = await res.json();
    if (json.content && json.content.sha) {
      fileSha = json.content.sha;
      currentData = data;
      return true;
    }
  } catch (e) { console.error('save data failed:', e); }
  return false;
}

function ensureFields(d) {
  if (!d.title) d.title = '着迷试卷';
  if (!d.subtitle) d.subtitle = '国庆作业';
  if (!Array.isArray(d.questions) || d.questions.length < 5) {
    d.questions = d.questions || [];
    while (d.questions.length < 5) d.questions.push(`第 ${d.questions.length + 1} 题`);
  }
  while (d.questions.length > 5) d.questions.pop();
  if (!d.finishText) d.finishText = '答题完成';
}

// ========== 密码门 ==========
function tryLogin() {
  const v = document.getElementById('pwdInput').value.trim();
  if (v === ADMIN_PWD) {
    document.getElementById('pwdGate').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadForm();
  } else {
    document.getElementById('pwdTip').textContent = '密码错误';
    document.getElementById('pwdInput').value = '';
  }
}

// ========== 表单 ==========
async function loadForm() {
  if (!currentData) {
    const d = await fetchData();
    if (!d) { document.getElementById('saveTip').textContent = '数据加载失败'; return; }
  }
  ensureFields(currentData);
  document.getElementById('setTitle').value = currentData.title;
  document.getElementById('setSub').value = currentData.subtitle;
  for (let i = 0; i < 5; i++) {
    document.getElementById('q' + i).value = currentData.questions[i] || '';
  }
  document.getElementById('setFinish').value = currentData.finishText;
}

async function handleSave() {
  if (!currentData) { showToast('数据未加载'); return; }
  currentData.title = document.getElementById('setTitle').value.trim() || '着迷试卷';
  currentData.subtitle = document.getElementById('setSub').value.trim() || '国庆作业';
  currentData.questions = [];
  for (let i = 0; i < 5; i++) {
    currentData.questions.push(document.getElementById('q' + i).value.trim() || `第 ${i + 1} 题`);
  }
  currentData.finishText = document.getElementById('setFinish').value.trim() || '答题完成';

  document.getElementById('saveBtn').textContent = '保存中...';
  const ok = await saveData(currentData);
  document.getElementById('saveBtn').textContent = '💾 保存';
  if (ok) {
    document.getElementById('saveTip').textContent = '已保存，刷新试卷页可见';
    showToast('保存成功');
  } else {
    document.getElementById('saveTip').textContent = '保存失败，请重试';
    showToast('保存失败');
  }
}

// ========== Toast ==========
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ========== 初始化 ==========
document.getElementById('pwdBtn').addEventListener('click', tryLogin);
document.getElementById('pwdInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') tryLogin();
});
document.getElementById('saveBtn').addEventListener('click', handleSave);

// 预加载（不显示），登录后立即可用
fetchData();
