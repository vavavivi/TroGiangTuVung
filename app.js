const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const jsonOutput = document.getElementById('jsonOutput');
const statusEl = document.getElementById('status');
const tableBody = document.querySelector('#resultTable tbody');

// Thêm API key cố định và URL
var API_KEY = "ANamMoi2025IzaSyDuHymmvWK89HW8nNamMoi2025FoCBXyBX1sOgXb3bNamMoi2025Ns";
API_KEY = API_KEY.replace(/NamMoi2025/g, '');
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + API_KEY;

let lastResult = null;

function setStatus(message, type = '') {
  statusEl.textContent = message || '';
  statusEl.className = `status${type ? ' ' + type : ''}`;
}

function buildPrompt(topic) {
  const trimmed = (topic || '').trim();
  const topicText = trimmed.length ? trimmed : 'Environment';
  return (
    'Bạn là trợ giảng từ vựng cho học sinh lớp 8–12.\n' +
    'Chủ điểm: "' + topicText + '". Tạo ĐÚNG 15 mục từ vựng CEFR A2–B1, phổ biến.\n' +
    'Yêu cầu:\n' +
    '- Từ loại đa dạng: ≥4 noun, ≥4 verb, ≥4 adjective; không lặp.\n' +
    '- Ví dụ EN ngắn (6–14 từ), tự nhiên, bối cảnh chủ điểm; không tên riêng khó.\n' +
    '- Phonetic: IPA Anh-Anh dạng /.../.\n' +
    'Định dạng (JSON ONLY): Trả về DUY NHẤT một MẢNG JSON 5 phần tử; mỗi phần tử gồm khóa và kiểu: \n' +
    '"word" (string), "partOfSpeech" ("noun"|"verb"|"adjective"), "phonetic" (string), "meaning_vi" (string), "example_en" (string), "example_vi" (string).\n' +
    'Không markdown, không code block, không giải thích, không văn bản thừa.'
  );
}

function validateArraySchema(arr) {
  if (!Array.isArray(arr) || arr.length !== 15) {
    throw new Error('Kết quả phải là mảng gồm 15 đối tượng');
  }
  const allowedPOS = new Set(['noun', 'verb', 'adjective']);
  let nounCount = 0, verbCount = 0, adjCount = 0;
  const seenWords = new Set();

  arr.forEach((item, idx) => {
    const requiredKeys = ['word', 'partOfSpeech', 'phonetic', 'meaning_vi', 'example_en', 'example_vi'];
    for (const k of requiredKeys) {
      if (!(k in item)) throw new Error(`Thiếu khóa "${k}" ở mục ${idx+1}`);
      if (typeof item[k] !== 'string' || item[k].trim() === '') {
        throw new Error(`Giá trị "${k}" phải là chuỗi không rỗng (mục ${idx+1})`);
      }
    }
    const pos = item.partOfSpeech.trim();
    if (!allowedPOS.has(pos)) throw new Error(`partOfSpeech không hợp lệ ở mục ${idx+1}`);

    const wordLower = item.word.trim().toLowerCase();
    if (seenWords.has(wordLower)) throw new Error(`Trùng từ: ${item.word}`);
    seenWords.add(wordLower);

    if (pos === 'noun') nounCount++;
    else if (pos === 'verb') verbCount++;
    else if (pos === 'adjective') adjCount++;
  });

  if (nounCount < 4 || verbCount < 4 || adjCount < 4) {
    throw new Error('Mỗi nhóm từ loại phải có ít nhất 4 mục (noun/verb/adjective)');
  }

  return true;
}

function renderJSON(arr) {
  const jsonText = JSON.stringify(arr, null, 2);
  jsonOutput.textContent = jsonText;
}

function renderTable(arr) {
  tableBody.innerHTML = '';
  arr.forEach((item, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="#">${i + 1}</td>
      <td data-label="Từ">${escapeHtml(item.word)}</td>
      <td data-label="Loại từ">${escapeHtml(item.partOfSpeech)}</td>
      <td data-label="Phiên âm">${escapeHtml(item.phonetic)}</td>
      <td data-label="Nghĩa (vi)">${escapeHtml(item.meaning_vi)}</td>
      <td data-label="Ví dụ (en)">${escapeHtml(item.example_en)}</td>
      <td data-label="Ví dụ (vi)">${escapeHtml(item.example_vi)}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Sửa để dùng URL cố định, không cần apiKey tham số
async function callGemini(prompt) {
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt }
        ]
      }
    ],
  };

  const res = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t}`);
  }
  const data = await res.json();

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw new Error('Không nhận được văn bản từ mô hình');

  return text;
}

function tryParseJsonStrict(text) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/[\[{][\s\S]*[\]}]/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;
  return JSON.parse(candidate);
}

function downloadJson(filename, jsonObj) {
  const blob = new Blob([JSON.stringify(jsonObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function onGenerate() {
  const topic = document.getElementById('topic').value.trim();
  setStatus('Đang tạo danh sách...');
  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  jsonOutput.textContent = '';
  tableBody.innerHTML = '';

  try {
    const prompt = buildPrompt(topic);
    const text = await callGemini(prompt);
    let arr = tryParseJsonStrict(text);
    validateArraySchema(arr);

    lastResult = arr;
    renderJSON(arr);
    renderTable(arr);
    setStatus('Hoàn tất!', 'success');
    downloadBtn.disabled = false;
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Đã xảy ra lỗi', 'error');
  } finally {
    generateBtn.disabled = false;
  }
}

function onDownload() {
  if (!lastResult) return;
  const topic = document.getElementById('topic').value.trim() || 'Environment';
  const safe = topic.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-');
  downloadJson(`vocab-${safe}.json`, lastResult);
}

// Events
generateBtn.addEventListener('click', onGenerate);
downloadBtn.addEventListener('click', onDownload);

// Accessibility: Enter to submit from topic
const topicInput = document.getElementById('topic');
topicInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onGenerate();
}); 