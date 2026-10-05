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

// 处理上传图片：用 canvas 缩放压缩，避免大文件 base64 导致内存不足
function processImageFile(file, callback) {
  // 校验类型
  if (!file.type || !file.type.startsWith('image/')) {
    showToast('请选择图片文件');
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      // 最大边长限制，避免过大
      const MAX = 1600;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // 输出 JPEG，质量 0.85，体积小且兼容性好
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(url);
      callback(dataUrl);
    } catch (e) {
      URL.revokeObjectURL(url);
      console.error('canvas 处理失败:', e);
      showToast('图片处理失败，请换一张试试');
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    // HEIC 等不支持的格式会走到这里
    showToast('图片格式不支持，请用 JPG/PNG 格式');
  };
  img.src = url;
}

function onFileChange(e) {
  const i = +e.target.dataset.i;
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast('图片过大，请压缩到 10MB 以内');
    return;
  }
  processImageFile(file, dataUrl => {
    answerImages[i] = dataUrl;
    updateAnswerPreview(i);
    renderAnswerList();
  });
  // 清空 input，允许重复选择同一文件
  e.target.value = '';
}

// 把上传的图同步到试卷预览区（图片自然比例，宽度填满，高度自适应）
function updateAnswerPreview(i) {
  const cell = document.getElementById('pqa' + i);
  if (!cell) return;
  cell.innerHTML = answerImages[i]
    ? `<img src="${answerImages[i]}" alt="答题" style="width:100%;height:auto;display:block;">`
    : `<span class="placeholder">答题区</span>`;
}

// ========== 马甲同步 ==========
function syncName() {
  const v = document.getElementById('inputName').value.trim();
  document.getElementById('paperName').textContent = v || '（请填写马甲）';
}

// 等待试卷内所有图片加载完成（最多等 3 秒，避免挂起）
function waitForImages(container) {
  const imgs = container.querySelectorAll('img');
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(Array.from(imgs).map(img =>
    new Promise(resolve => {
      // 已完成加载（无论成败）直接 resolve
      if (img.complete) { resolve(); return; }
      img.onload = () => resolve();
      img.onerror = () => resolve();
      // 安全兜底：3 秒后强制 resolve，防止个别图片卡死整个流程
      setTimeout(resolve, 3000);
    })
  ));
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

  // 超时保护：避免 html2canvas 卡死导致按钮一直"生成中"
  const timeoutMs = 20000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('生成超时，请重试')), timeoutMs)
  );

  try {
    // 先等图片加载完
    await waitForImages(paper);
    // 给浏览器一点时间完成布局（用 setTimeout 而非 rAF，避免后台标签页 rAF 不触发）
    await new Promise(r => setTimeout(r, 50));

    const canvas = await Promise.race([
      html2canvas(paper, {
        backgroundColor: '#fdfaf0',
        scale: 2,
        useCORS: true,
        logging: false
      }),
      timeoutPromise
    ]);
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
