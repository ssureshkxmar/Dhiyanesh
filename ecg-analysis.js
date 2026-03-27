// =============================================================
//  ECG AI ANALYSIS — PRODUCTION BACKEND INTEGRATION
//  - Connects to FastAPI (ecg_api.py:8004)
//  - Uses Real AI Prediction & Computer Vision Preprocessing
// =============================================================

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  let analysisResult = null;
  let currentSpeech = null;

  // ── DOM References ─────────────────────────────────────────
  let modal, uploadBtn, uploadInput, closeBtn, applyBtn;
  let loadingEl, resultsEl, loadProgress;
  let summaryBpm, summaryRhythm, explanationText, affectedList;
  
  // Pipeline Canvases/Images (Real Backend Results)
  let imgGray, imgLeads, imgPre, imgContours;

  // Applied Box
  let appliedBox, appliedRhythm, appliedAffected, appliedExplanation, voiceBtn, clearAppliedBtn;

  function init() {
    modal         = document.getElementById('ecg-ai-modal');
    uploadBtn     = document.getElementById('upload-ecg-btn');
    uploadInput   = document.getElementById('ecg-upload-input');
    closeBtn      = document.getElementById('ecg-ai-close');
    applyBtn      = document.getElementById('ai-apply-btn');
    loadingEl     = document.getElementById('ecg-ai-loading');
    resultsEl     = document.getElementById('ecg-ai-results');
    loadProgress  = document.getElementById('ecg-ai-load-progress');
    summaryBpm    = document.getElementById('ai-bpm');
    summaryRhythm = document.getElementById('ai-rhythm');
    explanationText = document.getElementById('ai-explanation');
    affectedList  = document.getElementById('ai-affected-list');

    // Pipeline Displays
    imgGray     = document.getElementById('res-gray');
    imgLeads    = document.getElementById('res-leads');
    imgPre      = document.getElementById('res-pre');
    imgContours = document.getElementById('res-contours');

    // Applied Box
    appliedBox = document.getElementById('applied-analysis-box');
    appliedRhythm = document.getElementById('applied-rhythm-label');
    appliedAffected = document.getElementById('applied-affected-chips');
    appliedExplanation = document.getElementById('applied-explanation-text');
    voiceBtn = document.getElementById('voice-assistant-btn');
    clearAppliedBtn = document.getElementById('clear-applied-btn');

    if (!uploadBtn || !modal) return;

    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      uploadInput.value = '';
      beginAnalysis(file);
    });
    closeBtn.addEventListener('click', () => closeModal());
    applyBtn.addEventListener('click', () => applyToHeart());
    if (voiceBtn) voiceBtn.addEventListener('click', toggleSpeech);
    if (clearAppliedBtn) clearAppliedBtn.addEventListener('click', resetView);
  }

  function openModal() { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
  function closeModal() { modal.classList.remove('active'); document.body.style.overflow = ''; }

  // ── Production Pipeline Call (FastAPI) ──────────────────────
  async function beginAnalysis(file) {
    if (currentSpeech) window.speechSynthesis.cancel();
    openModal();
    loadingEl.style.display = 'flex';
    resultsEl.style.display = 'none';
    loadProgress.style.width = '20%';

    const formData = new FormData();
    formData.append('file', file);

    try {
      loadProgress.style.width = '50%';
      // Replace with your EC2 IP or domain if not testing locally
      const response = await fetch('http://localhost:8004/predict-ecg', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Backend process failed');
      const data = await response.json();
      loadProgress.style.width = '100%';

      // 1. Update Images
      if(imgGray) imgGray.src = data.images.grayscale;
      if(imgLeads) imgLeads.src = data.images.leads;
      if(imgPre) imgPre.src = data.images.preprocessed;
      if(imgContours) imgContours.src = data.images.contours;

      // 2. Parse Prediction
      const pred = data.prediction || "Analysis Complete";
      const bpm = inferBPM(pred); 
      const rhythm = getRhythm(bpm, pred);

      analysisResult = { bpm, rhythm, text: pred };
      
      // 3. Populate Summary & Metrics
      summaryBpm.textContent = bpm;
      summaryRhythm.textContent = rhythm.label;
      summaryRhythm.className = 'ecg-ai-rhythm-pill ' + rhythm.status;
      explanationText.innerHTML = `<p>${pred}</p>`;
      
      populateImpact(rhythm);

      loadingEl.style.display = 'none';
      resultsEl.style.display = 'block';

    } catch (error) {
      console.error('ECG Analysis Error:', error);
      alert('Neural Engine Connection Error. Ensure Backend (Port 8004) is operational.');
      closeModal();
    }
  }

  function inferBPM(text) {
    if (text.toLowerCase().includes('abnormal')) return 114;
    if (text.toLowerCase().includes('infarction')) return 88;
    return 72;
  }

  function getRhythm(bpm, text) {
    if (text.toLowerCase().includes('normal')) return { label: 'Sinus Normal', key: 'normal', status:'normal' };
    if (text.toLowerCase().includes('infarction')) return { label: 'Myocardial Infarct', key: 'afib', status:'alert' };
    return { label: 'Arrythmia Detected', key: 'tachy', status:'warning' };
  }

  function populateImpact(r) {
    const map = {
      normal: [{name: "S.A. Node", cls: "normal", id: "sanvan"}, {name: "Valve Flow", cls: "normal", id: "ra"}],
      afib: [{name: "LV Myocardium", cls: "affected", id: "lv"}, {name: "Coronary Arteries", cls: "affected", id: "sanvan"}],
      tachy: [{name: "Atria", cls: "affected", id: "ra"}, {name: "SA Node", cls: "affected", id: "sanvan"}]
    };
    const impacts = map[r.key] || map.normal;
    affectedList.innerHTML = '';
    impacts.forEach(hit => {
      const li = document.createElement('li');
      li.className = 'ai-affected-item ' + (hit.cls==='normal'?'normal':'');
      li.innerHTML = `<div class="ai-affected-dot"></div><div class="ai-affected-name">${hit.name}</div>`;
      affectedList.appendChild(li);
    });
    analysisResult.impacts = impacts;
  }

  function applyToHeart() {
    if (!analysisResult) return;
    if (window.audioContexts) window.audioContexts.forEach(ctx => { if (ctx.state === 'suspended') ctx.resume(); });
    const bS = document.getElementById('bpm-input');
    const sS = document.getElementById('speed');
    if (bS) { bS.value = analysisResult.bpm; bS.dispatchEvent(new Event('input', { bubbles: true })); }
    if (sS) { sS.value = analysisResult.bpm / 90; sS.dispatchEvent(new Event('input', { bubbles: true })); }
    highlightParts(analysisResult.impacts);
    if(appliedBox) {
      appliedRhythm.textContent = analysisResult.rhythm.label;
      appliedExplanation.innerHTML = `<p>${analysisResult.text}</p>`;
      appliedAffected.innerHTML = '';
      analysisResult.impacts.forEach(hit => {
        const chip = document.createElement('span'); chip.className = 'applied-chip ' + (hit.cls==='normal'?'normal':''); chip.textContent = hit.name;
        appliedAffected.appendChild(chip);
      });
      appliedBox.style.display = 'block';
    }
    applyBtn.textContent = "✓ Applied";
    setTimeout(() => { closeModal(); applyBtn.textContent = "Apply Assessment"; startSpeech(analysisResult.text); }, 600);
  }

  function highlightParts(impacts) {
    impacts.filter(i => i.cls === 'affected').forEach(hit => {
      const slider = document.getElementById(hit.id);
      if (slider) {
        let c = 0; const iv = setInterval(() => { slider.value = (c%2===0)?0.3:1; slider.dispatchEvent(new Event('input',{bubbles:true})); c++; if(c>6){clearInterval(iv); slider.value=1; slider.dispatchEvent(new Event('input',{bubbles:true}));} }, 300);
      }
    });
  }

  function startSpeech(text) {
    if (currentSpeech) window.speechSynthesis.cancel();
    currentSpeech = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(currentSpeech);
  }

  function toggleSpeech() {
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    else if (analysisResult) startSpeech(analysisResult.text);
  }

  function resetView() {
    if(appliedBox) appliedBox.style.display = 'none';
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    ["sanvan","ra","la","rv","lv"].forEach(id => { const s = document.getElementById(id); if(s){s.value=1; s.dispatchEvent(new Event('input',{bubbles:true}));} });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
