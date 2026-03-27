// --- WebGL Injector logic removed; native engine handling only ---

// ----------------------------------------------------------------------
// Dual Wave ECG Scanner (Minimal Clinical Version)
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// Heart Sound Synthesizer (Web Audio API)
// ----------------------------------------------------------------------
class HeartSound {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.bpm = 60;
        this.nextNoteTime = 0;
        this.timerID = null;
        this.isPlaying = false;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.enabled = true;
    }

    setBPM(bpm) {
        this.bpm = bpm;
    }

    scheduleNote(time) {
        if (!this.ctx) return;

        // Sound Characteristics
        // "Lub" (S1) - Lower, deeper
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);

        osc1.frequency.setValueAtTime(150, time);
        osc1.frequency.exponentialRampToValueAtTime(50, time + 0.1);
        gain1.gain.setValueAtTime(0.7, time);
        gain1.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        osc1.start(time);
        osc1.stop(time + 0.2);

        // "Dub" (S2) - Higher, sharper, delayed
        // Timing: S1 -> S2 is roughly 0.35s at 60BPM, scales slightly
        // We'll use a proportional delay to ensure it doesn't overlap at high BPM
        const beatDuration = 60 / this.bpm;
        const s2Delay = Math.min(0.35, beatDuration * 0.45);

        const t2 = time + s2Delay;

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);

        osc2.frequency.setValueAtTime(180, t2);
        osc2.frequency.exponentialRampToValueAtTime(60, t2 + 0.1);
        gain2.gain.setValueAtTime(0.5, t2);
        gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.12);

        osc2.start(t2);
        osc2.stop(t2 + 0.2);
    }

    scheduler() {
        if (!this.isPlaying || !this.ctx) return;

        // Schedule ahead
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.nextNoteTime);
            const secondsPerBeat = 60.0 / this.bpm;
            this.nextNoteTime += secondsPerBeat;
        }
        this.timerID = requestAnimationFrame(this.scheduler.bind(this));
    }

    start() {
        if (!this.enabled) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerID) cancelAnimationFrame(this.timerID);
    }
}

// ----------------------------------------------------------------------
// Dual Wave ECG Scanner (Minimal Clinical Version)
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// Heart Sound Player (WAV File)
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// Audio Controller (MP3 Synchronization)
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// Audio Controller (MP3 Synchronization)
// ----------------------------------------------------------------------
class AudioController {
    constructor(src) {
        this.ctx = null;
        this.enabled = false;
        this.buffer = null;
        this.src = src;
        this.muted = false;
        this.bpm = 72;
    }

    async init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.enabled = true;

        // Register for global unlock
        if (!window.audioContexts) window.audioContexts = [];
        window.audioContexts.push(this.ctx);

        try {
            const response = await fetch(this.src);
            const arrayBuffer = await response.arrayBuffer();
            this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error("Audio Load Failed:", e);
        }
    }

    setBPM(bpm) {
        this.bpm = bpm;
    }

    toggleMute() {
        this.muted = !this.muted;
        // Strict suspending for better performance and guaranteed silence
        if (this.ctx) {
            if (this.muted) this.ctx.suspend();
            else this.ctx.resume();
        }
        return this.muted;
    }

    playBeat() {
        // STRICT MUTE CHECK
        if (this.muted) return;
        if (!this.ctx || !this.buffer) return;

        // If the context is suspended, we can't play. 
        // Modern browsers require a user gesture to resume.
        if (this.ctx.state === 'suspended') {
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffer;
        source.playbackRate.value = 1.0;
        source.connect(this.ctx.destination);
        source.start(0);
    }

    onBeatStart() {
        // Only initialize if we've had a user gesture
        if (!this.enabled && window.hasUserGestured) {
            this.init();
        }
        this.playBeat();
    }
}

