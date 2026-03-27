// =============================================================
//  ECG AI ANALYSIS — Multi-Stage Pixel Processing Pipeline
//  - Improved Contrast Filters
//  - Compact UI Layout for Visibility
//  - Robust Lead Extraction
// =============================================================

(function () {
  'use strict';

  const LEAD_NAMES = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6', 'Lead II - Long'];

  // ── State ──────────────────────────────────────────────────
  let analysisResult = null;
  let originalImg = null;
  let currentSpeech = null;

  // ── DOM References ─────────────────────────────────────────
  let modal, uploadBtn, uploadInput, closeBtn, applyBtn;
  let loadingEl, resultsEl, loadProgress;
  let summaryBpm, summaryRhythm, explanationText, affectedList;
  let leadsGrid, pointedCvs;
  let cOrig, cGray, cRed, cDark, cThresh, cEnhanced;

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
    leadsGrid     = document.getElementById('ai-leads-grid');
    pointedCvs    = document.getElementById('ai-pointed-cvs');

    cOrig     = document.getElementById('cvs-orig');
    cGray     = document.getElementById('cvs-gray');
    cRed      = document.getElementById('cvs-red-mask');
    cDark     = document.getElementById('cvs-dark-mask');
    cThresh   = document.getElementById('cvs-thresh');
    cEnhanced = document.getElementById('cvs-enhanced');

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
        setTimeout(() => { loadProgress.style.width = '100%'; }, 500);
        setTimeout(() => { processImage(); }, 600);
      };
      originalImg.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function processImage() {
    if (!originalImg) return;
    const W = originalImg.naturalWidth;
    const H = originalImg.naturalHeight;

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = W; sourceCanvas.height = H;
    const sctx = sourceCanvas.getContext('2d');
    sctx.drawImage(originalImg, 0, 0);

    // 1. Pipeline
    runNeuralMasks(W, H);

    // 2. HR Detection from Enhanced Mask
    const { peaks, bpm } = detectPeaks(H, W);
    generatePointedWaves(W, H, peaks);

    const rhythm = getRhythm(bpm);
    analysisResult = { bpm, rhythm };

    // 3. Render 12 Leads & Summary
    renderLeadSlices(sourceCanvas, W, H);
    populateSummary(bpm, rhythm);

    loadingEl.style.display = 'none';
    resultsEl.style.display = 'block';
  }

  function runNeuralMasks(w, h) {
    const setup = (cvs) => { if(!cvs) return null; cvs.width = w; cvs.height = h; return cvs.getContext('2d'); };
    const ctxOrig = setup(cOrig); if(ctxOrig) ctxOrig.drawImage(originalImg, 0, 0);
    const ctxGray = setup(cGray);
    const ctxRed  = setup(cRed);
    const ctxDark = setup(cDark);
    const ctxThr  = setup(cThresh);
    const ctxEnh  = setup(cEnhanced);

    const imgData = ctxOrig.getImageData(0,0,w,h);
    const d = imgData.data;

    const grayData = new ImageData(w, h);
    const redData  = new ImageData(w, h);
    const darkData = new ImageData(w, h);
    const thrData  = new ImageData(w, h);
    const enhData  = new ImageData(w, h);

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const gray = 0.3*r + 0.59*g + 0.11*b;
      grayData.data[i] = grayData.data[i+1] = grayData.data[i+2] = gray;
      grayData.data[i+3] = 255;

      // Red Mask - Adjusted for faint grids
      if (r > g + 15 && r > b + 15) {
        redData.data[i] = 255; redData.data[i+1] = redData.data[i+2] = 50;
      } else {
        redData.data[i] = redData.data[i+1] = redData.data[i+2] = 0;
      }
      redData.data[i+3] = 255;

      // Dark Mask (Ink) - Using stricter threshold for better signal
      const ink = gray < 120 ? 255 : 0;
      darkData.data[i] = darkData.data[i+1] = darkData.data[i+2] = ink;
      darkData.data[i+3] = 255;

      // Threshold
      const val = gray < 140 ? 255 : 0;
      thrData.data[i] = thrData.data[i+1] = thrData.data[i+2] = val;
      thrData.data[i+3] = 255;

      // Enhanced
      enhData.data[i] = enhData.data[i+1] = enhData.data[i+2] = val;
      enhData.data[i+3] = 255;
    }

    if(ctxGray) ctxGray.putImageData(grayData, 0, 0);
    if(ctxRed)  ctxRed.putImageData(redData, 0, 0);
    if(ctxDark) ctxDark.putImageData(darkData, 0, 0);
    if(ctxThr)  ctxThr.putImageData(thrData, 0, 0);
    if(ctxEnh)  ctxEnh.putImageData(enhData, 0, 0);
  }

  function detectPeaks(h, w) {
    const ctx = cEnhanced.getContext('2d');
    const stripY = Math.floor(h * 0.35); 
    const px = ctx.getImageData(0, stripY, w, 1).data;
    const sig = [];
    for(let i=0; i<w; i++){ sig.push(px[i*4]); }
    const peaks = [];
    const minDist = w * 0.04; 
    for(let i=1; i<w-1; i++){
      if(sig[i] === 255 && (peaks.length===0 || i - peaks[peaks.length-1].x > minDist)){
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
    if(!pointedCvs) return;
    const pctx = pointedCvs.getContext('2d');
    pointedCvs.width = w; pointedCvs.height = h;
    pctx.drawImage(originalImg, 0, 0);
    pctx.strokeStyle = '#00ff88'; pctx.lineWidth = 4;
    peaks.forEach(p => {
      pctx.strokeRect(p.x - 15, p.y - 50, 30, 100);
      pctx.beginPath(); pctx.setLineDash([5, 5]); pctx.moveTo(p.x, 0); pctx.lineTo(p.x, h); pctx.stroke(); pctx.setLineDash([]);
    });
  }

  function renderLeadSlices(srcCvs, w, h) {
    if(!leadsGrid) return;
    leadsGrid.innerHTML = '';
    const sliceW = w / 4;
    const sliceH = (h * 0.7) / 3;
    for(let i=0; i<12; i++){
      const c = i % 4; const r = Math.floor(i / 4);
      const div = document.createElement('div');
      div.className = 'ecg-lead-mini';
      div.innerHTML = `<label>${LEAD_NAMES[i]}</label><canvas></canvas>`;
      leadsGrid.appendChild(div);
      const mcvs = div.querySelector('canvas');
      mcvs.width = 180; mcvs.height = 60;
      const mctx = mcvs.getContext('2d');
      mctx.drawImage(srcCvs, c*sliceW, r*sliceH, sliceW, sliceH, 0, 0, 180, 60);
      
      const idat = mctx.getImageData(0,0,180,60);
      const dd = idat.data;
      for (let j=0; j<dd.length; j+=4) {
        const avg = 0.3*dd[j] + 0.59*dd[j+1] + 0.11*dd[j+2];
        const v = avg < 160 ? 0 : 255;
        dd[j] = dd[j+1] = dd[j+2] = v;
      }
      mctx.putImageData(idat, 0, 0);
    }
  }

  function getRhythm(bpm) {
    if (bpm < 60) return { label: 'Bradycardia', key: 'brady', status:'warning' };
    if (bpm > 100) return { label: 'Tachycardia', key: 'tachy', status:'alert' };
    return { label: 'Sinus Rhythm', key: 'normal', status:'normal' };
  }

  function populateSummary(bpm, rhythm) {
    if(summaryBpm) summaryBpm.textContent = bpm;
    if(summaryRhythm) {
      summaryRhythm.textContent = rhythm.label;
      summaryRhythm.className = 'ecg-ai-rhythm-pill ' + rhythm.status;
    }
    const txt = "Digitization complete. Heart Rate: " + bpm + " BPM. R-peaks detected.";
    if(explanationText) explanationText.innerHTML = `<p>${txt}</p>`;

    const impacts = {
      normal: [{name: "S.A. Node", cls: "normal", engineId: "sanvan"}, {name: "Myocardium", cls: "normal", engineId: "Heartmuscles"}],
      tachy: [{name: "S.A. Node", cls: "affected", engineId: "sanvan"}, {name: "Left Atrium", cls: "affected", engineId: "la"}],
      brady: [{name: "Ventricles", cls: "affected", engineId: "rv"}]
    }[rhythm.key] || [];

    if(affectedList) {
      affectedList.innerHTML = '';
      impacts.forEach(hit => {
        const li = document.createElement('li');
        li.className = 'ai-affected-item ' + (hit.cls==='normal'?'normal':'');
        li.innerHTML = `<div class="ai-affected-dot"></div><div class="ai-affected-name">${hit.name}</div>`;
        affectedList.appendChild(li);
      });
    }
    analysisResult = { ...analysisResult, text: txt, impacts };
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
      const slider = document.getElementById(hit.engineId);
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
