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

// Lógica de Calendario
  const tareasPorDia = tareas.reduce((acc, t) => {
    const fecha = t.fecha_limite;
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(t);
    return acc;
  }, {});

  const downloadDailyOrders = (fecha) => {
    exportExcel(tareasPorDia[fecha] || [], `Ordenes_${fecha}`);
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
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h3 style={{color: '#94a3b8', fontSize: '0.9rem'}}>📋 TAREAS DE HOY</h3>
              <button className="excel-btn" style={{padding:'5px 10px', fontSize:'0.7rem'}} onClick={() => exportExcel(tareas.filter(t=>t.estado==='pendiente'), "Tareas_Hoy")}>📥 Bajar PDF/Excel</button>
            </div>
            {tareas.filter(t => t.estado === 'pendiente').map(t => (
              <div key={t.id} style={{background: 'white', padding:'15px', borderRadius:'15px', color:'#1e293b', marginBottom:'10px', borderLeft:'6px solid #6366f1'}}>
                <div style={{fontWeight:'800'}}>{t.titulo}</div>
                <div style={{fontSize:'0.75rem', color:'#64748b'}}>{t.maquina_nombre} - Límite: {t.fecha_limite}</div>
                <button onClick={async () => {
                  await fetch(`${API_URL}/api/complete-task/${t.id}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({maquina_nombre: t.maquina_nombre}) });
                  fetchData();
                }} style={{marginTop:'10px', background:'#10b981', color:'white', border:'none', padding:'8px 12px', borderRadius:'8px', cursor:'pointer', fontWeight:'700', width:'100%'}}>HECHO ✓</button>
              </div>
            ))}
          </section>

          <div className="voice-section">
            <button className={`record-btn-giant ${isRecording ? 'is-recording' : ''}`} onClick={() => {/* Lógica Voz */}}><span style={{fontSize: '4rem'}}>🎤</span></button>
            <p style={{marginTop:'20px', fontWeight:'800', color:'#94a3b8'}}>O REPORTA UNA AVERÍA</p>
          </div>
        </main>
      ) : (
        <div className="dashboard-view animate-in">
          <div className="sub-nav">
            <button className={subView === 'resumen' ? 's-active' : ''} onClick={()=>setSubView('resumen')}>Resumen</button>
            <button className={subView === 'calendario' ? 's-active' : ''} onClick={()=>setSubView('calendario')}>📅 Calendario</button>
            <button className={subView === 'maquinas' ? 's-active' : ''} onClick={()=>setSubView('maquinas')}>Programar</button>
            <button className={subView === 'historial' ? 's-active' : ''} onClick={()=>setSubView('historial')}>Historial</button>
            <button className={subView === 'inventario' ? 's-active' : ''} onClick={()=>setSubView('inventario')}>Stock</button>
          </div>

          {subView === 'maquinas' && (
            <div className="machine-grid">
              {maquinas.map(m => (
                <div key={m.id} className="machine-item" style={{background:'white', color:'#1e293b', padding:'20px', borderRadius:'20px'}}>
                  <span style={{fontWeight:'800', fontSize:'1.1rem'}}>{m.nombre}</span>
                  <div style={{margin:'10px 0', fontSize:'0.8rem', color:'#64748b'}}>
                    Mantenimiento: <b>{m.mantenimiento_plan || 'No asignado'}</b><br/>
                    Cada: <b>{m.frecuencia_dias || '0'} días</b>
                  </div>
                  <button onClick={() => {
                    const p = prompt("Tarea (Ej: Engrase)", m.mantenimiento_plan);
                    const d = prompt("Frecuencia (Días)", m.frecuencia_dias);
                    if(p && d) fetch(`${API_URL}/api/update-machine-plan/${m.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({plan:p, dias:parseInt(d)}) }).then(()=>fetchData());
                  }} className="qr-btn" style={{width:'100%'}}>⚙ CONFIGURAR</button>
                </div>
              ))}
            </div>
          )}
          {subView === 'calendario' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'10px', marginTop:'20px'}}>
              {Object.keys(tareasPorDia).sort().map(fecha => (
                <div key={fecha} style={{background:'white', padding:'15px', borderRadius:'12px', color:'#1e293b', textAlign:'left'}}>
                  <div style={{fontWeight:'800', borderBottom:'1px solid #eee', paddingBottom:'5px', marginBottom:'10px'}}>{fecha}</div>
                  {tareasPorDia[fecha].map(t => (
                    <div key={t.id} style={{fontSize:'0.75rem', background:'#f1f5f9', padding:'5px', borderRadius:'6px', marginBottom:'5px', borderLeft:`4px solid ${t.estado === 'pendiente' ? '#ef4444' : '#10b981'}`}}>
                      <b>{t.maquina_nombre}</b><br/>{t.titulo}
                    </div>
                  ))}
                  <button onClick={()=>downloadDailyOrders(fecha)} style={{width:'100%', fontSize:'0.7rem', marginTop:'10px', background:'#6366f1', color:'white', border:'none', padding:'5px', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>📥 Bajar Día</button>
                </div>
              ))}
            </div>
          )}

          {subView === 'maquinas' && (
            <div className="machine-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'20px'}}>
              {maquinas.map(m => (
                <div key={m.id} className="machine-item" style={{background:'white', color:'#1e293b', padding:'20px', borderRadius:'20px', textAlign:'left'}}>
                  <span style={{fontWeight:'900', fontSize:'1.1rem', display:'block', marginBottom:'10px'}}>{m.nombre}</span>
                  <div style={{marginBottom:'15px', padding:'10px', background:'#f8fafc', borderRadius:'10px'}}>
                    <span style={{fontSize:'0.7rem', color:'#64748b', fontWeight:'bold'}}>PLANES ACTIVOS:</span>
                    {planes.filter(p => p.maquina_id === m.id).length === 0 ? <p style={{fontSize:'0.8rem', marginTop:'5px'}}>Sin planes.</p> : null}
                    {planes.filter(p => p.maquina_id === m.id).map(p => (
                      <div key={p.id} style={{fontSize:'0.8rem', padding:'5px 0', borderBottom:'1px solid #e2e8f0', color:'#334155'}}>
                        🛠 <b>{p.titulo}</b> <span style={{color:'#6366f1'}}>(Cada {p.frecuencia_dias}d)</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    const t = prompt("Nueva tarea (ej: Engrase de cadenas)");
                    const f = prompt("Frecuencia (en días, ej: 30)");
                    if(t && f) fetch(`${API_URL}/api/add-plan`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({maquina_id: m.id, titulo: t, frecuencia_dias: parseInt(f), empresa_id: user.empresa_id})}).then(()=>fetchData());
                  }} className="qr-btn" style={{width:'100%', background:'#10b981'}}>+ AÑADIR PLAN</button>
                </div>
              ))}
            </div>
          )}

          {subView === 'historial' && (
            <div>
              <button className="excel-btn" onClick={() => exportExcel(history, "Historial")}>📥 Exportar Excel</button>
              <table className="history-table">
                <thead><tr><th>Fecha</th><th>Máquina</th><th>Piezas</th></tr></thead>
                <tbody>{history.map(h => (<tr key={h.id}><td>{new Date(h.fecha).toLocaleDateString()}</td><td>{h.maquina}</td><td>{h.repuestos?.join(', ')}</td></tr>))}</tbody>
              </table>
            </div>
          )}

          {subView === 'inventario' && (
            <div>
              <button className="excel-btn" onClick={() => exportExcel(stock, "Stock")}>📥 Exportar Stock</button>
              <table className="history-table">
                <thead><tr><th>Repuesto</th><th>Stock</th><th>Estado</th></tr></thead>
                <tbody>{stock.map(s => (<tr key={s.id}><td>{s.nombre}</td><td>{s.stock_actual}</td><td><span className={`status-pill ${s.stock_actual <= s.stock_minimo ? 'status-warn' : 'status-ok'}`}>{s.stock_actual <= s.stock_minimo ? '⚠️ PEDIR' : '✅ OK'}</span></td></tr>))}</tbody>
              </table>
            </div>
          )}
          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión</button>
        </div>
      )}
    </div>
  );
}
// ... (mantenemos login e imports)

