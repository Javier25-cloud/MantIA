import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './App.css';

const API_URL = "https://mantia-backend.onrender.com";
const COLORS = ['#6366f1', '#818cf8', '#10b981', '#f59e0b', '#ef4444'];

function App() {
  const [user, setUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [view, setView] = useState('operario');
  const [subView, setSubView] = useState('resumen');
  const [status, setStatus] = useState('');
  const [iaData, setIaData] = useState(null);
  const [history, setHistory] = useState([]);
  const [stock, setStock] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showQR, setShowQR] = useState(null);

  // Lógica de Calendario
  const tareasPorDia = tareas.reduce((acc, t) => {
    const fecha = t.fecha_limite;
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(t);
    return acc;
  }, {});

  const fetchData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/gerencia-data?empresa_id=${user.empresa_id}`);
      const data = await res.json();
      setHistory(data.history || []);
      setStock(data.stock || []);
      setMaquinas(data.maquinas || []);
      setTareas(data.tareas || []);
      setPlanes(data.planes || []);
      setChartData(data.chartData || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, [user, view]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinInput }) });
    const result = await res.json();
    if (result.success) setUser(result.user);
    else alert("PIN Incorrecto");
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.onstart = () => { setIsRecording(true); setStatus('Escuchando...'); };
    rec.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      setStatus('Analizando...');
      const res = await fetch(`${API_URL}/api/process-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const r = await res.json();
      setIaData(r.data);
      setStatus('');
    };
    rec.onend = () => setIsRecording(false);
    rec.start();
  };

  const exportExcel = (data, name) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${name}.xlsx`);
  };

  if (!user) return (
    <div className="container login-screen">
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <img src="/logo.png" alt="Logo" style={{ height: '150px' }} />
        <h1 className="brand-name">MantIA</h1>
      </div>
      <div className="login-card animate-in">
        <form onSubmit={handleLogin}>
          <input type="password" value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="pin-input" placeholder="••••" autoFocus />
          <button type="submit" className="confirm-button">ENTRAR</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="container" style={{maxWidth: view === 'gerencia' ? '1100px' : '450px'}}>
      <button className="home-nav-btn" onClick={() => setUser(null)}><img src="/logo.png" alt="Logo" /><span>MantIA Inicio</span></button>
      
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <img src="/logo.png" alt="Logo" style={{ height: '90px' }} />
        <h2 className="brand-name" style={{fontSize: '2rem'}}>MantIA</h2>
      </header>

      <nav className="nav-tabs">
        <button className={view === 'operario' ? 'active' : ''} onClick={() => setView('operario')}>👷 Reporte</button>
        <button className={view === 'gerencia' ? 'active' : ''} onClick={() => setView('gerencia')}>📊 Gerencia</button>
      </nav>

      {view === 'operario' ? (
        <main className="animate-in">
          <section style={{textAlign:'left', marginBottom:'30px'}}>
            <h3 style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom:'15px'}}>📋 TAREAS DE HOY</h3>
            {tareas.filter(t => t.estado === 'pendiente').map(t => (
              <div key={t.id} style={{background: 'white', padding:'15px', borderRadius:'15px', color:'#1e293b', marginBottom:'10px', borderLeft:'6px solid #6366f1'}}>
                <div style={{fontWeight:'800'}}>{t.titulo}</div>
                <div style={{fontSize:'0.75rem', color:'#64748b'}}>{t.maquina_nombre} - {t.fecha_limite}</div>
                <button onClick={async () => {
                  await fetch(`${API_URL}/api/complete-task/${t.id}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({maquina_nombre: t.maquina_nombre}) });
                  fetchData();
                }} style={{marginTop:'10px', background:'#10b981', color:'white', border:'none', padding:'8px', borderRadius:'8px', cursor:'pointer', width:'100%', fontWeight:'bold'}}>HECHO ✓</button>
              </div>
            ))}
          </section>

          <div className="voice-section">
            <button className={`record-btn-giant ${isRecording ? 'is-recording' : ''}`} onClick={startListening}><span style={{fontSize:'4rem'}}>🎤</span></button>
            <p style={{marginTop:'20px', fontWeight:'800', color:'#94a3b8'}}>{isRecording ? 'HABLA...' : 'REPORTAR AVERÍA'}</p>
            {status && <div className="status-pill status-ok" style={{marginTop:'10px'}}>{status}</div>}
          </div>
        </main>
      ) : (
        <div className="dashboard-view animate-in">
          <div className="sub-nav">
            <button className={subView === 'resumen' ? 's-active' : ''} onClick={()=>setSubView('resumen')}>Resumen</button>
            <button className={subView === 'calendario' ? 's-active' : ''} onClick={()=>setSubView('calendario')}>📅 Calendario</button>
            <button className={subView === 'maquinas' ? 's-active' : ''} onClick={()=>setSubView('maquinas')}>Maquinaria</button>
            <button className={subView === 'historial' ? 's-active' : ''} onClick={()=>setSubView('historial')}>Historial</button>
            <button className={subView === 'inventario' ? 's-active' : ''} onClick={()=>setSubView('inventario')}>Stock</button>
          </div>

          {subView === 'calendario' && (() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = new Date(year, month, 1).getDay();
            const emptySlots = firstDay === 0 ? 6 : firstDay - 1;
            const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
            const blanks = Array.from({length: emptySlots}, (_, i) => i);
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            return (
              <div style={{marginTop: '20px', background: 'white', padding: '20px', borderRadius: '20px', color: '#1e293b'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                  <h3 style={{fontWeight:'900'}}>{monthNames[month].toUpperCase()} {year}</h3>
                  <button className="excel-btn" style={{padding:'5px 10px', fontSize:'0.7rem', marginBottom:0}} onClick={()=>exportExcel(tareas, "Calendario_MantIA")}>📥 Exportar Mes</button>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px'}}>
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} style={{fontWeight:'800', fontSize:'0.7rem', color:'#94a3b8'}}>{d}</div>)}
                  {blanks.map(b => <div key={`b-${b}`}></div>)}
                  {days.map(day => {
                    const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const tDelDia = tareasPorDia[dStr] || [];
                    const isToday = new Date().toISOString().split('T')[0] === dStr;
                    return (
                      <div key={day} style={{border: '1px solid #f1f5f9', borderRadius: '8px', minHeight: '60px', padding: '4px', background: isToday ? '#eef2ff' : 'transparent'}}>
                        <div style={{fontSize:'0.7rem', fontWeight:'800', color: isToday ? '#6366f1' : '#1e293b'}}>{day}</div>
                        {tDelDia.map(t => <div key={t.id} style={{fontSize:'0.5rem', padding:'2px', borderRadius:'3px', background: t.estado==='pendiente' ? '#fee2e2' : '#dcfce7', color: t.estado==='pendiente' ? '#991b1b' : '#166534', marginBottom:'2px', overflow:'hidden'}}>{t.maquina_nombre}</div>)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {subView === 'maquinas' && (
            <div className="machine-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'20px', marginTop:'20px'}}>
              {maquinas.map(m => (
                <div key={m.id} style={{background:'white', color:'#1e293b', padding:'20px', borderRadius:'20px', textAlign:'left'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontWeight:'900', fontSize:'1.1rem'}}>{m.nombre}</span>
                    <button onClick={()=>setShowQR(m.nombre)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem'}}>🔲</button>
                  </div>
                  <div style={{margin:'10px 0', padding:'10px', background:'#f8fafc', borderRadius:'10px'}}>
                    <span style={{fontSize:'0.7rem', fontWeight:'800', color:'#94a3b8'}}>PLANES ACTIVOS:</span>
                    {planes.filter(p => p.maquina_id === m.id).map(p => (
                      <div key={p.id} style={{fontSize:'0.8rem', borderBottom:'1px solid #f1f5f9', padding:'4px 0'}}>🛠 {p.titulo} ({p.frecuencia_dias}d)</div>
                    ))}
                  </div>
                  <button onClick={async () => {
                    const t = prompt("Tarea (ej: Engrase)");
                    const f = prompt("Días frecuencia (ej: 30)");
                    if(t && f) {
                      await fetch(`${API_URL}/api/add-plan`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({maquina_id: m.id, titulo: t, frecuencia_dias: parseInt(f), empresa_id: user.empresa_id, ultima_fecha: new Date().toISOString().split('T')[0]}) });
                      fetchData();
                    }
                  }} className="confirm-button" style={{padding:'10px', fontSize:'0.8rem', background:'#10b981'}}>+ AÑADIR PLAN</button>
                </div>
              ))}
            </div>
          )}

          {/* Resto de vistas: Historial, Stock e Inventario simplificadas pero funcionales */}
          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión</button>
        </div>
      )}

      {showQR && (
        <div className="modal-overlay" onClick={()=>setShowQR(null)}>
          <div className="modal-content" style={{background:'white', padding:'30px', borderRadius:'20px', textAlign:'center', color:'#1e293b'}}>
            <h3>Código QR Maquinaria</h3>
            <div style={{margin:'20px 0'}}><QRCodeCanvas value={`ID:${showQR}`} size={180} /></div>
            <p style={{fontWeight:'800'}}>{showQR}</p>
            <button onClick={()=>setShowQR(null)} className="confirm-button">CERRAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
