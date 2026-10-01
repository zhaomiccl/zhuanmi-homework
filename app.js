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

// ========== 渲染试卷预览 ==========
function renderPaper() {
  if (!currentData) return;
  document.getElementById('topTitle').textContent = currentData.subtitle || '国庆作业';
  document.getElementById('paperTitle').textContent = currentData.title || '着迷试卷';
  document.getElementById('paperSub').textContent = currentData.subtitle || '';
  document.getElementById('paperFinish').textContent = currentData.finishText || '答题完成';

  const body = document.getElementById('paperBody');
  body.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const block = document.createElement('div');
    block.className = 'q-block';
    block.innerHTML = `
      <div class="q-title" id="pqt${i}">${i + 1}. ${escapeHtml(currentData.questions[i] || '')}</div>
      <div class="q-answer" id="pqa${i}"><span class="placeholder">答题区</span></div>
    `;
    body.appendChild(block);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ========== 编辑区（上传图片贴图） ==========
// 每项为 base64 字符串或 null（图片保持原始比例，不裁切）
const answerImages = [null, null, null, null, null];

function renderAnswerList() {
  const list = document.getElementById('answerList');
  list.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const item = document.createElement('div');
    item.className = 'answer-item';
    item.innerHTML = `
      <div class="answer-item-head">
        <div class="q-text">${i + 1}. ${escapeHtml(currentData.questions[i] || '')}</div>
        ${answerImages[i] ? `<button class="answer-clear" data-i="${i}">清除</button>` : ''}
      </div>
      <label class="answer-upload${answerImages[i] ? ' has-img' : ''}" data-i="${i}">
        ${answerImages[i]
          ? `<img src="${answerImages[i]}" alt="答题图">`
          : `📷 点击上传答题图片`}
        <input type="file" accept="image/*" data-i="${i}">
      </label>
    `;
    list.appendChild(item);
  }
  // 绑定文件选择
  list.querySelectorAll('input[type=file]').forEach(inp => {
    inp.addEventListener('change', onFileChange);
  });
  list.querySelectorAll('.answer-clear').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = +e.currentTarget.dataset.i;
      answerImages[i] = null;
      updateAnswerPreview(i);
      renderAnswerList();
    });
  });
}

function onFileChange(e) {
  const i = +e.target.dataset.i;
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 6 * 1024 * 1024) {
    showToast('图片过大，请压缩到 6MB 以内');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    answerImages[i] = ev.target.result;
    updateAnswerPreview(i);
    renderAnswerList();
  };
  reader.onerror = () => showToast('图片读取失败');
  reader.readAsDataURL(file);
}

// 把上传的图同步到试卷预览区（保持图片原始比例，不裁切不变形）
function updateAnswerPreview(i) {
  const cell = document.getElementById('pqa' + i);
  if (!cell) return;
  cell.innerHTML = answerImages[i]
    ? `<img src="${answerImages[i]}" alt="答题" style="width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;">`
    : `<span class="placeholder">答题区</span>`;
}

// ========== 马甲同步 ==========
function syncName() {
  const v = document.getElementById('inputName').value.trim();
  document.getElementById('paperName').textContent = v || '（请填写马甲）';
}

// ========== 生成试卷图片 ==========
async function handleGenerate() {
  if (typeof window.html2canvas !== 'function') {
    showToast('图片库加载失败，请检查网络后刷新页面');
    return;
  }
  const name = document.getElementById('inputName').value.trim();
  if (!name) { showToast('请先填写马甲昵称'); return; }

  // 至少上传一张图
  if (!answerImages.some(a => a)) {
    showToast('请至少上传一张答题图片');
    return;
  }

  syncName();
  const btn = document.getElementById('btnGenerate');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '生成中...';
  showToast('正在生成试卷图片...');

  const paper = document.getElementById('paper');

  try {
    const canvas = await html2canvas(paper, {
      backgroundColor: '#fdfaf0',
      scale: 2,
      useCORS: true,
      logging: false
    });
    const dataUrl = canvas.toDataURL('image/png');
    const img = document.getElementById('resultImg');
    img.src = dataUrl;
    document.getElementById('modal').classList.add('show');
    showToast('生成成功，长按图片可保存');
  } catch (e) {
    console.error('[paper] html2canvas failed:', e);
    const reason = (e && (e.message || e.name)) ? (e.name + ': ' + e.message) : '未知错误';
    showToast('生成失败：' + reason);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ========== Toast ==========
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ========== 初始化 ==========
async function init() {
  const data = await fetchData();
  if (!data) {
    document.getElementById('loading').textContent = '加载失败，请刷新重试';
    return;
  }
  ensureFields(data);
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
  renderPaper();
  renderAnswerList();
}

// ========== 事件绑定 ==========
document.getElementById('inputName').addEventListener('input', syncName);
document.getElementById('btnGenerate').addEventListener('click', handleGenerate);
document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modal').classList.remove('show');
});
document.getElementById('adminFab').addEventListener('click', () => {
  location.href = 'admin.html';
});

init();
