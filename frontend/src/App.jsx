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

  // --- LÓGICA DE PROYECCIÓN DE CALENDARIO (60 DÍAS) ---
  const tareasPorDia = tareas.reduce((acc, t) => {
    const fecha = t.fecha_limite;
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(t);
    return acc;
  }, {});

  const today = new Date();
  planes.forEach(plan => {
    if (!plan.frecuencia_dias || plan.frecuencia_dias <= 0) return;
    const maquina = maquinas.find(m => m.id === plan.maquina_id);
    if (!maquina) return;

    let cursorDate = new Date(plan.ultima_fecha || new Date());
    for (let i = 0; i < 60; i++) {
      cursorDate.setDate(cursorDate.getDate() + plan.frecuencia_dias);
      const dStr = cursorDate.toISOString().split('T')[0];

      const existeReal = (tareasPorDia[dStr] || []).find(t => t.titulo === plan.titulo && t.maquina_nombre === maquina.nombre);
      
      if (!existeReal) {
        if (!tareasPorDia[dStr]) tareasPorDia[dStr] = [];
        tareasPorDia[dStr].push({
          id: `virtual-${plan.id}-${dStr}`,
          maquina_nombre: maquina.nombre,
          titulo: plan.titulo,
          estado: 'futuro', 
          fecha_limite: dStr
        });
      }
    }
  });

  const todasLasTareasCalendario = Object.values(tareasPorDia).flat();

  // --- OBTENCIÓN DE DATOS ---
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

  // --- ACCIONES ---
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
      setStatus('Analizando con IA...');
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

  // --- VISTA DE LOGIN ---
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

  // --- VISTA APLICACIÓN ---
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

      {/* --- PANEL OPERARIO --- */}
      {view === 'operario' ? (
        <main className="animate-in" style={{width: '100%'}}>
          <section style={{textAlign:'left', marginBottom:'30px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h3 style={{color: '#94a3b8', fontSize: '0.9rem'}}>📋 TAREAS DE HOY</h3>
              <button className="excel-btn" style={{padding:'5px 10px', fontSize:'0.7rem', margin:0}} onClick={() => exportExcel(tareas.filter(t=>t.estado==='pendiente'), "Tareas_Hoy")}>📥 Bajar Hoja</button>
            </div>
            {tareas.filter(t => t.estado === 'pendiente').map(t => (
              <div key={t.id} style={{background: 'white', padding:'15px', borderRadius:'15px', color:'#1e293b', marginBottom:'10px', borderLeft:'6px solid #6366f1'}}>
                <div style={{fontWeight:'800'}}>{t.titulo}</div>
                <div style={{fontSize:'0.75rem', color:'#64748b'}}>{t.maquina_nombre} - Límite: {t.fecha_limite}</div>
                <button onClick={async () => {
                  await fetch(`${API_URL}/api/complete-task/${t.id}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({maquina_nombre: t.maquina_nombre, titulo_tarea: t.titulo}) });
                  fetchData();
                }} style={{marginTop:'10px', background:'#10b981', color:'white', border:'none', padding:'8px 12px', borderRadius:'8px', cursor:'pointer', fontWeight:'700', width:'100%'}}>HECHO ✓</button>
              </div>
            ))}
          </section>

          <div className="voice-section">
            <button className={`record-btn-giant ${isRecording ? 'is-recording' : ''}`} onClick={startListening}><span style={{fontSize:'4rem'}}>🎤</span></button>
            <p style={{marginTop:'20px', fontWeight:'800', color:'#94a3b8'}}>{isRecording ? 'ESCUCHANDO...' : 'REPORTAR AVERÍA'}</p>
            {status && <div className="status-pill status-ok" style={{marginTop:'10px'}}>{status}</div>}
          </div>

          {iaData && (
            <div className="ia-card animate-in" style={{background:'#1e293b', padding:'20px', borderRadius:'20px', borderLeft:'5px solid #6366f1', textAlign:'left', marginTop:'20px'}}>
              <h3>Detección IA (Avería)</h3>
              <p><strong>Máquina:</strong> {iaData.maquina_nombre}</p>
              <p><strong>Piezas Usadas:</strong> {iaData.repuestos_usados?.join(', ')}</p>
              <button className="confirm-button" onClick={async () => {
                await fetch(`${API_URL}/api/save-intervention`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...iaData, empresa_id: user.empresa_id, usuario_id: user.id }) });
                setIaData(null);
                alert("Avería registrada con éxito.");
                fetchData();
              }} style={{marginTop:'15px'}}>CONFIRMAR REGISTRO</button>
            </div>
          )}
        </main>
      ) : (

        /* --- PANEL GERENCIA --- */
        <div className="dashboard-view animate-in" style={{width: '100%'}}>
          <div className="sub-nav">
            <button className={subView === 'resumen' ? 's-active' : ''} onClick={()=>setSubView('resumen')}>Resumen</button>
            <button className={subView === 'calendario' ? 's-active' : ''} onClick={()=>setSubView('calendario')}>📅 Calendario</button>
            <button className={subView === 'maquinas' ? 's-active' : ''} onClick={()=>setSubView('maquinas')}>Maquinaria</button>
            <button className={subView === 'historial' ? 's-active' : ''} onClick={()=>setSubView('historial')}>Historial</button>
            <button className={subView === 'inventario' ? 's-active' : ''} onClick={()=>setSubView('inventario')}>Stock</button>
            <button className={subView === 'equipo' ? 's-active' : ''} onClick={()=>setSubView('equipo')}>👥 Equipo</button>
          </div>

          {subView === 'resumen' && (
            <div className="stats-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop:'20px'}}>
              <div className="stat-card" style={{background: '#1e293b', padding: '20px', borderRadius: '20px'}}>
                <h4 style={{marginBottom:'20px', color:'#94a3b8', textAlign:'left'}}>Frecuencia de Averías</h4>
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

          {subView === 'calendario' && (() => {
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const firstDay = new Date(currentYear, currentMonth, 1).getDay();
            const emptySlots = firstDay === 0 ? 6 : firstDay - 1; // Lunes = 1
            const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
            const blanks = Array.from({length: emptySlots}, (_, i) => i);
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            return (
              <div style={{marginTop: '20px', background: 'white', padding: '20px', borderRadius: '20px', color: '#1e293b', boxShadow:'0 4px 6px rgba(0,0,0,0.1)', width: '100%', boxSizing: 'border-box', overflowX: 'auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom:'20px'}}>
                  <h3 style={{fontWeight:'900', fontSize:'1.4rem'}}>{monthNames[currentMonth].toUpperCase()} {currentYear}</h3>
                  <button className="excel-btn" style={{padding:'8px 15px', fontSize:'0.8rem', margin:0}} onClick={()=>exportExcel(todasLasTareasCalendario, `Planificacion_${monthNames[currentMonth]}`)}>📥 Exportar Mes</button>
                </div>
                {/* El cambio clave: minmax(0, 1fr) evita que las columnas se estiren infinitamente y minWidth asegura que no se aplaste en móviles */}
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px', minWidth: '700px'}}>
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d} style={{fontWeight:'900', fontSize:'0.85rem', color:'#64748b', textAlign:'center', borderBottom:'2px solid #f1f5f9', paddingBottom:'10px'}}>{d}</div>)}
                  {blanks.map(b => <div key={`b-${b}`} style={{minHeight:'100px'}}></div>)}
                  {days.map(day => {
                    const dStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const tDelDia = tareasPorDia[dStr] || [];
                    const isToday = new Date().toISOString().split('T')[0] === dStr;
                    return (
                      <div key={day} style={{border: isToday ? '2px solid #6366f1' : '1px solid #e2e8f0', borderRadius: '10px', minHeight: '100px', padding: '8px', display:'flex', flexDirection:'column', background: isToday ? '#eef2ff' : (tDelDia.length > 0 ? '#f8fafc' : 'transparent')}}>
                        <div style={{fontSize:'0.9rem', fontWeight:'800', color: isToday ? 'white' : '#94a3b8', alignSelf:'flex-end', background: isToday ? '#6366f1' : 'transparent', padding: isToday ? '2px 8px' : '0', borderRadius:'6px'}}>{day}</div>
                        <div style={{flex:1, marginTop:'8px', display:'flex', flexDirection:'column', gap:'4px'}}>
                          {tDelDia.map(t => (
                            <div key={t.id} style={{
                              fontSize:'0.6rem', padding:'4px 6px', borderRadius:'6px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                              background: t.estado === 'futuro' ? '#f1f5f9' : (t.estado === 'pendiente' ? '#fee2e2' : '#dcfce7'),
                              color: t.estado === 'futuro' ? '#475569' : (t.estado === 'pendiente' ? '#991b1b' : '#166534'),
                              borderLeft: `3px solid ${t.estado === 'futuro' ? '#94a3b8' : (t.estado === 'pendiente' ? '#ef4444' : '#10b981')}`
                            }} title={`${t.maquina_nombre} - ${t.titulo}`}>
                              <b>{t.maquina_nombre}</b> {t.titulo}
                            </div>
                          ))}
                        </div>
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
                <div key={m.id} style={{background:'white', color:'#1e293b', padding:'25px', borderRadius:'20px', textAlign:'left', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                    <span style={{fontWeight:'900', fontSize:'1.1rem'}}>{m.nombre}</span>
                    <button onClick={()=>setShowQR(m.nombre)} style={{background:'#f1f5f9', border:'none', cursor:'pointer', fontSize:'1.2rem', padding:'5px 10px', borderRadius:'8px'}} title="Ver QR">🔲</button>
                  </div>
                  <div style={{marginBottom:'15px', padding:'12px', background:'#f8fafc', borderRadius:'12px', border:'1px solid #e2e8f0'}}>
                    <span style={{fontSize:'0.75rem', fontWeight:'800', color:'#64748b'}}>PLANES PREVENTIVOS ACTIVOS:</span>
                    {planes.filter(p => p.maquina_id === m.id).length === 0 ? (
                      <p style={{fontSize:'0.8rem', marginTop:'5px', color:'#94a3b8'}}>Sin planes.</p>
                    ) : (
                      planes.filter(p => p.maquina_id === m.id).map(p => (
                        <div key={p.id} style={{fontSize:'0.8rem', borderBottom:'1px solid #e2e8f0', padding:'6px 0', color:'#334155'}}>🛠 <b>{p.titulo}</b> <span style={{color:'#6366f1', fontSize:'0.7rem'}}>(Cada {p.frecuencia_dias}d)</span></div>
                      ))
                    )}
                  </div>
                  <button onClick={async () => {
                    const t = prompt("Nueva tarea (ej: Cambio de aceite)");
                    const f = prompt("Frecuencia en días (ej: 30)");
                    if(t && f) {
                      const resp = await fetch(`${API_URL}/api/add-plan`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({maquina_id: m.id, titulo: t, frecuencia_dias: parseInt(f), empresa_id: user.empresa_id, ultima_fecha: new Date().toISOString().split('T')[0]}) });
                      const data = await resp.json();
                      if(data.error) alert("Error DB: " + data.error); else fetchData();
                    }
                  }} className="confirm-button" style={{padding:'12px', fontSize:'0.8rem', background:'#10b981', boxShadow:'0 4px 10px rgba(16,185,129,0.3)'}}>+ AÑADIR PLAN</button>
                </div>
              ))}
            </div>
          )}

          {subView === 'historial' && (
            <div style={{marginTop:'20px'}}>
              <div style={{textAlign:'left', marginBottom:'15px'}}><button className="excel-btn" onClick={() => exportExcel(history, "Historial_Averias")}>📥 Exportar Historial</button></div>
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
            
          )}{subView === 'equipo' && (() => {
            const [listaUsuarios, setListaUsuarios] = useState([]);
            
            useEffect(() => {
              fetch(`${API_URL}/api/users?empresa_id=${user.empresa_id}`)
                .then(res => res.json())
                .then(data => setListaUsuarios(data));
            }, []);

            return (
              <div style={{marginTop:'20px', background:'white', padding:'25px', borderRadius:'20px', textAlign:'left', color:'#1e293b'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                  <h3 style={{fontWeight:'900'}}>GESTIÓN DE TÉCNICOS</h3>
                  <button className="confirm-button" style={{padding:'8px 15px', width:'auto', background:'#10b981'}} onClick={async () => {
                    const n = prompt("Nombre del operario");
                    const p = prompt("Asigna un PIN de 4 números");
                    if(n && p) {
                      await fetch(`${API_URL}/api/users`, {
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({nombre: n, pin_acceso: p, empresa_id: user.empresa_id, rol: 'operario', email: `${n.toLowerCase().replace(' ','')}@mantia.com`})
                      });
                      window.location.reload(); // Recarga simple para actualizar
                    }
                  }}>+ NUEVO OPERARIO</button>
                </div>
                <table className="history-table">
                  <thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th></tr></thead>
                  <tbody>
                    {listaUsuarios.map(u => (
                      <tr key={u.id}>
                        <td style={{fontWeight:'700'}}>{u.nombre}</td>
                        <td>{u.rol}</td>
                        <td><span className="status-pill status-ok">ACTIVO</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión</button>
        </div>
      )}

      {/* --- MODAL DE QR --- */}
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
