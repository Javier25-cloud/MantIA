import { useState, useEffect } from 'react';
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
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    if (user && view === 'gerencia') fetchData();
  }, [view, user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinInput })
      });
      const result = await res.json();
      if (result.success) setUser(result.user);
      else alert("PIN Incorrecto");
    } catch (err) {
      alert("Error de conexión con el servidor");
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Navegador no compatible con voz.");
    
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

  const saveToDB = async () => {
    setStatus('Guardando...');
    await fetch(`${API_URL}/api/save-intervention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...iaData, empresa_id: user.empresa_id, usuario_id: user.id })
    });
    setStatus('✅ Registrado');
    setIaData(null);
    fetchData();
    setTimeout(() => setStatus(''), 2000);
  };

  // VISTA DE LOGIN
  if (!user) return (
    <div className="container login-screen">
      <h1>MantIA</h1>
      <div className="login-card animate-in">
        <form onSubmit={handleLogin}>
          <input 
            type="password" 
            value={pinInput} 
            onChange={(e)=>setPinInput(e.target.value)} 
            className="pin-input" 
            placeholder="••••" 
            autoFocus 
          />
          <button type="submit" className="confirm-button">ENTRAR AL SISTEMA</button>
        </form>
      </div>
    </div>
  );

  // VISTA PRINCIPAL
  return (
    <div className="container" style={{maxWidth: view === 'gerencia' ? '1000px' : '450px'}}>
      <nav className="nav-tabs">
        <button className={view === 'operario' ? 'active' : ''} onClick={() => setView('operario')}>👷 Reporte</button>
        {user.rol === 'gerente' && <button className={view === 'gerencia' ? 'active' : ''} onClick={() => setView('gerencia')}>📊 Gerencia</button>}
      </nav>

      {view === 'operario' ? (
        <main className="main-content animate-in">
          <button className={`record-button ${isRecording ? 'recording' : ''}`} onClick={startListening}>🎤</button>
          {status && <p className="status-msg">{status}</p>}
          {iaData && (
            <div className="ia-card">
              <h3>Detección IA</h3>
              <p><strong>Máquina:</strong> {iaData.maquina_nombre}</p>
              <p><strong>Piezas:</strong> {iaData.repuestos_usados?.join(', ')}</p>
              <button className="confirm-button" onClick={saveToDB}>Confirmar Registro</button>
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
            <div className="stats-section animate-in">
              <div className="stats-grid">
                <div className="stat-card">
                  <h4>Averías por Máquina</h4>
                  <div style={{height: '250px'}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} style={{fontSize: '12px'}} />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                          {chartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="stat-card summary">
                  <div className="big-number">{history.length}</div>
                  <p>Intervenciones</p>
                  <div className="big-number" style={{color: '#ef4444'}}>{stock.filter(s=>s.stock_actual <= s.stock_minimo).length}</div>
                  <p>Alertas Stock</p>
                </div>
              </div>
            </div>
          )}

          {subView === 'maquinas' && (
            <div className="maquinas-section animate-in">
              <div className="machine-grid">
                {maquinas.map(m => (
                  <div key={m.id} className="machine-item">
                    <span>{m.nombre}</span>
                    <button onClick={() => setShowQR(m.nombre)} className="qr-btn">🖼️ Generar QR</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subView === 'historial' && (
            <div className="historial-section animate-in">
              <table className="history-table">
                <thead><tr><th>Fecha</th><th>Máquina</th><th>Piezas</th><th>Acción</th></tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.fecha).toLocaleDateString()}</td>
                      <td>{h.maquina}</td>
                      <td>{h.repuestos?.join(', ')}</td>
                      <td><button onClick={async ()=>{await fetch(`${API_URL}/api/delete-intervention/${h.id}`, {method:'DELETE'}); fetchData();}} className="action-btn">🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subView === 'inventario' && (
            <div className="inventario-section animate-in">
              <table className="history-table">
                <thead><tr><th>Repuesto</th><th>Stock</th><th>Estado</th><th>Acción</th></tr></thead>
                <tbody>
                  {stock.map(s => (
                    <tr key={s.id}>
                      <td>{s.nombre}</td>
                      <td style={{fontWeight: 'bold'}}>{s.stock_actual}</td>
                      <td>
                        <span className={`status-pill ${s.stock_actual <= s.stock_minimo ? 'status-warning' : 'status-ok'}`}>
                          {s.stock_actual <= s.stock_minimo ? '⚠️ PEDIR' : '✅ CORRECTO'}
                        </span>
                      </td>
                      <td><button onClick={()=> {
                        const n = prompt("Nuevo stock:", s.stock_actual);
                        if(n) fetch(`${API_URL}/api/update-stock/${s.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nuevoStock:parseInt(n)})}).then(()=>fetchData());
                      }} className="action-btn">✏️</button></td>
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
          <div className="modal-content">
            <h3>QR: {showQR}</h3>
            <QRCodeCanvas value={`ID:${showQR}`} size={180} />
            <p>Pega este código en el chasis de la máquina.</p>
            <button onClick={()=>setShowQR(null)} className="confirm-button">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;