import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react'; // Librería QR
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'; // Gráficas
import './App.css';

const API_URL = "https://mantia-backend.onrender.com";
const COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];

function App() {
  const [user, setUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [view, setView] = useState('operario');
  const [status, setStatus] = useState('');
  const [iaData, setIaData] = useState(null);
  const [history, setHistory] = useState([]);
  const [stock, setStock] = useState([]);
  const [stats, setStats] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showQR, setShowQR] = useState(null); // Para mostrar el modal de QR

  const fetchGerenciaData = async () => {
    if (!user) return;
    const [resData, resStats] = await Promise.all([
      fetch(`${API_URL}/api/gerencia-data?empresa_id=${user.empresa_id}`),
      fetch(`${API_URL}/api/stats?empresa_id=${user.empresa_id}`)
    ]);
    const data = await resData.json();
    const statsData = await resStats.json();
    setHistory(data.history || []);
    setStock(data.stock || []);
    setStats(statsData.chartData || []);
  };

  useEffect(() => {
    if (user && view === 'gerencia') fetchGerenciaData();
  }, [view, user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinInput }) });
    const result = await res.json();
    if (result.success) setUser(result.user);
    else alert("PIN Incorrecto");
  };

  const startListening = () => {
    const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    rec.lang = 'es-ES';
    rec.onstart = () => { setIsRecording(true); setStatus('Escuchando...'); };
    rec.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      setStatus(`Procesando con Gemini...`);
      const res = await fetch(`${API_URL}/api/process-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const r = await res.json();
      setIaData(r.data);
      setStatus('');
    };
    rec.onend = () => setIsRecording(false);
    rec.start();
  };

  const saveToDB = async () => {
    setStatus('Guardando...');
    await fetch(`${API_URL}/api/save-intervention`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...iaData, empresa_id: user.empresa_id, usuario_id: user.id }) });
    setStatus('✅ Registrado');
    setIaData(null);
    fetchGerenciaData();
    setTimeout(() => setStatus(''), 2000);
  };

  if (!user) return (
    <div className="container login-screen">
      <header className="header"><h1>MantIA</h1></header>
      <form onSubmit={handleLogin} className="main-content">
        <input type="password" value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="pin-input" placeholder="PIN 1234" autoFocus />
        <button type="submit" className="confirm-button">ENTRAR</button>
      </form>
    </div>
  );

  return (
    <div className="container" style={{maxWidth: view === 'gerencia' ? '1000px' : '450px'}}>
      <nav className="nav-tabs">
        <button className={view === 'operario' ? 'active' : ''} onClick={() => setView('operario')}>👷 Operario</button>
        {user.rol === 'gerente' && <button className={view === 'gerencia' ? 'active' : ''} onClick={() => setView('gerencia')}>📊 Gerencia</button>}
      </nav>

      {view === 'operario' ? (
        <main className="main-content">
          <div className="card-instruction">Pulsa y describe la reparación</div>
          <button className={`record-button ${isRecording ? 'recording' : ''}`} onClick={startListening}>🎤</button>
          {status && <p className="status-msg">{status}</p>}
          {iaData && (
            <div className="ia-card animate-in">
              <h3>Detección Inteligente</h3>
              <p><strong>Máquina:</strong> {iaData.maquina_nombre}</p>
              <p><strong>Repuestos:</strong> {iaData.repuestos_usados?.join(', ')}</p>
              <button className="confirm-button" onClick={saveToDB}>Confirmar Registro</button>
            </div>
          )}
        </main>
      ) : (
        <div className="dashboard-view animate-in">
          {/* SECCIÓN GRÁFICAS */}
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Top Máquinas (Intervenciones)</h4>
              <div style={{height: '250px'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats}>
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value">
                      {stats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="stat-card summary">
              <div className="big-number">{history.length}</div>
              <p>Intervenciones Totales</p>
              <div className="big-number" style={{color: '#ef4444'}}>{stock.filter(s=>s.stock_actual <= s.stock_minimo).length}</div>
              <p>Alertas de Stock</p>
            </div>
          </div>

          {/* TABLA HISTORIAL */}
          <div className="section-header"><h3>📋 Historial</h3></div>
          <table className="history-table">
            <thead><tr><th>Fecha</th><th>Máquina</th><th>Piezas</th><th></th></tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.fecha).toLocaleDateString()}</td>
                  <td>{h.maquina}</td>
                  <td>{h.repuestos?.join(', ')}</td>
                  <td><button onClick={async ()=>{await fetch(`${API_URL}/api/delete-intervention/${h.id}`, {method:'DELETE'}); fetchGerenciaData();}} className="action-btn">🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TABLA INVENTARIO + QR */}
          <div className="section-header" style={{marginTop:'30px'}}><h3>📦 Inventario y QRs</h3></div>
          <table className="history-table">
            <thead><tr><th>Repuesto / Máquina</th><th>Stock</th><th>Estado</th><th>QR</th></tr></thead>
            <tbody>
              {stock.map(s => (
                <tr key={s.id} className={s.stock_actual <= s.stock_minimo ? 'row-critical' : ''}>
                  <td>{s.nombre}</td>
                  <td style={{fontWeight:'bold'}}>{s.stock_actual}</td>
                  <td>{s.stock_actual <= s.stock_minimo ? '⚠️ PEDIR' : '✅ OK'}</td>
                  <td><button onClick={()=>setShowQR(s.nombre)} className="action-btn">🖼️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión</button>
        </div>
      )}

      {/* MODAL QR */}
      {showQR && (
        <div className="modal-overlay" onClick={()=>setShowQR(null)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <h3>Código QR: {showQR}</h3>
            <QRCodeCanvas value={`MACHINE:${showQR}`} size={200} />
            <p>Pega este código en la máquina para identificarla.</p>
            <button onClick={()=>setShowQR(null)} className="confirm-button">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;