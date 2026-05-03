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
  const [initErr,   setInitErr]   = useState('');
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
    calib: 0, baseSh: 0, baseAb: 0,
    bufSh: Array(80).fill(0) as number[],
    bufAb: Array(80).fill(0) as number[],
    prev: 0, dir: 1, lastPeak: 0,
    stamps: [] as number[],
    good: 0, tot: 0,
    pFrame: 0, lastVT: -1,
    phaseRef: 'IDLE' as Phase,
  });

  // ── Load MediaPipe (CDN WASM + CDN model) ─────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        setStatus('Loading WASM…');
        // Use CDN for WASM and helper scripts to ensure availability in production
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'
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
        catch      { poseRef.current = await tryLoad('CPU'); }

        if (!dead) { setReady(true); setStatus('Ready'); }
      } catch (e: any) {
        if (!dead) setInitErr(String(e?.message || e));
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

  const ewma = (buf: number[], v: number, a=0.18) =>
    buf[buf.length-1]*(1-a) + v*a;

  // ── Animation loop (defined once, no stale captures) ──────────
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
        draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS,
          { color: 'rgba(56,189,248,0.8)', lineWidth: 2 });
        draw.drawLandmarks(lm,
          { color: '#00ff96', fillColor: 'rgba(0,255,150,0.25)', radius: 4, lineWidth: 1 });

        const shY = (lm[11].y + lm[12].y) / 2;
        const abY = shY*0.38 + (lm[23].y+lm[24].y)/2*0.62;

        // ── Calibration ────────────────────────────────────────
        if (l.calib < 60) {
          l.calib++;
          l.baseSh += shY/60;
          l.baseAb += abY/60;
          l.phaseRef = 'CALIBRATING';
          setPhase('CALIBRATING');
          // progress bar
          ctx.fillStyle = 'rgba(245,158,11,0.2)';
          ctx.fillRect(0, cvs.height-48, cvs.width*(l.calib/60), 4);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(0, cvs.height-44, cvs.width, 44);
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 15px Inter,sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Calibrating… ${l.calib}/60`, cvs.width/2, cvs.height-16);

        } else {
          // ── Detection ─────────────────────────────────────────
          const rawSh = (shY - l.baseSh)*200;
          const rawAb = (abY - l.baseAb)*200;
          const smSh = ewma(l.bufSh, rawSh);
          const smAb = ewma(l.bufAb, rawAb);
          l.bufSh.shift(); l.bufSh.push(smSh);
          l.bufAb.shift(); l.bufAb.push(smAb);
          setSigSh([...l.bufSh]);
          setSigAb([...l.bufAb]);

          const ampAb = Math.abs(smAb), ampSh = Math.abs(smSh);
          setExcur(Math.min(100, Math.round(ampAb*9)));
          setDepth(Math.min(100, Math.round(ampAb*6)));

          // Zero-crossing breath counter
          const curDir = smAb > l.prev ? 1 : -1;
          if (curDir !== l.dir && ampAb > 1.2) {
            if (l.dir === 1) { // just hit peak → one breath
              const gap = now - l.lastPeak;
              if (l.lastPeak > 0 && gap > 1800 && gap < 12000) {
                l.tot++;
                l.stamps.push(now);
                if (l.stamps.length > 10) l.stamps.shift();
                const isGood = (ampSh/(ampAb+.001)) < 0.55 && ampAb > 1.8;
                if (isGood) l.good++;
                const gp = Math.round(l.good/l.tot*100);
                setTotal(l.tot); setGoodPct(gp); setTech(gp);
                setVerdict(isGood ? 'Good Breath' : 'Apical Fault');
                if (l.stamps.length >= 2) {
                  const span = (l.stamps[l.stamps.length-1]-l.stamps[0])/60000;
                  setBpm(Math.min(40,Math.max(4,Math.round((l.stamps.length-1)/span))));
                }
              }
              l.lastPeak = now;
            }
            l.dir = curDir;
          }
          l.prev = smAb;

          // Phase cycling (visual guide)
          l.pFrame++;
          const f = l.pFrame % 90;
          const p: Phase = f < 36 ? 'INHALE' : f < 50 ? 'HOLD' : 'EXHALE';
          if (p !== l.phaseRef) { l.phaseRef = p; setPhase(p); }

          // Verdict badge on canvas
          const isGoodNow = (ampSh/(ampAb+.001)) < 0.55 && ampAb > 1.2;
          ctx.fillStyle = isGoodNow ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)';
          ctx.fillRect(0,0,cvs.width,40);
          ctx.fillStyle = isGoodNow ? '#10b981' : '#ef4444';
          ctx.font = 'bold 13px Inter,sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(
            isGoodNow ? '✓ Diaphragm active — good breath' : '⚠ Apical fault — relax shoulders',
            12, 26
          );

          // Phase coaching at bottom
          const phColors: Record<Phase,string> = PC as any;
          const phLabels: Record<Phase,string> = {
            IDLE:'', CALIBRATING:'',
            INHALE:'🌬  INHALE — belly rises',
            HOLD:'⏸  HOLD — stay still',
            EXHALE:'💨  EXHALE — slow release',
          };
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(0, cvs.height-48, cvs.width, 48);
          ctx.fillStyle = phColors[p] || '#fff';
          ctx.font = 'bold 16px Inter,sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(phLabels[p] || '', cvs.width/2, cvs.height-18);
        }
      } else {
        // No person
        ctx.fillStyle = 'rgba(239,68,68,0.12)';
        ctx.fillRect(0,0,cvs.width,40);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 13px Inter,sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('⚠  No person detected — step into frame', 12, 26);
      }
    }
    animRef.current = requestAnimationFrame(loop);
  };

  // ── Start ──────────────────────────────────────────────────────
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
        good:0, tot:0, pFrame:0, lastVT:-1, phaseRef:'CALIBRATING',
      });
      timerRef.current = setInterval(() => setElapsed(e=>e+1), 1000);
      animRef.current  = requestAnimationFrame(loop);
    } catch { alert('Camera permission required. Please allow camera access.'); }
  };

  // ── Stop ───────────────────────────────────────────────────────
  const handleStop = async () => {
    setRunning(false); setPhase('IDLE');
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);
    if (videoRef.current?.srcObject)
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());
    if (startRef.current && elapsed > 10) {
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
      } catch { /* non-fatal */ }
    }
  };

  const recal = () => { Object.assign(L.current,{calib:0,baseSh:0,baseAb:0}); setPhase('CALIBRATING'); };

  // ── SVG signal helper ──────────────────────────────────────────
  const pts = (d: number[], h: number) =>
    d.map((v,i)=>`${(i/(d.length-1))*300},${h/2-v*2.2}`).join(' ');

  const pc = PC[phase], vc = verdict==='Good Breath'?'#10b981':verdict==='Apical Fault'?'#ef4444':'#6b7280';

  return (
    <div className="bs-shell">
      <div className="bs-layout">

        {/* ═══ VIDEO COLUMN ════════════════════════════════════════ */}
        <div className="bs-video-col">
          <div className="bs-badge" style={{background:`${vc}20`,borderColor:`${vc}55`,color:vc}}>
            <span className="bs-dot" style={{background:vc}}/>{verdict}
          </div>

          <div className="bs-canvas-wrap">
            {/* Hidden video — NOT display:none so dimensions work */}
            <video ref={videoRef} playsInline muted
              style={{position:'absolute',width:'1px',height:'1px',opacity:0,pointerEvents:'none'}}/>
            <canvas ref={canvasRef} className="bs-canvas"/>

            {!running && (
              <div className="bs-idle-overlay">
                <div style={{fontSize:72,marginBottom:16}}>🫁</div>
                <div className="bs-idle-title">Diaphragmatic Breathing Coach</div>
                <div className="bs-idle-sub">
                  Stand <strong>side-on</strong> to the camera so your full torso is visible.<br/>
                  A 60-frame auto-calibration runs when you press Start.
                </div>
                <div className="bs-status-pill" style={{
                  color: ready?'#10b981':initErr?'#ef4444':'#f59e0b',
                  borderColor: ready?'#10b981':initErr?'#ef4444':'#f59e0b',
                }}>
                  {initErr ? `⛔ ${initErr}` : ready ? '✓ Model ready' : `⏳ ${status}`}
                </div>
                <div className="bs-idle-tips">
                  <span>💡 Keep shoulders relaxed — belly does the work</span>
                  <span>💡 Breathe through nose, out through pursed lips</span>
                  <span>💡 Target: 12–16 breaths per minute</span>
                </div>
              </div>
            )}
          </div>

          <div className="bs-tips-bar">
            <span>💡 Side-on posture recommended</span>
            <span>·</span><span>💡 Auto-calibration on start</span>
            <span>·</span><span>💡 Target 12–16 breaths/min</span>
          </div>
        </div>

        {/* ═══ PANEL ═══════════════════════════════════════════════ */}
        <div className="bs-panel">
          {/* Timer */}
          <div className="bs-panel-top">
            <div>
              <div className="bs-timer-label">SESSION</div>
              <div className="bs-timer-val">{fmt(elapsed)}</div>
            </div>
            <div className="bs-phase-chip" style={{background:`${pc}22`,color:pc,borderColor:`${pc}55`}}>
              {phase}
            </div>
            <button className="bs-hist-btn" onClick={()=>setShowHist(v=>!v)}>📋 History</button>
          </div>

          {/* 2×2 metrics */}
          <div className="bs-metrics">
            {[
              {l:'BREATHS / MIN', v:bpm,          c:'#10b981'},
              {l:'DEPTH SCORE',   v:depth,         c:'#3b82f6'},
              {l:'GOOD BREATHS',  v:`${goodPct}%`, c:'#8b5cf6'},
              {l:'TOTAL BREATHS', v:total,          c:'#f59e0b'},
            ].map(m=>(
              <div key={m.l} className="bs-metric-card">
                <div className="bs-metric-val" style={{color:m.c}}>{m.v}</div>
                <div className="bs-metric-lbl">{m.l}</div>
              </div>
            ))}
          </div>

          {/* Excursion bar */}
          <div className="bs-excursion-block">
            <div className="bs-excursion-head">
              <span>Abdominal Excursion</span>
              <span style={{color:pc}}>{Math.round(excur)}%</span>
            </div>
            <div className="bs-excursion-track">
              <div className="bs-excursion-fill" style={{width:`${excur}%`,background:pc}}/>
            </div>
          </div>

          {/* Technique ring */}
          <div className="bs-ring-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9"/>
              <circle cx="55" cy="55" r="44" fill="none" stroke={pc} strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${tech*2.765} 276.5`}
                strokeDashoffset="69.1"
                style={{transition:'stroke-dasharray 0.6s ease'}}/>
            </svg>
            <div className="bs-ring-inner">
              <div style={{fontSize:22,fontWeight:800,color:pc,lineHeight:1}}>{tech}%</div>
              <div style={{fontSize:9,color:'#8892a4',textTransform:'uppercase',letterSpacing:'0.08em'}}>Technique</div>
            </div>
          </div>

          {/* Live signals */}
          <div className="bs-signal-card">
            <div className="bs-signal-legend">
              <span style={{color:'#38bdf8'}}>── Shoulder</span>
              <span style={{color:'#10b981'}}>── Abdomen</span>
            </div>
            <svg width="100%" height="72" viewBox="0 0 300 72" preserveAspectRatio="none">
              <line x1="0" y1="36" x2="300" y2="36" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
              <polyline points={pts(sigSh,72)} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
              <polyline points={pts(sigAb,72)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Controls */}
          {!running ? (
            <button className="bs-start-btn" onClick={handleStart} disabled={!ready||!!initErr}>
              {initErr ? '⛔ Init failed' : ready ? '▶  Start Session' : `⏳  ${status}`}
            </button>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <button className="bs-stop-btn"  onClick={handleStop}>⏹  End &amp; Save</button>
              <button className="bs-recal-btn" onClick={recal}>↺  Recalibrate</button>
            </div>
          )}

          {saved && <div className="bs-saved-banner">✅  Session saved — visible to your care team</div>}
        </div>
      </div>

      {/* History drawer */}
      {showHist && (
        <div className="bs-history">
          <div className="bs-history-title">Recent Sessions</div>
          {history.length === 0
            ? <div style={{color:'#8892a4',fontSize:13}}>No sessions yet.</div>
            : history.map((s,i)=>(
              <div key={s.id??i} className="bs-history-row">
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>
                    {Math.round(s.good_breath_pct??0)}% technique · {s.total_breaths??0} breaths
                  </div>
                  <div style={{fontSize:11,color:'#8892a4',marginTop:2}}>
                    {new Date(s.started_at).toLocaleString()} · {Math.round(s.avg_bpm??0)} bpm
                  </div>
                </div>
                <div style={{fontSize:20,fontWeight:800,
                  color:(s.good_breath_pct??0)>=75?'#10b981':(s.good_breath_pct??0)>=50?'#f59e0b':'#ef4444'}}>
                  {Math.round(s.good_breath_pct??0)}%
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
