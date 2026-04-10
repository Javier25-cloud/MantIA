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
  
  // Estados de datos
  const [status, setStatus] = useState('');
  const [iaData, setIaData] = useState(null);
  const [history, setHistory] = useState([]);
  const [stock, setStock] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [chartData, setChartData] = useState([]);
  
  // UI States
  const [isRecording, setIsRecording] = useState(false);
  const [showQR, setShowQR] = useState(null);

  // Lógica de Calendario
  const tareasPorDia = tareas.reduce((acc, t) => {
    const fecha = t.fecha_limite;
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(t);
    return acc;
  }, {});

  const downloadDailyOrders = (fecha) => {
    exportExcel(tareasPorDia[fecha] || [], `Ordenes_Mantenimiento_${fecha}`);
  };

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
    } catch (err) { console.error("Error API:", err); }
  };

  useEffect(() => { fetchData(); }, [user, view]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinInput }) });
    const result = await res.json();
    if (result.success) setUser(result.user);
    else alert("PIN Incorrecto");
  };

  // FUNCIÓN RESTAURADA: Reconocimiento de Voz
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Tu navegador no soporta reconocimiento de voz.");
    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.onstart = () => { setIsRecording(true); setStatus('Escuchando avería...'); };
    rec.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      setStatus(`Analizando con IA...`);
      const res = await fetch(`${API_URL}/api/process-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
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

  // --- LOGIN SCREEN ---
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

  // --- MAIN APP ---
  return (
    <div className="container" style={{maxWidth: view === 'gerencia' ? '1100px' : '450px'}}>
      
      {/* Botón Home Superior Izquierda */}
      <button className="home-nav-btn" onClick={() => setUser(null)}>
        <img src="/logo.png" alt="Logo" />
        <span>MantIA Inicio</span>
      </button>
      
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <img src="/logo.png" alt="Logo" style={{ height: '90px' }} />
        <h2 className="brand-name" style={{fontSize: '2rem'}}>MantIA</h2>
      </header>

      {/* Switch Industrial Principal */}
      <nav className="nav-tabs">
        <button className={view === 'operario' ? 'active' : ''} onClick={() => setView('operario')}>👷 Reporte</button>
        <button className={view === 'gerencia' ? 'active' : ''} onClick={() => setView('gerencia')}>📊 Gerencia</button>
      </nav>

      {/* VISTA OPERARIO */}
      {view === 'operario' ? (
        <main className="animate-in" style={{width: '100%'}}>
          
          <section style={{textAlign:'left', marginBottom:'40px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h3 style={{color: '#94a3b8', fontSize: '0.9rem'}}>📋 TAREAS PREVENTIVAS HOY</h3>
              <button className="excel-btn" style={{padding:'5px 10px', fontSize:'0.7rem', marginBottom:0}} onClick={() => exportExcel(tareas.filter(t=>t.estado==='pendiente'), "Tareas_Hoy")}>📥 Bajar Hoja</button>
            </div>
            {tareas.filter(t => t.estado === 'pendiente').length === 0 ? (
              <p style={{color:'#94a3b8', textAlign:'center', background:'rgba(255,255,255,0.05)', padding:'20px', borderRadius:'10px'}}>No hay tareas preventivas para hoy.</p>
            ) : (
              tareas.filter(t => t.estado === 'pendiente').map(t => (
                <div key={t.id} style={{background: 'white', padding:'15px', borderRadius:'15px', color:'#1e293b', marginBottom:'10px', borderLeft:'6px solid #6366f1'}}>
                  <div style={{fontWeight:'800'}}>{t.titulo}</div>
                  <div style={{fontSize:'0.75rem', color:'#64748b'}}>{t.maquina_nombre} - Límite: {t.fecha_limite}</div>
                  <button onClick={async () => {
                    await fetch(`${API_URL}/api/complete-task/${t.id}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({maquina_nombre: t.maquina_nombre}) });
                    fetchData();
                  }} style={{marginTop:'10px', background:'#10b981', color:'white', border:'none', padding:'8px 12px', borderRadius:'8px', cursor:'pointer', fontWeight:'700', width:'100%'}}>HECHO ✓</button>
                </div>
              ))
            )}
          </section>

          <div className="voice-section">
            <button className={`record-btn-giant ${isRecording ? 'is-recording' : ''}`} onClick={startListening}>
              <span style={{fontSize: '4rem'}}>🎤</span>
            </button>
            <p style={{marginTop:'20px', fontWeight:'800', color:'#94a3b8'}}>{isRecording ? 'TE ESCUCHO...' : 'REPORTA NUEVA AVERÍA'}</p>
            {status && <div className="status-pill status-ok" style={{marginTop:'15px', display:'inline-block'}}>{status}</div>}
          </div>

          {iaData && (
            <div className="ia-card" style={{background:'#1e293b', padding:'20px', borderRadius:'20px', borderLeft:'5px solid #6366f1', textAlign:'left', marginTop:'20px'}}>
              <h3>Detección IA (Avería)</h3>
              <p><strong>Máquina:</strong> {iaData.maquina_nombre}</p>
              <p><strong>Piezas Usadas:</strong> {iaData.repuestos_usados?.join(', ')}</p>
              <button className="confirm-button" onClick={async () => {
                await fetch(`${API_URL}/api/save-intervention`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...iaData, empresa_id: user.empresa_id, usuario_id: user.id }) });
                setIaData(null);
                alert("Avería registrada");
                fetchData();
              }} style={{marginTop:'15px'}}>CONFIRMAR REGISTRO</button>
            </div>
          )}
        </main>
      ) : (

      /* VISTA GERENCIA */
        <div className="dashboard-view animate-in" style={{width: '100%'}}>
          <div className="sub-nav">
            <button className={subView === 'resumen' ? 's-active' : ''} onClick={()=>setSubView('resumen')}>Resumen</button>
            <button className={subView === 'calendario' ? 's-active' : ''} onClick={()=>setSubView('calendario')}>📅 Calendario</button>
            <button className={subView === 'maquinas' ? 's-active' : ''} onClick={()=>setSubView('maquinas')}>Maquinaria</button>
            <button className={subView === 'historial' ? 's-active' : ''} onClick={()=>setSubView('historial')}>Historial</button>
            <button className={subView === 'inventario' ? 's-active' : ''} onClick={()=>setSubView('inventario')}>Stock</button>
          </div>

          {subView === 'resumen' && (
            <div className="stats-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop:'20px'}}>
              <div className="stat-card" style={{background: '#1e293b', padding: '20px', borderRadius: '20px'}}>
                <h4 style={{marginBottom:'20px', color:'#94a3b8', textAlign:'left'}}>Averías por Máquina</h4>
                <div style={{height: '250px'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} style={{fontSize: '12px', fill:'#fff'}} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                        {chartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="stat-card" style={{textAlign: 'center', background: '#1e293b', padding: '20px', borderRadius: '20px', display:'flex', flexDirection:'column', justifyContent:'center'}}>
                <div style={{fontSize: '3rem', fontWeight: '800', color: '#6366f1'}}>{history.length}</div>
                <p>Intervenciones Totales</p>
                <div style={{fontSize: '3rem', fontWeight: '800', color: '#ef4444', marginTop: '20px'}}>{stock.filter(s=>s.stock_actual <= s.stock_minimo).length}</div>
                <p>Stock Crítico</p>
              </div>
            </div>
          )}

          {subView === 'calendario' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'15px', marginTop:'20px'}}>
              {Object.keys(tareasPorDia).length === 0 ? (
                <p style={{gridColumn:'1/-1', textAlign:'center', color:'#94a3b8'}}>No hay tareas programadas en el calendario.</p>
              ) : (
                Object.keys(tareasPorDia).sort().map(fecha => (
                  <div key={fecha} style={{background:'white', padding:'15px', borderRadius:'12px', color:'#1e293b', textAlign:'left', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
                    <div style={{fontWeight:'800', borderBottom:'1px solid #eee', paddingBottom:'5px', marginBottom:'10px', color:'#6366f1'}}>{fecha}</div>
                    {tareasPorDia[fecha].map(t => (
                      <div key={t.id} style={{fontSize:'0.75rem', background:'#f1f5f9', padding:'8px', borderRadius:'6px', marginBottom:'5px', borderLeft:`4px solid ${t.estado === 'pendiente' ? '#ef4444' : '#10b981'}`}}>
                        <b>{t.maquina_nombre}</b><br/>{t.titulo}
                      </div>
                    ))}
                    <button onClick={()=>downloadDailyOrders(fecha)} style={{width:'100%', fontSize:'0.7rem', marginTop:'10px', background:'#6366f1', color:'white', border:'none', padding:'8px', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>📥 Bajar Día</button>
                  </div>
                ))
              )}
            </div>
          )}

          {subView === 'maquinas' && (
            <div className="machine-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'20px', marginTop:'20px'}}>
              {maquinas.map(m => (
                <div key={m.id} className="machine-item" style={{background:'white', color:'#1e293b', padding:'25px', borderRadius:'20px', textAlign:'left', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
                  
                  {/* Header de la tarjeta */}
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                    <span style={{fontWeight:'900', fontSize:'1.1rem', color:'#0f172a'}}>{m.nombre}</span>
                    <button onClick={() => setShowQR(m.nombre)} style={{background:'#f1f5f9', border:'none', padding:'5px 10px', borderRadius:'8px', cursor:'pointer', fontSize:'1.2rem'}} title="Ver QR">🔲</button>
                  </div>

                  {/* Lista de Planes Preventivos */}
                  <div style={{marginBottom:'15px', padding:'12px', background:'#f8fafc', borderRadius:'12px', border:'1px solid #e2e8f0'}}>
                    <span style={{fontSize:'0.75rem', color:'#64748b', fontWeight:'bold'}}>PLANES PREVENTIVOS ACTIVOS:</span>
                    {(!planes || !Array.isArray(planes)) ? (
                      <p style={{fontSize:'0.8rem', marginTop:'5px', color:'#94a3b8'}}>Cargando planes...</p>
                    ) : planes.filter(p => p.maquina_id === m.id).length === 0 ? (
                      <p style={{fontSize:'0.8rem', marginTop:'5px', color:'#94a3b8'}}>Sin planes activos.</p>
                    ) : (
                      planes.filter(p => p.maquina_id === m.id).map(p => (
                        <div key={p.id} style={{fontSize:'0.8rem', padding:'6px 0', borderBottom:'1px solid #e2e8f0', color:'#334155'}}>
                          🛠 <b>{p.titulo}</b> <span style={{color:'#6366f1', fontSize:'0.7rem'}}>(Cada {p.frecuencia_dias}d)</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Botón Añadir Plan (Con Escudo de Errores) */}
                  <button onClick={async () => {
                    const t = prompt("Nombre del mantenimiento (ej: Engrase rodillos)");
                    const f = prompt("Frecuencia en días (ej: 15)");
                    if(t && f) {
                      const response = await fetch(`${API_URL}/api/add-plan`, {
                        method:'POST', 
                        headers:{'Content-Type':'application/json'}, 
                        body:JSON.stringify({maquina_id: m.id, titulo: t, frecuencia_dias: parseInt(f), empresa_id: user.empresa_id})
                      });
                      const data = await response.json();
                      if (data.error) alert("Error de Base de Datos: " + data.error);
                      else fetchData();
                    }
                  }} className="confirm-button" style={{padding:'12px', fontSize:'0.8rem', background:'#10b981', boxShadow:'0 4px 10px rgba(16, 185, 129, 0.3)'}}>+ AÑADIR PLAN A MÁQUINA</button>
                </div>
              ))}
            </div>
          )}

          {subView === 'historial' && (
            <div style={{marginTop:'20px'}}>
              <div style={{textAlign:'left', marginBottom:'15px'}}><button className="excel-btn" onClick={() => exportExcel(history, "Historial_Intervenciones")}>📥 Exportar Historial</button></div>
              <table className="history-table">
                <thead><tr><th>Fecha</th><th>Máquina</th><th>Piezas Usadas</th></tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.fecha).toLocaleDateString()}</td>
                      <td style={{fontWeight:'700'}}>{h.maquina}</td>
                      <td style={{fontSize:'0.85rem'}}>{h.repuestos?.join(', ') || 'Ninguna'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subView === 'inventario' && (
            <div style={{marginTop:'20px'}}>
              <div style={{textAlign:'left', marginBottom:'15px'}}><button className="excel-btn" onClick={() => exportExcel(stock, "Estado_Inventario")}>📥 Exportar Stock</button></div>
              <table className="history-table">
                <thead><tr><th>Repuesto</th><th>Stock</th><th>Estado</th></tr></thead>
                <tbody>
                  {stock.map(s => (
                    <tr key={s.id}>
                      <td>{s.nombre}</td>
                      <td style={{fontWeight:'800'}}>{s.stock_actual}</td>
                      <td>
                        <span className={`status-pill ${s.stock_actual <= s.stock_minimo ? 'status-warn' : 'status-ok'}`}>
                          {s.stock_actual <= s.stock_minimo ? '⚠️ PEDIR' : '✅ OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión Segura</button>
        </div>
      )}

      {/* Modal QR Restaurado */}
      {showQR && (
        <div className="modal-overlay" onClick={()=>setShowQR(null)}>
          <div className="modal-content" style={{background:'white', padding:'30px', borderRadius:'20px', textAlign:'center', color:'#1e293b'}}>
            <h3>Código QR Maquinaria</h3>
            <div style={{margin:'20px 0'}}><QRCodeCanvas value={`ID:${showQR}`} size={180} /></div>
            <p style={{fontWeight:'800', fontSize:'1.2rem'}}>{showQR}</p>
            <button onClick={()=>setShowQR(null)} className="confirm-button" style={{marginTop:'20px'}}>CERRAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