app.get('/api/gerencia-data', async (req, res) => {
  const { empresa_id } = req.query;
  try {
    const [history, stock, machines, tasks, allPlans] = await Promise.all([
      supabase.from('intervenciones').select('*').eq('empresa_id', empresa_id),
      supabase.from('repuestos').select('*').eq('empresa_id', empresa_id),
      supabase.from('maquinas').select('*').eq('empresa_id', empresa_id),
      supabase.from('tareas').select('*').eq('empresa_id', empresa_id),
      supabase.from('planes_mantenimiento').select('*').eq('empresa_id', empresa_id)
    ]);

    // LÓGICA DE AUTO-GENERACIÓN MULTI-PLAN
    const hoy = new Date();
    for (let plan of (allPlans.data || [])) {
      const ultima = new Date(plan.ultima_fecha);
      const diasPasados = Math.floor((hoy - ultima) / (1000 * 60 * 60 * 24));

      if (diasPasados >= plan.frecuencia_dias) {
        const maquina = machines.data.find(m => m.id === plan.maquina_id);
        const yaExiste = tasks.data?.find(t => t.titulo === plan.titulo && t.maquina_nombre === maquina.nombre && t.estado === 'pendiente');
        
        if (!yaExiste) {
          await supabase.from('tareas').insert([{
            empresa_id,
            maquina_nombre: maquina.nombre,
            titulo: plan.titulo,
            fecha_limite: hoy.toISOString().split('T')[0]
          }]);
        }
      }
    }

    // Volvemos a leer tareas actualizadas
    const finalTasks = await supabase.from('tareas').select('*').eq('empresa_id', empresa_id);
    res.json({ history: history.data, stock: stock.data, maquinas: machines.data, tareas: finalTasks.data, planes: allPlans.data });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Endpoint para añadir un nuevo plan a una máquina
app.post('/api/add-plan', async (req, res) => {
  await supabase.from('planes_mantenimiento').insert([req.body]);
  res.json({ success: true });
});

export default App;