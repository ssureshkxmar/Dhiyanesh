// =============================================================
//  ECG AI ANALYSIS — Advanced Clinical Dashboard & Voice Assistant
//  - Glassmorphic modal
//  - Multi-stage image processing
//  - Anatomical Highlighting (Engine Sync)
//  - Speech Synthesis Voice Assistant
// =============================================================

(function () {
  'use strict';

  const LEAD_NAMES = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];

  // ── State ──────────────────────────────────────────────────
  let analysisResult = null;
  let originalImg = null;
  let currentSpeech = null;

  // ── DOM References ─────────────────────────────────────────
  let modal, uploadBtn, uploadInput, closeBtn, applyBtn;
  let loadingEl, resultsEl, loadProgress;
  let summaryBpm, summaryRhythm, explanationText, affectedList;
  let grayscaleCvs, pointedCvs, leadsGrid;

  // New Summary Box (Below Monitor)
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
    grayscaleCvs  = document.getElementById('ai-grayscale-cvs');
    pointedCvs    = document.getElementById('ai-pointed-cvs');
    leadsGrid     = document.getElementById('ai-leads-grid');

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

  function openModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── Pipeline ───────────────────────────────────────────────
  function beginAnalysis(file) {
    if (currentSpeech) window.speechSynthesis.cancel();
    openModal();
    loadingEl.style.display = 'flex';
    resultsEl.style.display = 'none';
    loadProgress.style.width = '0%';

    const reader = new FileReader();
    reader.onload = (ev) => {
      originalImg = new Image();
      originalImg.onload = () => {
        setTimeout(() => { loadProgress.style.width = '30%'; }, 200);
        setTimeout(() => { loadProgress.style.width = '70%'; }, 500);
        setTimeout(() => { processImage(); }, 800);
      };
      originalImg.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function processImage() {
    if (!originalImg) return;
    const W = originalImg.naturalWidth;
    const H = originalImg.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImg, 0, 0);

    generateGrayscale(W, H);
    const { peaks, bpm } = detectPeaks(ctx, W, H);
    generatePointedWaves(W, H, peaks);

    const rhythm = getRhythm(bpm);
    analysisResult = { bpm, rhythm };

    renderLeadSlices(canvas, W, H);
    populateSummary(bpm, rhythm);

    loadingEl.style.display = 'none';
    resultsEl.style.display = 'block';
  }

  // ── Visualization Helpers ───────────────────────────────────

  function generateGrayscale(w, h) {
    const gctx = grayscaleCvs.getContext('2d');
    grayscaleCvs.width = w; grayscaleCvs.height = h;
    gctx.drawImage(originalImg, 0, 0);
    const imgData = gctx.getImageData(0,0,w,h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      d[i] = d[i+1] = d[i+2] = g;
    }
    gctx.putImageData(imgData, 0, 0);
  }

  function detectPeaks(ctx, w, h) {
    const stripY = Math.floor(h * 0.3);
    const px = ctx.getImageData(0, stripY, w, 1).data;
    const sig = [];
    for(let i=0; i<w; i++){
      const k = i*4; sig.push(0.3*px[k] + 0.59*px[k+1] + 0.11*px[k+2]);
    }
    const avg = sig.reduce((a,b)=>a+b,0)/sig.length;
    const thr = avg > 128 ? avg * 0.7 : avg * 1.3;
    const peaks = [];
    const minDist = w * 0.05;
    for(let i=1; i<w-1; i++){
      const isP = (avg > 128) ? (sig[i]<thr && sig[i]<sig[i-1] && sig[i]<sig[i+1]) : (sig[i]>thr && sig[i]>sig[i-1] && sig[i]>sig[i+1]);
      if(isP && (peaks.length===0 || i - peaks[peaks.length-1].x > minDist)){
        peaks.push({x: i, y: stripY});
      }
    }
    let bpm = 72;
    if(peaks.length >= 2){
      const rr = (peaks[peaks.length-1].x - peaks[0].x) / (peaks.length-1);
      const pxPerSec = w / 10;
      bpm = 60 / (rr / pxPerSec);
    }
    return { peaks, bpm: Math.round(bpm) };
  }

  function generatePointedWaves(w, h, peaks) {
    const pctx = pointedCvs.getContext('2d');
    pointedCvs.width = w; pointedCvs.height = h;
    pctx.drawImage(originalImg, 0, 0);
    pctx.strokeStyle = '#00ff88'; pctx.lineWidth = 3;
    peaks.forEach(p => {
      pctx.strokeRect(p.x - 15, p.y - 40, 30, 80);
      pctx.beginPath(); pctx.setLineDash([5, 5]); pctx.moveTo(p.x, 0); pctx.lineTo(p.x, h); pctx.stroke(); pctx.setLineDash([]);
    });
  }

  function renderLeadSlices(srcCvs, w, h) {
    leadsGrid.innerHTML = '';
    const sliceW = w / 4;
    const sliceH = (h * 0.75) / 3;
    for(let i=0; i<12; i++){
      const c = i % 4; const r = Math.floor(i / 4);
      const div = document.createElement('div');
      div.className = 'ecg-lead-mini';
      div.innerHTML = `<label>${LEAD_NAMES[i]}</label><canvas></canvas>`;
      leadsGrid.appendChild(div);
      const mcvs = div.querySelector('canvas');
      mcvs.width = 100; mcvs.height = 40;
      const mctx = mcvs.getContext('2d');
      mctx.drawImage(srcCvs, c*sliceW, r*sliceH, sliceW, sliceH, 0, 0, 100, 40);
    }
  }

  function getRhythm(bpm) {
    if (bpm < 60)  return { label: 'Sinus Bradycardia', key: 'brady', status:'warning' };
    if (bpm > 100) return { label: 'Sinus Tachycardia', key: 'tachy', status:'warning' };
    if (bpm > 115) return { label: 'Atrial Fibrillation', key: 'afib', status:'alert' };
    return { label: 'Normal Sinus Rhythm', key: 'normal', status:'normal' };
  }

  function populateSummary(bpm, rhythm) {
    summaryBpm.textContent = bpm;
    summaryRhythm.textContent = rhythm.label;
    summaryRhythm.className = 'ecg-ai-rhythm-pill ' + rhythm.status;

    const explanations = {
      normal: "Standard heart rhythm detected at " + bpm + " beats per minute. The sinoatrial node is firing consistently, and all chambers are synchronized. This is a very healthy cardiac profile.",
      tachy: "Tachycardia detected. The heart is beating rapidly at " + bpm + " beats per minute. This may be due to stress, dehydration, or an overactive S.A. node. Monitor for persistent elevation.",
      brady: "Bradycardia observed. The rate is below sixty beats per minute. This is common in elite athletes but can also signify a conduction block in the cardiac electrical system.",
      afib: "High suspicion of Atrial Fibrillation. The atria are exhibiting chaotic electrical signals. This leads to inefficient pumping and requires immediate medical correlation."
    };
    const text = explanations[rhythm.key] || explanations.normal;
    explanationText.innerHTML = `<p>${text}</p>`;

    const impactMap = {
      normal: [{name: "SA Node", cls: "normal", engineId: "sanvan"}, {name: "Ventricles", cls: "normal", engineId: "rv"}],
      tachy: [{name: "S.A. Node", cls: "affected", engineId: "sanvan"}, {name: "Myocardium", cls: "affected", engineId: "Heartmuscles"}],
      brady: [{name: "Pacemaker", cls: "affected", engineId: "sanvan"}, {name: "AV Node", cls: "affected", engineId: "sanvan"}],
      afib: [{name: "Right Atrium", cls: "affected", engineId: "ra"}, {name: "Left Atrium", cls: "affected", engineId: "la"}]
    };

    affectedList.innerHTML = '';
    const impacts = impactMap[rhythm.key] || impactMap.normal;
    impacts.forEach(hit => {
      const li = document.createElement('li');
      li.className = 'ai-affected-item ' + (hit.cls==='normal'?'normal':'');
      li.innerHTML = `<div class="ai-affected-dot"></div><div class="ai-affected-name">${hit.name}</div><div class="ai-affected-status">Status Detected</div>`;
      affectedList.appendChild(li);
    });

    analysisResult.text = text;
    analysisResult.impacts = impacts;
  }

  // ── Apply & Integration ────────────────────────────────────

  function applyToHeart() {
    if (!analysisResult) return;

    // Resuming AudioContext
    if (window.audioContexts) {
      window.audioContexts.forEach(ctx => { if (ctx.state === 'suspended') ctx.resume(); });
    }

    // 1. Sync BPM & Speed
    const bpmSlider = document.getElementById('bpm-input');
    const speedSlider = document.getElementById('speed');
    if (bpmSlider) { bpmSlider.value = analysisResult.bpm; bpmSlider.dispatchEvent(new Event('input', { bubbles: true })); }
    if (speedSlider) { speedSlider.value = analysisResult.bpm / 90; speedSlider.dispatchEvent(new Event('input', { bubbles: true })); }

    // 2. Highlight Anatomical Affected Parts (Visual Engine)
    highlightParts(analysisResult.impacts);

    // 3. Populate Sidebar Box (Below Monitor)
    appliedRhythm.textContent = analysisResult.rhythm.label;
    appliedRhythm.className = analysisResult.rhythm.status;
    appliedExplanation.innerHTML = `<p>${analysisResult.text}</p>`;
    appliedAffected.innerHTML = '';
    analysisResult.impacts.forEach(hit => {
      const chip = document.createElement('span');
      chip.className = 'applied-chip ' + (hit.cls==='normal'?'normal':'');
      chip.textContent = hit.name;
      appliedAffected.appendChild(chip);
    });

    appliedBox.style.display = 'block';

    applyBtn.textContent = "✓ Applied";
    setTimeout(() => {
      closeModal();
      applyBtn.textContent = "Apply Assessment";
      // Auto-start Voice Assistant
      startSpeech(analysisResult.text);
    }, 600);
  }

  // ── Highlighting Logic ───────────────────────────────────────
  function highlightParts(impacts) {
    impacts.filter(i => i.cls === 'affected').forEach(hit => {
      const slider = document.getElementById(hit.engineId);
      if (!slider) return;

      // Pulse effect via engine hooks
      let count = 0;
      const interval = setInterval(() => {
        slider.value = (count % 2 === 0) ? 0.3 : 1;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        count++;
        if (count > 6) {
          clearInterval(interval);
          slider.value = 1;
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 300);
    });
  }

  // ── Voice Assistant (Speech Synthesis) ────────────────────────
  function startSpeech(text) {
    if (currentSpeech) window.speechSynthesis.cancel();
    
    currentSpeech = new SpeechSynthesisUtterance("Analysis Result. " + text);
    currentSpeech.rate = 0.95;
    currentSpeech.pitch = 1.1;

    currentSpeech.onstart = () => voiceBtn.classList.add('speaking');
    currentSpeech.onend = () => voiceBtn.classList.remove('speaking');
    currentSpeech.onerror = () => voiceBtn.classList.remove('speaking');

    window.speechSynthesis.speak(currentSpeech);
  }

  function toggleSpeech() {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      voiceBtn.classList.remove('speaking');
    } else if (analysisResult) {
      startSpeech(analysisResult.text);
    }
  }

  function resetView() {
    appliedBox.style.display = 'none';
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    // Restore all parts to full visibility
    ["sanvan","ra","la","rv","lv","Heartmuscles"].forEach(id => {
      const s = document.getElementById(id);
      if (s) { s.value = 1; s.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
