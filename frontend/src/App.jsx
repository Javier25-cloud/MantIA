import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

const API_URL = "https://mantia-backend.onrender.com";

function App() {
  const [user, setUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [view, setView] = useState('operario');
  const [status, setStatus] = useState('');
  const [iaData, setIaData] = useState(null);
  const [history, setHistory] = useState([]);
  const [stock, setStock] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  const fetchGerenciaData = async () => {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/gerencia-data?empresa_id=${user.empresa_id}`);
    const data = await res.json();
    setHistory(data.history || []);
    setStock(data.stock || []);
  };

  useEffect(() => {
    if (user && view === 'gerencia') fetchGerenciaData();
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
      setStatus(`Procesando...`);
      const res = await fetch(`${API_URL}/api/process-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const result = await res.json();
      setIaData(result.data);
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
      body: JSON.stringify({ ...iaData, empresa_id: user.empresa_id, usuario_id: user.id }),
    });
    setStatus('✅ Hecho');
    setIaData(null);
    fetchGerenciaData();
    setTimeout(() => setStatus(''), 2000);
  };

  // --- EXCEL LOGIC ---
  const exportHistory = () => {
    const ws = XLSX.utils.json_to_sheet(history.map(h => ({ Fecha: h.fecha, Maquina: h.maquina, Repuestos: h.repuestos?.join(', ') })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, "Historial_MantIA.xlsx");
  };

  const exportInventory = () => {
    const ws = XLSX.utils.json_to_sheet(stock.map(s => ({ Nombre: s.nombre, Stock_Actual: s.stock_actual, Stock_Minimo: s.stock_minimo })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, "Inventario_Actual.xlsx");
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      setStatus('Importando...');
      await fetch(`${API_URL}/api/import-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data, empresa_id: user.empresa_id })
      });
      fetchGerenciaData();
      setStatus('✅ Inventario Actualizado');
      setTimeout(() => setStatus(''), 2000);
    };
    reader.readAsBinaryString(file);
  };

  const deleteItem = async (id) => {
    if (window.confirm("¿Eliminar registro?")) {
      await fetch(`${API_URL}/api/delete-intervention/${id}`, { method: 'DELETE' });
      fetchGerenciaData();
    }
  };

  const updateStock = async (id, nombre, actual) => {
    const nuevo = prompt(`Nuevo stock para ${nombre}:`, actual);
    if (nuevo !== null) {
      await fetch(`${API_URL}/api/update-stock/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoStock: parseInt(nuevo) })
      });
      fetchGerenciaData();
    }
  };

  if (!user) {
    return (
      <div className="container login-screen">
        <header className="header"><h1>MantIA</h1></header>
        <form onSubmit={handleLogin} className="main-content">
          <input type="password" value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="pin-input" placeholder="Introduce PIN" autoFocus />
          <button type="submit" className="confirm-button">ENTRAR</button>
        </form>
      </div>
    );
  }

  return (
    <div className="container" style={{maxWidth: view === 'gerencia' ? '900px' : '450px'}}>
      <nav className="nav-tabs">
        <button className={view === 'operario' ? 'active' : ''} onClick={() => setView('operario')}>👷 Operario</button>
        {user.rol === 'gerente' && <button className={view === 'gerencia' ? 'active' : ''} onClick={() => setView('gerencia')}>📊 Gerencia</button>}
      </nav>

      {view === 'operario' ? (
        <main className="main-content">
          <button className={`record-button ${isRecording ? 'recording' : ''}`} onClick={startListening}>🎤</button>
          {status && <p className="status-msg">{status}</p>}
          {iaData && (
            <div className="ia-card">
              <h3>Detección IA</h3>
              <p><strong>Máquina:</strong> {iaData.maquina_nombre}</p>
              <p><strong>Repuestos:</strong> {iaData.repuestos_usados?.join(', ')}</p>
              <button className="confirm-button" onClick={saveToDB}>Confirmar</button>
            </div>
          )}
        </main>
      ) : (
        <div className="dashboard-view">
          <div className="section-header">
            <h3>📋 Historial</h3>
            <button className="export-btn" onClick={exportHistory}>📥 Excel Historial</button>
          </div>
          <table className="history-table">
            <thead><tr><th>Fecha</th><th>Máquina</th><th>Piezas</th><th></th></tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.fecha).toLocaleDateString()}</td>
                  <td>{h.maquina}</td>
                  <td>{h.repuestos?.join(', ')}</td>
                  <td><button onClick={()=>deleteItem(h.id)} className="action-btn">🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-header" style={{marginTop: '30px'}}>
            <h3>📦 Inventario</h3>
            <div style={{display: 'flex', gap: '10px'}}>
              <button className="export-btn" style={{backgroundColor: '#10b981'}} onClick={exportInventory}>📥 Exportar</button>
              <label className="import-btn">📤 Importar<input type="file" onChange={handleImport} accept=".xlsx, .xls" style={{display: 'none'}} /></label>
            </div>
          </div>
          <table className="history-table">
            <thead><tr><th>Nombre</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {stock.map(s => (
                <tr key={s.id} className={s.stock_actual <= s.stock_minimo ? 'row-critical' : ''}>
                  <td>{s.nombre}</td>
                  <td style={{fontWeight: 'bold'}}>{s.stock_actual}</td>
                  <td>{s.stock_actual <= s.stock_minimo ? '⚠️ PEDIR' : '✅ OK'}</td>
                  <td><button onClick={()=>updateStock(s.id, s.nombre, s.stock_actual)} className="action-btn">✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión</button>
          {status && <div className="floating-status">{status}</div>}
        </div>
      )}
    </div>
  );
}

export default App;