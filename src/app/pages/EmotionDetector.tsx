import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

interface EmotionDetectorProps {
  onComplete: (emotion: string) => void;
  onSkip: () => void;
}

/* ── Emotion PNG assets ─────────────────────────────────────────── */
const EMOTION_IMGS: Record<string, string> = {
  happy:     '/assets/HappyEmotion.png',
  sad:       '/assets/SadEmotion.png',
  angry:     '/assets/AngryEmotion.png',
  fearful:   '/assets/StressedEmotion.png',
  disgusted: '/assets/NeutralEmotion.png',
  surprised: '/assets/EnergeticEmotion.png',
  neutral:   '/assets/CalmEmotion.png',
};

const cameraImg = '/assets/camera.png';
const healthImg = '/assets/health.png';

/* ── Emotion messages ───────────────────────────────────────────── */
const EMOTION_MESSAGES: Record<string, { title: string; msg: string; color: string }> = {
  happy: {
    title: 'You look Happy!',
    msg: 'Your energy is glowing! A positive mood boosts your immune system. Keep that smile — and hit your 10,000 steps today!',
    color: '#fbbf24',
  },
  sad: {
    title: 'You seem a bit Sad',
    msg: "Hey, it's okay. Have you eaten the right food today? Low mood can link to low blood sugar or dehydration. Drink some water and try a walk — movement helps!",
    color: '#60a5fa',
  },
  angry: {
    title: 'You look Stressed',
    msg: 'Your face shows tension! Try 5 minutes of deep breathing. Check your HRV — stress raises your resting heart rate. A short walk outside can reset your mood!',
    color: '#ef4444',
  },
  fearful: {
    title: 'You look Anxious',
    msg: 'You seem tense! Box breathing helps: inhale 4s → hold 4s → exhale 4s. Your body needs calm right now. Make sure you have had enough sleep and water today!',
    color: '#fb923c',
  },
  disgusted: {
    title: 'You seem Off Today',
    msg: "Not feeling your best? Check your nutrition — sometimes nausea links to skipped meals or dehydration. Have you had breakfast? Try a light snack and some water!",
    color: '#a78bfa',
  },
  surprised: {
    title: 'You look Surprised!',
    msg: "Wide awake and alert! That's great energy. Channel it into hitting your step goal today — you're only 2,600 steps away from 10,000!",
    color: '#34d399',
  },
  neutral: {
    title: 'You look Calm and Neutral',
    msg: 'Cool and collected! A calm mood is great for focus. Make sure you stay hydrated — you are at 1.8L of your 2.5L goal. Keep it steady!',
    color: '#38bdf8',
  },
};