// ----------------------------------------------------------------------
// Dual Wave ECG Scanner (Minimal Clinical Version)
// ----------------------------------------------------------------------
class DualECGScanner {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Audio System
        this.audio = new AudioController('./assets/heartbeat-clean.wav');

        // Link to Controls
        this.speedSlider = document.getElementById('speed');
        this.bpmSlider = document.getElementById('bpm-input');
        this.bpmDisplay = document.getElementById('bpm-display');
        this.muteBtn = document.getElementById('mute-btn');

        // Settings
        this.baseBpm = 72;

        // Mute Button Logic
        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', () => {
                const isMuted = this.audio.toggleMute();
                if (isMuted) {
                    this.muteBtn.classList.add('muted');
                    this.muteBtn.innerHTML = `
                        <!-- Muted Icon -->
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>`;
                } else {
                    this.muteBtn.classList.remove('muted');
                    this.muteBtn.innerHTML = `
                        <!-- Speaker Icon -->
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <path id="sound-waves" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>`;
                    // Try to init context on unmute click if not already
                    if (!this.audio.enabled) this.audio.init();
                }
            });
        }

        // Initialize from UI
        if (this.bpmSlider) {
            this.baseBpm = parseFloat(this.bpmSlider.value);
            this.audio.setBPM(this.baseBpm);

            // Initial Sync
            if (this.speedSlider) {
                const engineSpeed = this.baseBpm / 90;
                this.speedSlider.value = engineSpeed;
                this.speedSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }

            this.bpmSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.baseBpm = val;
                this.bpm = this.baseBpm; // Immediate update
                this.audio.setBPM(val);

                // Update Display
                if (this.bpmDisplay) {
                    this.bpmDisplay.innerText = val;
                }

                // Sync with 3D Engine
                if (this.speedSlider) {
                    const engineSpeed = val / 90;
                    this.speedSlider.value = engineSpeed;
                    this.speedSlider.dispatchEvent(new Event('input', { bubbles: true }));
                    this.speedSlider.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Initialize audio context on manipulation if needed
                if (!this.audio.enabled) this.audio.init();
            });
        }

        this.bpm = this.baseBpm;
        this.speed = 2; // Slower, more clinical scan speed
        this.x = 0;

        // Clinical Colors
        this.colorElec = '#3b82f6'; // Clinical Blue
        this.colorMech = '#10b981'; // Success Green / Vital

        // Simulation State
        this.lastBeatTime = 0;
        this.isBeating = false;
        this.waveIndex = 0;

        // Y Positions
        this.baseElec = 0;
        this.baseMech = 0;
        this.scale = 1;

        this.pyElectric = 0; // Previous Y
        this.pyMechanical = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.loop();
    }

    resize() {
        // Full resolution
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);

        this.width = rect.width;
        this.height = rect.height;

        this.baseElec = this.height * 0.35; // Electrical on top
        this.baseMech = this.height * 0.75; // Mechanical on bottom
        this.scale = - (this.height * 0.25); // Slightly smaller scale for separation

        // Clear canvas initially
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.pyElectric = this.baseElec;
        this.pyMechanical = this.baseMech;
    }

    // --- Signal Generators ---

    // --- Signal Generators ---

    // Helper for Bell Curve
    gaussian(t, center, width, height) {
        return height * Math.exp(-Math.pow(t - center, 2) / (2 * Math.pow(width, 2)));
    }

    getElectricalSignal(t) {
        // Realistic P-QRS-T complex
        let signal = 0;

        // P Wave (Atrial Depolarization)
        signal += this.gaussian(t, 0.15, 0.02, 0.15);

        // Q Wave (Septal Depolarization) - small dip
        signal -= this.gaussian(t, 0.28, 0.005, 0.1);

        // R Wave (Ventricular Depolarization) - sharp peak
        signal += this.gaussian(t, 0.30, 0.005, 1.2);

        // S Wave (Basal Depolarization) - dip
        signal -= this.gaussian(t, 0.32, 0.005, 0.2);

        // T Wave (Ventricular Repolarization) - broad bump
        signal += this.gaussian(t, 0.60, 0.04, 0.3);

        // Baseline noise
        signal += (Math.random() - 0.5) * 0.02;

        return signal;
    }

    getMechanicalSignal(t) {
        // Arterial Pressure Pulse (Mechanical)
        // Delayed after QRS
        let signal = 0;

        // Systolic Peak (Pulse)
        // Starts rising around 0.35 (after R-wave), peaks around 0.5
        if (t > 0.35 && t < 0.65) {
            // Asymmetric rise/fall
            let phase = (t - 0.35) / 0.30; // 0 to 1
            signal = Math.sin(phase * Math.PI) * 0.8;
            // Dicrotic notch rough approximation
            if (phase > 0.7) signal += 0.1;
        }

        // Dicrotic notch refinement
        signal += this.gaussian(t, 0.68, 0.03, 0.15); // The notch bump

        // Smooth out
        signal *= 0.6; // Scale down slightly relative to ECG

        return signal;
    }

    loop() {
        requestAnimationFrame(() => this.loop());

        const now = Date.now();
        const rrInterval = 60000 / this.bpm;

        // Beat Trigger
        if (!this.isBeating && now - this.lastBeatTime > rrInterval) {
            this.isBeating = true;
            this.lastBeatTime = now;
            // Slight clinical variance (RSA)
            this.bpm = this.baseBpm + (Math.random() * 5) - 2.5;

            const bpmObj = document.getElementById('ecg-bpm-val');
            if (bpmObj) bpmObj.innerText = Math.round(this.bpm);

            // Play Sound Synced with Animation Start
            if (this.audio) this.audio.onBeatStart();
        }

        // Calculate beat progress 't'
        let t = 0;
        if (this.isBeating) {
            const elapsed = now - this.lastBeatTime;
            // Scale duration based on BPM relative to 72 BPM
            // at 72 BPM, duration is ~800ms
            const duration = 800 * (72 / this.bpm);
            t = elapsed / duration;
            if (t > 1) {
                this.isBeating = false;
                t = 0;
            }
        }

        const valElec = this.getElectricalSignal(t);
        const yElec = this.baseElec + (valElec * this.scale);

        const valMech = this.getMechanicalSignal(t);
        const yMech = this.baseMech + (valMech * this.scale);

        // --- Drawing: Wipe Effect ---
        const head = 5;
        this.ctx.clearRect(this.x, 0, head, this.height);

        // Scan Line
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(this.x + head - 2, 0, 2, this.height);

        // Draw Lines
        if (this.x > this.speed) {
            // Electrical (ECG) - Blue
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.colorElec;
            this.ctx.lineWidth = 2; // Stronger line
            this.ctx.lineCap = 'round';
            this.ctx.moveTo(this.x - this.speed, this.pyElectric);
            this.ctx.lineTo(this.x, yElec);
            this.ctx.stroke();

            // Mechanical (Pulse) - Green
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.colorMech;
            this.ctx.lineWidth = 2;
            this.ctx.lineCap = 'round';
            this.ctx.moveTo(this.x - this.speed, this.pyMechanical);
            this.ctx.lineTo(this.x, yMech);
            this.ctx.stroke();
        }

        // Update State
        this.pyElectric = yElec;
        this.pyMechanical = yMech;

        this.x += this.speed;
        if (this.x > this.width) {
            this.x = 0;
            this.pyElectric = yElec;
            this.pyMechanical = yMech;
        }
    }
}

