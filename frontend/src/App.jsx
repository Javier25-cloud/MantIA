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
    const SpeechRecognition = window.SpeechRecognition || window.webkitRecognition;
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

  const handleImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setStatus('Importando...');
      await fetch(`${API_URL}/api/import-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data, empresa_id: user.empresa_id })
      });
      fetchData();
      setStatus('✅ Importado');
      setTimeout(() => setStatus(''), 2000);
    };
    reader.readAsBinaryString(file);
  };

  if (!user) return (
    <div className="container login-screen">
      <img src="/logo.png" alt="MantIA Logo" style={{ height: '150px', marginBottom: '30px' }} />
      <div className="login-card animate-in">
        <form onSubmit={handleLogin}>
          <input type="password" value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="pin-input" placeholder="••••" autoFocus />
          <button type="submit" className="confirm-button">ENTRAR</button>
        </form>
      </div>
    </div>
  );

  return (
    // --- VISTA PRINCIPAL (HEADER CON LOGO MÁS GRANDE) ---
return (
  <div className="container" style={{maxWidth: view === 'gerencia' ? '1100px' : '450px'}}>
    
    {/* Header con el logo centrado y más grande */}
    <header style={{ textAlign: 'center', marginBottom: '30px', padding: '10px 0' }}>
      <img 
        src="/logo.png" 
        alt="MantIA Logo" 
        style={{ 
          height: '90px', // <-- Aumenta este número para hacerlo más grande en la cabecera
          width: 'auto', 
          display: 'block', 
          margin: '0 auto' 
        }} 
      />
    </header>
    
    {/* Navegación por pestañas */}
    <nav className="nav-tabs">
      <button className={view === 'operario' ? 'active' : ''} onClick={() => setView('operario')}>👷 Reporte</button>
      {user.rol === 'gerente' && <button className={view === 'gerencia' ? 'active' : ''} onClick={() => setView('gerencia')}>📊 Gerencia</button>}
    </nav>

      {view === 'operario' ? (
        <main className="main-content animate-in">
          <div className="voice-section">
            <button className={`record-btn-giant ${isRecording ? 'is-recording' : ''}`} onClick={startListening}>
              <span style={{fontSize:'4rem'}}>🎤</span>
            </button>
            <p className="voice-label">{isRecording ? 'HABLA AHORA...' : 'PULSA PARA REPORTAR'}</p>
            {status && <div className="status-pill status-ok" style={{marginTop:'15px', display:'inline-block'}}>{status}</div>}
          </div>
          {iaData && (
            <div className="ia-card">
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
              }}>CONFIRMAR</button>
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
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Frecuencia de Averías</h4>
                <div style={{height: '250px'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} style={{fontSize: '12px', fill:'#fff'}} />
                      <Tooltip cursor={{fill:'transparent'}} />
                      <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                        {chartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="stat-card summary">
                <span className="big-number">{history.length}</span>
                <p>Intervenciones</p>
                <span className="big-number" style={{color:'#ef4444'}}>{stock.filter(s=>s.stock_actual <= s.stock_minimo).length}</span>
                <p>Stock Crítico</p>
              </div>
            </div>
          )}

          {subView === 'maquinas' && (
            <div className="machine-grid">
              {maquinas.map(m => (
                <div key={m.id} className="machine-item">
                  <span className="machine-name">{m.nombre}</span>
                  <button onClick={() => setShowQR(m.nombre)} className="qr-btn">GENERAR QR</button>
                </div>
              ))}
            </div>
          )}

          {subView === 'historial' && (
            <div className="section-container">
              <button className="excel-btn" onClick={()=>exportToExcel(history, "Historial")}>📥 Exportar Excel</button>
              <table className="history-table" style={{marginTop:'15px'}}>
                <thead><tr><th>Fecha</th><th>Máquina</th><th>Piezas</th></tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.fecha).toLocaleDateString()}</td>
                      <td>{h.maquina}</td>
                      <td>{h.repuestos?.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subView === 'inventario' && (
            <div className="section-container">
              <div className="action-bar">
                <button className="excel-btn" onClick={() => exportToExcel(stock, "Inventario")}>📥 Exportar</button>
                <label className="excel-btn import">📤 Importar
                  <input type="file" onChange={handleImport} accept=".xlsx, .xls" hidden />
                </label>
              </div>
              <table className="history-table">
                <thead><tr><th>Repuesto</th><th>Stock</th><th>Estado</th><th>Acción</th></tr></thead>
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
                      <td><button className="action-btn" onClick={()=>{
                        const n=prompt("Nuevo stock:", s.stock_actual);
                        if(n) fetch(`${API_URL}/api/update-stock/${s.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nuevoStock:parseInt(n)})}).then(()=>fetchData());
                      }}>✏️</button></td>
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
            <button onClick={()=>setShowQR(null)} className="confirm-button" style={{marginTop:'20px'}}>CERRAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;