export function EmotionDetector({ onComplete, onSkip }: EmotionDetectorProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus]                   = useState<'loading' | 'ready' | 'detecting' | 'done' | 'error'>('loading');
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
  const [countdown, setCountdown]             = useState(3);
  const [showResult, setShowResult]           = useState(false);
  const [progress, setProgress]               = useState(0);
  const [imgLoaded, setImgLoaded]             = useState(false);

  /* ── Load face-api models ──────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        setStatus('loading');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    };
    load();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('detecting');
      startCountdown();
    } catch {
      setStatus('error');
    }
  };

  const startCountdown = () => {
    let count = 3;
    setCountdown(3);
    const timer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) { clearInterval(timer); startDetection(); }
    }, 1000);
  };

  const startDetection = () => {
    let frame = 0;
    const totalFrames = 30;
    const emotionCounts: Record<string, number> = {};

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      frame++;
      setProgress(Math.round((frame / totalFrames) * 100));

      const result = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      if (result?.expressions) {
        const top = Object.entries(result.expressions).sort((a,b) => b[1]-a[1])[0];
        emotionCounts[top[0]] = (emotionCounts[top[0]] || 0) + 1;
      }

      if (frame >= totalFrames) {
        clearInterval(intervalRef.current!);
        stopCamera();
        const topEmotion = Object.entries(emotionCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'neutral';
        setDetectedEmotion(topEmotion);
        setStatus('done');
        setShowResult(true);
        setTimeout(() => onComplete(topEmotion), 4500);
      }
    }, 150);
  };

  const info = detectedEmotion ? (EMOTION_MESSAGES[detectedEmotion] ?? EMOTION_MESSAGES['neutral']) : null;
  const emotionImg = detectedEmotion ? EMOTION_IMGS[detectedEmotion] : null;

  return (
    <>
      <style>{`
        @keyframes fadeInUp  { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn     { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
        @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes scanLine  { 0%{top:0%} 100%{top:100%} }
        @keyframes ringPing  { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes healthSpin{ 0%,100%{transform:rotate(-6deg) scale(1);filter:drop-shadow(0 0 18px rgba(239,68,68,0.5));} 50%{transform:rotate(6deg) scale(1.06);filter:drop-shadow(0 0 32px rgba(239,68,68,0.8));} }
        @keyframes cameraWobble{ 0%,100%{transform:rotate(-3deg) translateY(0);filter:drop-shadow(0 8px 20px rgba(99,102,241,0.4));} 50%{transform:rotate(3deg) translateY(-8px);filter:drop-shadow(0 16px 30px rgba(99,102,241,0.6));} }
        @keyframes emotionPop { 0%{transform:scale(0) rotate(-15deg);opacity:0} 60%{transform:scale(1.15) rotate(4deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes breathRing { 0%,100%{transform:scale(1);opacity:0.3} 50%{transform:scale(1.3);opacity:0} }
        @keyframes countPop  { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }

        .emotion-overlay { animation: fadeInUp 0.4s ease; }
        .result-popup    { animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .scan-line       { animation: scanLine 2s ease-in-out infinite alternate; }
        .detecting-pulse { animation: pulse 1.5s ease-in-out infinite; }
        .ring-ping       { animation: ringPing 1.8s ease-out infinite; }
      `}</style>

      {/* Full screen overlay */}
      <div className="emotion-overlay" style={{
        position:'fixed', inset:0, zIndex:99999,
        background:'linear-gradient(135deg, rgba(5,10,25,0.98) 0%, rgba(10,20,50,0.97) 100%)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(12px)',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'28px', textAlign:'center', flexDirection:'column' }}>
          {/* Health symbol */}
          <img src={healthImg} alt="Health" style={{ width:60, height:60, objectFit:'contain', animation:'healthSpin 3s ease-in-out infinite', filter:'drop-shadow(0 0 18px rgba(239,68,68,0.5))' }} />
          <div>
            <h2 style={{ color:'#e0f0ff', fontSize:'24px', fontWeight:900, margin:0, letterSpacing:'-0.3px' }}>
              Emotion Health Check
            </h2>
            <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', margin:'6px 0 0' }}>
              Let your camera analyze how you are feeling today
            </p>
          </div>
        </div>

        {/* Camera / Video box */}
        <div style={{
          position:'relative', width:'340px', height:'290px',
          borderRadius:'22px', overflow:'hidden',
          border:`2px solid ${status==='done' && info ? info.color+'88' : 'rgba(100,180,255,0.3)'}`,
          boxShadow:`0 0 40px ${status==='done' && info ? info.color+'40' : 'rgba(100,180,255,0.15)'}, 0 8px 32px rgba(0,0,0,0.5)`,
          transition:'border-color 0.5s, box-shadow 0.5s',
        }}>

          {/* Video feed */}
          <video ref={videoRef} muted playsInline
            style={{ width:'100%', height:'100%', objectFit:'cover', display: status==='detecting'||status==='done' ? 'block' : 'none', transform:'scaleX(-1)' }} />
          <canvas ref={canvasRef} style={{ display:'none' }} />

          {/* Loading */}
          {status === 'loading' && (
            <div style={{ width:'100%', height:'100%', background:'rgba(8,20,50,1)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px' }}>
              <div style={{ width:'44px', height:'44px', borderRadius:'50%', border:'3px solid rgba(100,180,255,0.2)', borderTop:'3px solid #38bdf8', animation:'spin 1s linear infinite' }} />
              <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', margin:0 }}>Loading AI models...</p>
            </div>
          )}

          {/* Ready — show camera PNG */}
          {status === 'ready' && (
            <div style={{ width:'100%', height:'100%', background:'rgba(8,20,50,1)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', padding:'20px', boxSizing:'border-box' }}>
              <img src={cameraImg} alt="Camera" style={{ width:120, height:120, objectFit:'contain', animation:'cameraWobble 3s ease-in-out infinite', filter:'drop-shadow(0 0 20px rgba(99,102,241,0.5))' }} />
              <p style={{ color:'rgba(220,235,255,0.7)', fontSize:'14px', margin:0, textAlign:'center', lineHeight:1.5 }}>
                Ready to scan your face and detect your mood
              </p>
            </div>
          )}

          {/* Countdown overlay */}
          {status === 'detecting' && countdown > 0 && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.55)' }}>
              <div key={countdown} style={{ fontSize:'80px', fontWeight:900, color:'#38bdf8', textShadow:'0 0 40px #38bdf8', animation:'countPop 0.4s ease' }}>{countdown}</div>
            </div>
          )}

          {/* Scan animation */}
          {status === 'detecting' && countdown === 0 && (
            <>
              <div className="scan-line" style={{ position:'absolute', left:0, right:0, height:'2px', background:'linear-gradient(90deg,transparent,#38bdf8,transparent)', boxShadow:'0 0 12px #38bdf8', pointerEvents:'none' }} />
              <div style={{ position:'absolute', bottom:'12px', left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.75)', borderRadius:'20px', padding:'5px 16px', color:'#38bdf8', fontSize:'12px', fontWeight:600, backdropFilter:'blur(4px)' }} className="detecting-pulse">
                Analyzing... {progress}%
              </div>
              {/* Corner brackets */}
              {[{t:'10px',l:'10px',bt:'2px 0 0 2px'},{t:'10px',r:'10px',bt:'2px 2px 0 0'},{b:'10px',l:'10px',bt:'0 0 2px 2px'},{b:'10px',r:'10px',bt:'0 2px 2px 0'}].map((pos,i) => (
                <div key={i} style={{ position:'absolute', width:'22px', height:'22px', borderColor:'#38bdf8', borderStyle:'solid', borderWidth:pos.bt, top:pos.t, left:(pos as any).l, right:(pos as any).r, bottom:(pos as any).b }} />
              ))}
            </>
          )}

          {/* Result overlay — emotion PNG inside video */}
          {status === 'done' && info && showResult && emotionImg && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ position:'relative', display:'inline-block' }}>
                  <div style={{ position:'absolute', inset:'-12px', borderRadius:'50%', border:`2px solid ${info.color}55`, animation:'breathRing 2s ease-in-out infinite' }} />
                  <div style={{ position:'absolute', inset:'-20px', borderRadius:'50%', border:`2px solid ${info.color}33`, animation:'breathRing 2s ease-in-out infinite 0.5s' }} />
                  <img src={emotionImg} alt="Detected emotion"
                    style={{ width:100, height:100, objectFit:'contain', animation:'emotionPop 0.6s cubic-bezier(.4,0,.2,1) forwards', filter:`drop-shadow(0 0 24px ${info.color})` }} />
                </div>
                <p style={{ color:info.color, fontWeight:800, fontSize:'15px', margin:'12px 0 0', textShadow:`0 0 12px ${info.color}` }}>Detected!</p>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div style={{ width:'100%', height:'100%', background:'rgba(8,20,50,1)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px', padding:'20px', boxSizing:'border-box' }}>
              <img src={cameraImg} alt="Camera" style={{ width:70, height:70, objectFit:'contain', opacity:0.4 }} />
              <p style={{ color:'#ef4444', fontSize:'13px', margin:0, textAlign:'center', lineHeight:1.5 }}>
                Camera access denied or models failed to load.
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {status === 'detecting' && countdown === 0 && (
          <div style={{ width:'340px', marginTop:'12px', height:'5px', background:'rgba(255,255,255,0.08)', borderRadius:'4px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#38bdf8,#a78bfa)', borderRadius:'4px', transition:'width 0.15s ease', boxShadow:'0 0 8px rgba(56,189,248,0.5)' }} />
          </div>
        )}

        {/* Result popup */}
        {status === 'done' && info && showResult && emotionImg && (
          <div className="result-popup" style={{
            marginTop:'20px', width:'340px',
            background:'rgba(8,20,50,0.95)',
            border:`1px solid ${info.color}55`,
            borderRadius:'20px', padding:'20px',
            boxShadow:`0 12px 48px ${info.color}25, 0 4px 16px rgba(0,0,0,0.5)`,
            backdropFilter:'blur(12px)',
          }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:'14px' }}>
              {/* Emotion PNG with ring */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:`${info.color}18`, border:`2px solid ${info.color}50`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  <img src={emotionImg} alt="Emotion" style={{ width:44, height:44, objectFit:'contain', filter:`drop-shadow(0 0 10px ${info.color})` }} />
                </div>
                <span className="ring-ping" style={{ position:'absolute', inset:'-4px', borderRadius:'50%', border:`2px solid ${info.color}`, pointerEvents:'none' }} />
              </div>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontWeight:800, fontSize:'15px', color:info.color, letterSpacing:'-0.2px' }}>{info.title}</p>
                <p style={{ margin:'6px 0 0', fontSize:'12px', color:'rgba(220,235,255,0.65)', lineHeight:1.6 }}>{info.msg}</p>
              </div>
            </div>

            {/* Health symbol footer */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginTop:'14px', paddingTop:'12px', borderTop:'1px solid rgba(100,180,255,0.1)' }}>
              <img src={healthImg} alt="Health" style={{ width:18, height:18, objectFit:'contain', opacity:0.6 }} />
              <p style={{ margin:0, fontSize:'11px', color:'rgba(180,210,255,0.35)', textAlign:'center' }}>
                Redirecting to dashboard...
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {(status === 'ready' || status === 'error') && (
          <div style={{ display:'flex', gap:'12px', marginTop:'22px' }}>
            {status === 'ready' && (
              <button onClick={startCamera}
                style={{ display:'flex', alignItems:'center', gap:'10px', background:'linear-gradient(135deg,#3b82f6,#6366f1)', border:'none', borderRadius:'14px', padding:'13px 28px', color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', boxShadow:'0 6px 22px rgba(59,130,246,0.4)', transition:'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 28px rgba(59,130,246,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 6px 22px rgba(59,130,246,0.4)'; }}>
                Start Scan
              </button>
            )}
            <button onClick={() => { stopCamera(); onSkip(); }}
              style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'14px', padding:'13px 22px', color:'rgba(180,210,255,0.6)', fontSize:'14px', fontWeight:600, cursor:'pointer', transition:'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#e0f0ff'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(180,210,255,0.6)'; }}>
              Skip
            </button>
          </div>
        )}

        {status === 'detecting' && (
          <p style={{ color:'rgba(180,210,255,0.3)', fontSize:'12px', marginTop:'12px' }}>
            {countdown > 0 ? 'Hold still...' : 'Reading your facial expressions...'}
          </p>
        )}
      </div>
    </>
  );
}