// ----------------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------------

function init() {
    // Start ECG
    new DualECGScanner('ecg-canvas');

    // Remove wait screen immediately (Engine usually handles this, but just in case)
    const ws = document.getElementById('wait-screen');
    if (ws) {
        setTimeout(() => {
            ws.style.opacity = '0';
            setTimeout(() => ws.style.display = 'none', 500);
        }, 1000);
    }

    // --- Visibility Toggle Logic ---
    const visToggles = document.querySelectorAll('.vis-toggle');
    visToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const slider = document.getElementById(targetId);

            if (!slider) return;

            // Check current state
            const currentVal = parseFloat(slider.value);

            if (currentVal > 0) {
                // HIDE: Store value, set to 0
                slider.dataset.lastValue = currentVal;
                slider.value = 0;
                btn.classList.add('hidden-state');
            } else {
                // SHOW: Restore value
                const lastVal = parseFloat(slider.dataset.lastValue || 1);
                slider.value = lastVal;
                btn.classList.remove('hidden-state');
            }

            // Dispatch event for Engine
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });
}

// --- View Mode Logic ---
function initViewModes() {
    const btns = document.querySelectorAll('.mode-btn');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            btns.forEach(b => b.classList.remove('active'));
            // Add to clicked
            btn.classList.add('active');

            const mode = btn.dataset.mode;
            console.log("Switching view mode to:", mode);

            // MOCK: Dispatch event for engine or trigger visual change
            // Since we don't have engine access, we'll simulate opacity changes
            const canvas = document.getElementById('canvas-container');
            if (mode === 'wireframe') {
                // Use SVG Edge Detection Filter for "Fake Wireframe"
                // This makes the background (gradients) black and edges bright
                canvas.style.filter = "url(#svg-wireframe) contrast(1.5) brightness(1.5)";
            } else {
                canvas.style.filter = "none";
            }
        });
    });
}

