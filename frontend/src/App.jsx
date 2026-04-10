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
  const [chartData, setChartData] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showQR, setShowQR] = useState(null);

  // Formulario nueva tarea
  const [newTask, setNewTask] = useState({ maquina_nombre: '', titulo: '', descripcion: '', fecha_limite: '' });

  const fetchData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/gerencia-data?empresa_id=${user.empresa_id}`);
      const data = await res.json();
      setHistory(data.history || []);
      setStock(data.stock || []);
      setMaquinas(data.maquinas || []);
      setTareas(data.tareas || []);
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

  const createTask = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/create-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTask, empresa_id: user.empresa_id })
    });
    setNewTask({ maquina_nombre: '', titulo: '', descripcion: '', fecha_limite: '' });
    fetchData();
    alert("Orden de tarea creada");
  };

  const completeTask = async (id) => {
    await fetch(`${API_URL}/api/complete-task/${id}`, { method: 'PUT' });
    fetchData();
  };

  if (!user) return (
    <div className="container login-screen">
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <img src="/logo.png" alt="Logo" style={{ height: '140px' }} />
        <h1 className="brand-name">MantIA</h1>
      </div>
      <div className="login-card">
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
      
      <header style={{ marginBottom: '30px' }}><img src="/logo.png" alt="Logo" style={{ height: '80px' }} /><h2 className="brand-name">MantIA</h2></header>

      <nav className="nav-tabs">
        <button className={view === 'operario' ? 'active' : ''} onClick={() => setView('operario')}>👷 Reporte</button>
        <button className={view === 'gerencia' ? 'active' : ''} onClick={() => setView('gerencia')}>📊 Gerencia</button>
      </nav>

      {view === 'operario' ? (
        <main className="animate-in">
          {/* SECCIÓN TAREAS PENDIENTES PARA EL TÉCNICO */}
          <section style={{marginBottom: '40px', textAlign:'left'}}>
            <h3 style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom:'15px'}}>📋 TAREAS PENDIENTES</h3>
            {tareas.filter(t => t.estado === 'pendiente').map(t => (
              <div key={t.id} style={{background: 'white', padding:'15px', borderRadius:'15px', color:'#0f172a', marginBottom:'10px', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
                <div style={{fontWeight:'800'}}>{t.titulo}</div>
                <div style={{fontSize:'0.8rem', color:'#64748b'}}>{t.maquina_nombre} - Límite: {t.fecha_limite}</div>
                <button onClick={() => completeTask(t.id)} style={{marginTop:'10px', background:'#10b981', color:'white', border:'none', padding:'5px 10px', borderRadius:'8px', cursor:'pointer', fontWeight:'700'}}>Marcar como Hecho</button>
              </div>
            ))}
          </section>

          <div className="voice-section">
            <button className={`record-btn-giant ${isRecording ? 'is-recording' : ''}`} onClick={() => {/* Lógica voz */}}><span style={{fontSize: '4rem'}}>🎤</span></button>
            <p style={{marginTop:'20px', fontWeight:'800', color:'#94a3b8'}}>O REPORTA UNA AVERÍA NUEVA</p>
          </div>
        </main>
      ) : (
        <div className="dashboard-view animate-in">
          <div className="sub-nav">
            <button className={subView === 'resumen' ? 's-active' : ''} onClick={()=>setSubView('resumen')}>Resumen</button>
            <button className={subView === 'tareas' ? 's-active' : ''} onClick={()=>setSubView('tareas')}>Ordenes Trabajo</button>
            <button className={subView === 'inventario' ? 's-active' : ''} onClick={()=>setSubView('inventario')}>Inventario</button>
          </div>

          {subView === 'tareas' && (
            <div className="animate-in">
              <form onSubmit={createTask} style={{background: 'rgba(255,255,255,0.05)', padding:'20px', borderRadius:'20px', marginBottom:'30px', textAlign:'left'}}>
                <h4 style={{marginBottom:'15px'}}>Nueva Orden de Trabajo</h4>
                <input type="text" placeholder="Título (Ej: Cambio filtros)" required value={newTask.titulo} onChange={e=>setNewTask({...newTask, titulo:e.target.value})} style={{width:'100%', padding:'10px', marginBottom:'10px', borderRadius:'8px', border:'none'}} />
                <input type="text" placeholder="Máquina" required value={newTask.maquina_nombre} onChange={e=>setNewTask({...newTask, maquina_nombre:e.target.value})} style={{width:'100%', padding:'10px', marginBottom:'10px', borderRadius:'8px', border:'none'}} />
                <input type="date" required value={newTask.fecha_limite} onChange={e=>setNewTask({...newTask, fecha_limite:e.target.value})} style={{width:'100%', padding:'10px', marginBottom:'10px', borderRadius:'8px', border:'none'}} />
                <button type="submit" className="confirm-button">Crear Preventivo</button>
              </form>

              <table className="history-table">
                <thead><tr><th>Tarea</th><th>Máquina</th><th>Estado</th></tr></thead>
                <tbody>
                  {tareas.map(t => (
                    <tr key={t.id}>
                      <td style={{fontWeight:'700'}}>{t.titulo}</td>
                      <td>{t.maquina_nombre}</td>
                      <td><span className={`status-pill ${t.estado === 'pendiente' ? 'status-warn' : 'status-ok'}`}>{t.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* ... resto de subviews ... */}
          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión</button>
        </div>
      )}
    </div>
  );
}

export default App;