import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { apiService } from '../../services/api';
import './session.css';

interface Ctx { patientId: string; patientName: string; }
type Phase   = 'IDLE'|'CALIBRATING'|'INHALE'|'HOLD'|'EXHALE';
type Verdict = 'Idle'|'Good Breath'|'Apical Fault';

const PC: Record<Phase,string> = {
  IDLE:'#6366f1', CALIBRATING:'#f59e0b', INHALE:'#10b981', HOLD:'#3b82f6', EXHALE:'#a78bfa'
};

export default function BreathingSession() {
  const { patientId } = useOutletContext<Ctx>();

  // ── UI state ──────────────────────────────────────────────────
  const [running,   setRunning]   = useState(false);
  const [phase,     setPhase]     = useState<Phase>('IDLE');
  const [verdict,   setVerdict]   = useState<Verdict>('Idle');
  const [elapsed,   setElapsed]   = useState(0);
  const [ready,     setReady]     = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [showHist,  setShowHist]  = useState(false);
  const [history,   setHistory]   = useState<any[]>([]);
  const [status,    setStatus]    = useState('Loading model…');

  // ── Metrics ───────────────────────────────────────────────────
  const [bpm,     setBpm]     = useState(0);
  const [depth,   setDepth]   = useState(0);
  const [goodPct, setGoodPct] = useState(0);
  const [total,   setTotal]   = useState(0);
  const [excur,   setExcur]   = useState(0);
  const [tech,    setTech]    = useState(0);

  // ── Signals ───────────────────────────────────────────────────
  const [sigSh, setSigSh] = useState<number[]>(Array(80).fill(0));
  const [sigAb, setSigAb] = useState<number[]>(Array(80).fill(0));

  // ── Refs ──────────────────────────────────────────────────────
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef   = useRef<PoseLandmarker|null>(null);
  const animRef   = useRef(0);
  const timerRef  = useRef<ReturnType<typeof setInterval>|null>(null);
  const startRef  = useRef<Date|null>(null);

  // All loop state in one ref — zero stale-closure issues
  const L = useRef({
    calib: 0, 
    baseSh: 0, 
    baseAb: 0,
    bufSh: Array(80).fill(0) as number[],
    bufAb: Array(80).fill(0) as number[],
    prev: 0, 
    dir: 1, 
    lastPeak: 0,
    stamps: [] as number[],
    good: 0, 
    tot: 0,
    pFrame: 0, 
    lastVT: -1,
    phaseRef: 'IDLE' as Phase,
    lastSpeak: 0, // Debounce for voice
  });

  // ── Load MediaPipe (CDN WASM + CDN model) ─────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        setStatus('Loading WASM…');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        setStatus('Loading pose model…');

        const tryLoad = async (delegate: 'GPU'|'CPU') =>
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate,
            },
            runningMode: 'VIDEO',
            numPoses: 1,
          });

        try        { poseRef.current = await tryLoad('GPU'); }
        catch (gpuErr) {
          console.warn('GPU delegate failed, trying CPU:', gpuErr);
          poseRef.current = await tryLoad('CPU'); 
        }

        if (!dead) { setReady(true); setStatus('Ready'); }
      } catch (e: any) {
        console.error('BreathingSession Init Error:', e);
      }
    })();
    return () => { dead = true; poseRef.current?.close(); };
  }, []);

  // ── History ────────────────────────────────────────────────────
  useEffect(() => {
    apiService.getPatientSessions(patientId)
      .then(r => setHistory(r.data.slice(0, 6)))
      .catch(() => {});
  }, [patientId, saved]);

  // ── Helpers ───────────────────────────────────────────────────
  const fmt = (s: number) =>
    `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const ewma = (buf: number[], v: number, a=0.15) => // Slightly more smoothing
    buf[buf.length-1]*(1-a) + v*a;

  // ── Voice Assistant ──────────────────────────────────────────
  const speak = (text: string, force = false) => {
    if (!window.speechSynthesis) return;
    const now = Date.now();
    // Prevent rapid-fire speech unless forced
    if (!force && now - L.current.lastSpeak < 2000) return; 

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slower, more professional pace
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    L.current.lastSpeak = now;
  };

  // ── Animation loop ────────────────────────────────────────────
  const loop = () => {
    const vid = videoRef.current, cvs = canvasRef.current;
    if (!vid || !cvs) { animRef.current = requestAnimationFrame(loop); return; }

    const ctx = cvs.getContext('2d')!;
    if (vid.videoWidth) { cvs.width = vid.videoWidth; cvs.height = vid.videoHeight; }
    ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);

    const l = L.current, now = performance.now();

    if (poseRef.current && vid.readyState >= 2 && vid.currentTime !== l.lastVT) {
      l.lastVT = vid.currentTime;
      const res = poseRef.current.detectForVideo(vid, now);

      if (res.landmarks.length > 0) {
        const lm = res.landmarks[0];
        const draw = new DrawingUtils(ctx);
        
        // Draw Pose (Vibrant & Solid)
        draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS,
          { color: '#38bdf8', lineWidth: 3 });
        draw.drawLandmarks(lm, 
          { color: '#00ff96', fillColor: '#00ff96', radius: 4, lineWidth: 2 });
        
        // Highlight core tracking points with larger markers
        draw.drawLandmarks([lm[11], lm[12], lm[23], lm[24]], 
          { color: '#fff', fillColor: '#00ff96', radius: 6, lineWidth: 3 });

        // Calculate stable torso points
        // We use an average of shoulders and hips to estimate chest and abdomen excursion
        const shY = (lm[11].y + lm[12].y) / 2;
        const hipY = (lm[23].y + lm[24].y) / 2;
        
        // Abdomen is estimated at ~65% of the way down from shoulders to hips
        const abY = shY * 0.35 + hipY * 0.65;

        // ── Calibration ────────────────────────────────────────
        if (l.calib < 80) { // Longer calibration for stability
          l.calib++;
          l.baseSh += shY/80;
          l.baseAb += abY/80;
          l.phaseRef = 'CALIBRATING';
          if (l.calib === 1) {
            setPhase('CALIBRATING');
            speak("Calibration starting. Please stand still.", true);
          }
          if (l.calib === 80) speak("Calibration complete. Start breathing with your belly.", true);
          
          // Calibration Overlay
          ctx.fillStyle = 'rgba(245,158,11,0.2)';
          ctx.fillRect(0, cvs.height-48, cvs.width*(l.calib/80), 4);
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(0, cvs.height-44, cvs.width, 44);
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 16px Inter,sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Calibrating torso… ${Math.round(l.calib/80*100)}%`, cvs.width/2, cvs.height-16);

        } else {
          // ── Detection ─────────────────────────────────────────
          // Normalize movement relative to calibration baseline
          const rawSh = (shY - l.baseSh) * 250;
          const rawAb = (abY - l.baseAb) * 250;
          
          const smSh = ewma(l.bufSh, rawSh);
          const smAb = ewma(l.bufAb, rawAb);
          
          l.bufSh.shift(); l.bufSh.push(smSh);
          l.bufAb.shift(); l.bufAb.push(smAb);
          setSigSh([...l.bufSh]);
          setSigAb([...l.bufAb]);

          const ampAb = Math.abs(smAb);
          const ampSh = Math.abs(smSh);
          
          // Visual feedback for excursion
          setExcur(Math.min(100, Math.round(ampAb * 8)));
          setDepth(Math.min(100, Math.round(ampAb * 5.5)));

          // Robust Breath Counting (Zero-crossing with Hysteresis)
          const threshold = 1.5; 
          const curDir = smAb > l.prev ? 1 : -1;
          
          if (curDir !== l.dir && ampAb > threshold) {
            if (l.dir === 1) { // Peak detected
              const gap = now - l.lastPeak;
              if (l.lastPeak > 0 && gap > 2000 && gap < 10000) {
                l.tot++;
                l.stamps.push(now);
                if (l.stamps.length > 10) l.stamps.shift();
                
                // Technique check: Shoulder movement vs Abdominal movement
                // If shoulder movement is more than 60% of abdominal, it's an apical fault
                const ratio = ampSh / (ampAb + 0.001);
                const isGood = ratio < 0.6 && ampAb > 2.0;
                
                if (isGood) {
                  l.good++;
                  speak("Excellent breath.");
                } else {
                  speak("Focus on your belly, keep shoulders still.");
                }
                
                const gp = Math.round(l.good / l.tot * 100);
                setTotal(l.tot); 
                setGoodPct(gp); 
                setTech(gp);
                setVerdict(isGood ? 'Good Breath' : 'Apical Fault');
                
                if (l.stamps.length >= 2) {
                  const span = (l.stamps[l.stamps.length-1] - l.stamps[0]) / 60000;
                  setBpm(Math.round((l.stamps.length-1) / span));
                }
              }
              l.lastPeak = now;
            }
            l.dir = curDir;
          }
          l.prev = smAb;

          // Phase Guidance (Slow 6-second cycle: 2s In, 1s Hold, 3s Out)
          l.pFrame++;
          const cycle = l.pFrame % 180; // 60fps * 3s
          let p: Phase = 'INHALE';
          if (cycle < 60) p = 'INHALE';
          else if (cycle < 90) p = 'HOLD';
          else p = 'EXHALE';

          if (p !== l.phaseRef) { 
            l.phaseRef = p; 
            setPhase(p); 
            if (p === 'INHALE') speak("Breathe in.");
            if (p === 'HOLD') speak("Hold.");
            if (p === 'EXHALE') speak("Breathe out.");
          }

          // Top Overlay (Real-time Feedback)
          const isGoodNow = (ampSh / (ampAb + 0.001)) < 0.6 && ampAb > 1.0;
          ctx.fillStyle = isGoodNow ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)';
          ctx.fillRect(0,0,cvs.width,44);
          ctx.fillStyle = isGoodNow ? '#10b981' : '#ef4444';
          ctx.font = 'bold 14px Inter,sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(
            isGoodNow ? '✓ Proper Diaphragmatic Form' : '⚠ Using Shoulders — Relax Them',
            16, 28
          );

          // Bottom Phase Overlay
          const phColors: Record<Phase,string> = PC as any;
          const phLabels: Record<Phase,string> = {
            IDLE:'', CALIBRATING:'',
            INHALE:'🌬  BREATHE IN DEEP',
            HOLD:'⏸  HOLD BREATH',
            EXHALE:'💨  EXHALE SLOWLY',
          };
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillRect(0, cvs.height-52, cvs.width, 52);
          ctx.fillStyle = phColors[p] || '#fff';
          ctx.font = 'bold 18px Inter,sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(phLabels[p] || '', cvs.width/2, cvs.height-20);
        }
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px Inter,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠  Position your body in frame', cvs.width/2, cvs.height/2);
      }
    }
    animRef.current = requestAnimationFrame(loop);
  };

  // ── Start/Stop/Recal ──────────────────────────────────────────
  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal:1280 }, height: { ideal:720 }, facingMode:'user' },
        audio: false,
      });
      const vid = videoRef.current!;
      vid.srcObject = stream;
      vid.onloadedmetadata = () => vid.play();
      startRef.current = new Date();
      setSaved(false); setRunning(true); setElapsed(0);
      setTotal(0); setBpm(0); setDepth(0); setGoodPct(0); setTech(0); setExcur(0);
      setVerdict('Idle'); setPhase('CALIBRATING');
      Object.assign(L.current, {
        calib:0, baseSh:0, baseAb:0,
        bufSh:Array(80).fill(0), bufAb:Array(80).fill(0),
        prev:0, dir:1, lastPeak:0, stamps:[],
        good:0, tot:0, pFrame:0, lastVT:-1, phaseRef:'CALIBRATING', lastSpeak: 0
      });
      timerRef.current = setInterval(() => setElapsed(e=>e+1), 1000);
      animRef.current  = requestAnimationFrame(loop);
    } catch { alert('Camera access denied. Please enable camera in settings.'); }
  };

  const handleStop = async () => {
    setRunning(false); setPhase('IDLE');
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);
    if (videoRef.current?.srcObject)
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());
    
    if (startRef.current) {
      try {
        await apiService.uploadSession({
          patient_id: patientId,
          started_at: startRef.current.toISOString() as any,
          ended_at:   new Date().toISOString() as any,
          exercise_type: 'diaphragmatic',
          total_breaths: L.current.tot,
          good_breath_pct: tech, avg_bpm: bpm||undefined,
          avg_depth_score: depth/100, session_terminated_early: false,
        });
        setSaved(true);
        setHistory(h => [{ id: Date.now(), started_at: startRef.current!.toISOString(),
          total_breaths: L.current.tot, good_breath_pct: tech, avg_bpm: bpm,
          exercise_type: 'diaphragmatic' }, ...h.slice(0,5)]);
      } catch (err: any) {
        alert(`❌ Data sync failed: ${err?.message || 'Network error'}`);
      }
    }
  };

  const recal = () => { Object.assign(L.current,{calib:0,baseSh:0,baseAb:0}); setPhase('CALIBRATING'); };

  const pts = (d: number[], h: number) =>
    d.map((v,i)=>`${(i/(d.length-1))*300},${h/2-v*2.2}`).join(' ');

  const pc = PC[phase], vc = verdict==='Good Breath'?'#10b981':verdict==='Apical Fault'?'#ef4444':'#6b7280';

  return (
    <div className="bs-shell">
      <div className="bs-layout">
        <div className="bs-video-col">
          <div className="bs-badge" style={{background:`${vc}20`,borderColor:`${vc}55`,color:vc}}>
            <span className="bs-dot" style={{background:vc}}/>{verdict}
          </div>
          <div className="bs-canvas-wrap">
            <video ref={videoRef} playsInline muted style={{position:'absolute',width:'1px',height:'1px',opacity:0}}/>
            <canvas ref={canvasRef} className="bs-canvas"/>
            {!running && (
              <div className="bs-idle-overlay">
                <div style={{fontSize:72,marginBottom:16}}>🫁</div>
                <div className="bs-idle-title">Smart Breathing Coach</div>
                <div className="bs-idle-sub">Powered by MediaPipe AI</div>
                <div className="bs-status-pill" style={{ color: ready?'#10b981':'#f59e0b', borderColor: ready?'#10b981':'#f59e0b' }}>
                  {ready ? '✓ AI Engine Ready' : `⏳ ${status}`}
                </div>
                <div className="bs-idle-tips">
                  <span>💡 Side-on view works best</span>
                  <span>💡 Keep your shoulders relaxed</span>
                  <span>💡 Watch the belly-breathing guide</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bs-panel">
          <div className="bs-panel-top">
            <div><div className="bs-timer-label">SESSION</div><div className="bs-timer-val">{fmt(elapsed)}</div></div>
            <div className="bs-phase-chip" style={{background:`${pc}22`,color:pc,borderColor:`${pc}55`}}>{phase}</div>
            <button className="bs-hist-btn" onClick={()=>setShowHist(v=>!v)}>📋 History</button>
          </div>

          <div className="bs-metrics">
            {[
              {l:'RATE (BPM)',    v:bpm,          c:'#10b981'},
              {l:'ABDOMINAL DEPTH', v:depth,       c:'#3b82f6'},
              {l:'GOOD BREATHS',  v:`${goodPct}%`, c:'#8b5cf6'},
              {l:'TOTAL BREATHS', v:total,          c:'#f59e0b'},
            ].map(m=>(
              <div key={m.l} className="bs-metric-card">
                <div className="bs-metric-val" style={{color:m.c}}>{m.v}</div>
                <div className="bs-metric-lbl">{m.l}</div>
              </div>
            ))}
          </div>

          <div className="bs-excursion-block">
            <div className="bs-excursion-head"><span>Belly Movement</span><span style={{color:pc}}>{Math.round(excur)}%</span></div>
            <div className="bs-excursion-track"><div className="bs-excursion-fill" style={{width:`${excur}%`,background:pc}}/></div>
          </div>

          <div className="bs-ring-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9"/>
              <circle cx="55" cy="55" r="44" fill="none" stroke={pc} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${tech*2.765} 276.5`} strokeDashoffset="69.1" style={{transition:'stroke-dasharray 0.6s ease'}}/>
            </svg>
            <div className="bs-ring-inner"><div style={{fontSize:22,fontWeight:800,color:pc}}>{tech}%</div><div style={{fontSize:9,color:'#8892a4'}}>TECHNIQUE</div></div>
          </div>

          <div className="bs-signal-card">
            <div className="bs-signal-legend"><span style={{color:'#38bdf8'}}>Shoulder</span><span style={{color:'#10b981'}}>Abdomen</span></div>
            <svg width="100%" height="72" viewBox="0 0 300 72" preserveAspectRatio="none">
              <polyline points={pts(sigSh,72)} fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6"/>
              <polyline points={pts(sigAb,72)} fill="none" stroke="#10b981" strokeWidth="2.5"/>
            </svg>
          </div>

          {!running ? (
            <button className="bs-start-btn" onClick={handleStart} disabled={!ready}>▶  Start Coaching</button>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <button className="bs-stop-btn"  onClick={handleStop}>⏹  Finish Session</button>
              <button className="bs-recal-btn" onClick={recal}>↺  Reset Sensor</button>
            </div>
          )}
        </div>
      </div>

      {showHist && (
        <div className="bs-history">
          <div className="bs-history-title">Previous Sessions</div>
          {history.map((s,i)=>(
            <div key={s.id??i} className="bs-history-row">
              <div><div style={{fontSize:13,fontWeight:600}}>{Math.round(s.good_breath_pct)}% accuracy · {s.total_breaths} breaths</div><div style={{fontSize:11,color:'#8892a4'}}>{new Date(s.started_at).toLocaleString()}</div></div>
              <div style={{fontSize:18,fontWeight:800,color:s.good_breath_pct>=75?'#10b981':'#f59e0b'}}>{Math.round(s.good_breath_pct)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
