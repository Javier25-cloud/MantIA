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
  const [chartData, setChartData] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showQR, setShowQR] = useState(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/gerencia-data?empresa_id=${user.empresa_id}`);
      const data = await res.json();
      setHistory(data.history || []);
      setStock(data.stock || []);
      setMaquinas(data.maquinas || []);
      setChartData(data.chartData || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (user && view === 'gerencia') fetchData();
  }, [view, user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinInput })
    });
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
      setStatus(`Analizando...`);
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

  const exportToExcel = (data, name) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${name}.xlsx`);
  };

  if (!user) return (
    <div className="container login-screen">
      <div style={{ marginBottom: '30px' }}>
        <img src="/logo.png" alt="MantIA Logo" style={{ height: '140px' }} />
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
      
      {/* BOTÓN VOLVER AL PIN (ARRIBA IZQUIERDA) */}
      <button className="home-nav-btn" onClick={() => setUser(null)}>
        <img src="/logo.png" alt="Logo" />
        <span>MantIA Inicio</span>
      </button>

      <header style={{ marginBottom: '30px' }}>
        <img src="/logo.png" alt="MantIA Logo" style={{ height: '80px' }} />
        <h2 className="brand-name" style={{fontSize: '1.8rem'}}>MantIA</h2>
      </header>

      <nav className="nav-tabs" style={{display:'flex', justifyContent:'center', width:'fit-content', margin:'0 auto 30px'}}>
        <button className={view === 'operario' ? 'active' : ''} onClick={() => setView('operario')}>👷 Reporte</button>
        <button className={view === 'gerencia' ? 'active' : ''} onClick={() => setView('gerencia')}>📊 Gerencia</button>
      </nav>

      {view === 'operario' ? (
        <main className="animate-in">
          <div className="voice-section">
            <button className={`record-btn-giant ${isRecording ? 'is-recording' : ''}`} onClick={startListening}>
              <span style={{fontSize: '4rem'}}>🎤</span>
            </button>
            <p style={{marginTop:'20px', fontWeight:'800', color:'#94a3b8'}}>{isRecording ? 'TE ESCUCHO...' : 'PULSA PARA REPORTAR'}</p>
            {status && <div className="status-pill status-ok" style={{marginTop:'15px', display:'inline-block'}}>{status}</div>}
          </div>
          {iaData && (
            <div className="ia-card" style={{background:'#1e293b', padding:'20px', borderRadius:'20px', borderLeft:'5px solid #6366f1', textAlign:'left', marginTop:'20px'}}>
              <h3>Detección IA</h3>
              <p><strong>Máquina:</strong> {iaData.maquina_nombre}</p>
              <p><strong>Piezas:</strong> {iaData.repuestos_usados?.join(', ')}</p>
              <button className="confirm-button" onClick={async () => {
                await fetch(`${API_URL}/api/save-intervention`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...iaData, empresa_id: user.empresa_id, usuario_id: user.id })
                });
                setIaData(null);
                alert("Guardado");
              }}>CONFIRMAR REGISTRO</button>
            </div>
          )}
        </main>
      ) : (
        <div className="dashboard-view animate-in">
          <div className="sub-nav">
            <button className={subView === 'resumen' ? 's-active' : ''} onClick={()=>setSubView('resumen')}>Resumen</button>
            <button className={subView === 'maquinas' ? 's-active' : ''} onClick={()=>setSubView('maquinas')}>Máquinas</button>
            <button className={subView === 'historial' ? 's-active' : ''} onClick={()=>setSubView('historial')}>Historial</button>
            <button className={subView === 'inventario' ? 's-active' : ''} onClick={()=>setSubView('inventario')}>Inventario</button>
          </div>

          {subView === 'resumen' && (
            <div className="stats-grid" style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px'}}>
              <div className="stat-card" style={{background: '#1e293b', padding: '20px', borderRadius: '20px'}}>
                <h4 style={{marginBottom:'20px', color:'#94a3b8'}}>Frecuencia de Averías</h4>
                <div style={{height: '250px'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} style={{fontSize: '12px', fill:'#fff'}} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                        {chartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="stat-card" style={{textAlign: 'center', background: '#1e293b', padding: '20px', borderRadius: '20px'}}>
                <div style={{fontSize: '3rem', fontWeight: '800', color: '#6366f1'}}>{history.length}</div>
                <p>Intervenciones</p>
                <div style={{fontSize: '3rem', fontWeight: '800', color: '#ef4444', marginTop: '20px'}}>{stock.filter(s=>s.stock_actual <= s.stock_minimo).length}</div>
                <p>Stock Crítico</p>
              </div>
            </div>
          )}

          {subView === 'maquinas' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:'20px'}}>
              {maquinas.map(m => (
                <div key={m.id} style={{background:'white', color:'#1e293b', padding:'20px', borderRadius:'20px'}}>
                  <span style={{fontWeight:'800', display:'block', marginBottom:'10px'}}>{m.nombre}</span>
                  <button onClick={() => setShowQR(m.nombre)} style={{background:'#6366f1', color:'white', border:'none', padding:'8px 15px', borderRadius:'10px', cursor:'pointer', width:'100%'}}>QR</button>
                </div>
              ))}
            </div>
          )}

          {subView === 'historial' && (
            <div>
              <button className="excel-btn" onClick={() => exportToExcel(history, "Historial")}>📥 Exportar Excel</button>
              <table className="history-table">
                <thead><tr><th>Fecha</th><th>Máquina</th><th>Piezas</th></tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.fecha).toLocaleDateString()}</td>
                      <td style={{fontWeight: 'bold'}}>{h.maquina}</td>
                      <td>{h.repuestos?.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subView === 'inventario' && (
            <div>
              <div className="action-bar" style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                <button className="excel-btn" onClick={() => exportToExcel(stock, "Inventario")}>📥 Exportar</button>
                <label className="excel-btn import" style={{cursor: 'pointer'}}>📤 Importar
                  <input type="file" onChange={(e)=>{/* Lógica de importación aquí */}} accept=".xlsx, .xls" hidden />
                </label>
              </div>
              <table className="history-table">
                <thead><tr><th>Repuesto</th><th>Stock</th><th>Estado</th></tr></thead>
                <tbody>
                  {stock.map(s => (
                    <tr key={s.id}>
                      <td>{s.nombre}</td>
                      <td style={{fontWeight: 'bold'}}>{s.stock_actual}</td>
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
          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión</button>
        </div>
      )}

      {showQR && (
        <div className="modal-overlay" onClick={()=>setShowQR(null)}>
          <div className="modal-content" style={{background:'white', padding:'30px', borderRadius:'20px', textAlign:'center', color:'#1e293b'}}>
            <h3>Identificador QR</h3>
            <QRCodeCanvas value={`ID:${showQR}`} size={180} />
            <p style={{marginTop:'15px', fontWeight:'800'}}>{showQR}</p>
            <button onClick={()=>setShowQR(null)} className="confirm-button" style={{marginTop:'20px'}}>CERRAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;