// --- Mouse Interaction Logic ---
function initInteraction() {
    const canvas = document.getElementById('canvas-container'); // This is the wrapper, engine creates canvas inside
    const labelBox = document.getElementById('hover-label');
    const partName = document.getElementById('part-name');

    document.addEventListener('mousemove', (e) => {
        // Floating tooltip follows cursor
        if (labelBox) {
            labelBox.style.left = (e.clientX + 20) + 'px';
            labelBox.style.top = (e.clientY + 20) + 'px';
        }

        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        // Detect if hovering over the central 3D viewer area
        // Exclude the sidebar (left 300px) and right monitor
        const sidebarWidth = 300 / window.innerWidth;

        if (x > sidebarWidth && x < 0.8 && y > 0.1 && y < 0.9) {
            if (labelBox) labelBox.classList.add('active');

            // Simplified Anatomical Regions (Viewer Perspective)
            // Left Side of Screen = Patient's Right Heart
            // Right Side of Screen = Patient's Left Heart

            const midX = sidebarWidth + (0.8 - sidebarWidth) * 0.5;

            if (partName) {
                if (x < midX) {
                    // Right Heart Zone (Patient's Right, Viewer's Left)
                    if (y < 0.45) partName.innerText = "Superior Vena Cava / RA";
                    else if (y < 0.6) partName.innerText = "Right Atrium";
                    else partName.innerText = "Right Ventricle";
                } else {
                    // Left Heart Zone (Patient's Left, Viewer's Right)
                    if (y < 0.4) partName.innerText = "Aorta / Pulmonary Artery";
                    else if (y < 0.6) partName.innerText = "Left Atrium";
                    else partName.innerText = "Left Ventricle";
                }
            }
        } else {
            if (labelBox) labelBox.classList.remove('active');
        }
    });
}

// --- Moved to ecg-analysis.js ---
function initECGUpload() {
    // Logic migrated to specialized digitizer module.
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    initInteraction();
    initViewModes();
    initECGUpload();

    // Global listener to unlock audio on first interaction
    const unlockAudio = () => {
        window.hasUserGestured = true;
        // We'll resume any context that might have been suspended
        if (window.audioContexts) {
            window.audioContexts.forEach(ctx => {
                if (ctx.state === 'suspended') ctx.resume();
            });
        }
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
});
