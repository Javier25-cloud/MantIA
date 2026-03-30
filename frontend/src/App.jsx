import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx'; // Importamos la librería para Excel
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
    try {
      const res = await fetch(`${API_URL}/api/gerencia-data?empresa_id=${user.empresa_id}`);
      const data = await res.json();
      setHistory(data.history || []);
      setStock(data.stock || []);
    } catch (err) { console.error("Error al cargar datos", err); }
  };

  useEffect(() => {
    if (user && view === 'gerencia') fetchGerenciaData();
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
    } catch (err) { alert("El servidor se está despertando, espera 30 seg..."); }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Usa Chrome o Edge.");
    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.onstart = () => { setIsRecording(true); setStatus('Escuchando...'); setIaData(null); };
    rec.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      setStatus(`Analizando con IA...`);
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
    setStatus('✅ Registrado');
    setIaData(null);
    setTimeout(() => setStatus(''), 2000);
  };

  // --- FUNCIONALIDAD EXCEL (REAL) ---
  const exportToExcel = () => {
    if (history.length === 0) return alert("No hay datos para exportar");

    // Preparamos los datos para que el Excel sea legible
    const dataParaExcel = history.map(item => ({
      Fecha: new Date(item.fecha).toLocaleDateString(),
      Maquina: item.maquina,
      Repuestos_Usados: item.repuestos?.join(', '),
      ID_Intervencion: item.id
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataParaExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial MantIA");
    
    // Generar el archivo y descargarlo
    XLSX.writeFile(workbook, `Reporte_Mantenimiento_${new Date().toLocaleDateString()}.xlsx`);
  };

  // FUNCIONES DE GESTIÓN (GERENTE)
  const deleteItem = async (id) => {
    if (window.confirm("¿Borrar este registro definitivamente?")) {
      await fetch(`${API_URL}/api/delete-intervention/${id}`, { method: 'DELETE' });
      fetchGerenciaData();
    }
  };

  const updateStock = async (id, nombre, actual) => {
    const nuevo = prompt(`Nuevo stock para ${nombre}:`, actual);
    if (nuevo !== null && !isNaN(nuevo)) {
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
        <header className="header"><h1>MantIA</h1><p>Mantenimiento Inteligente</p></header>
        <form onSubmit={handleLogin} className="main-content">
          <input type="password" value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="pin-input" placeholder="PIN 1234" autoFocus />
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

      <header className="header"><h1>MantIA</h1><p>{view === 'gerencia' ? 'Panel de Control' : `Hola, ${user.nombre}`}</p></header>

      {view === 'operario' ? (
        <main className="main-content">
          <button className={`record-button ${isRecording ? 'recording' : ''}`} onClick={!isRecording ? startListening : null}>
            {isRecording ? '👂' : '🎤'}<span style={{fontSize: '0.7rem'}}>{isRecording ? 'OYENDO...' : 'GRABAR REPORTE'}</span>
          </button>
          {status && <p className="status-msg">{status}</p>}
          {iaData && (
            <div className="ia-card animate-in">
              <h3>Detección IA</h3>
              <p><strong>MÁQUINA:</strong> {iaData.maquina_nombre}</p>
              <p><strong>PIEZAS:</strong> {iaData.repuestos_usados?.join(', ') || 'Ninguna'}</p>
              <button className="confirm-button" onClick={saveToDB}>Confirmar y Restar Stock</button>
            </div>
          )}
        </main>
      ) : (
        <div className="dashboard-view animate-in">
          <div className="section-header">
            <h3>📋 Historial de Planta</h3>
            <button className="export-btn" onClick={exportToExcel}>📥 Exportar Excel</button>
          </div>
          
          <table className="history-table">
            <thead><tr><th>Fecha</th><th>Máquina</th><th>Repuestos</th><th>Acción</th></tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.fecha).toLocaleDateString()}</td>
                  <td>{h.maquina}</td>
                  <td style={{fontSize: '0.8rem'}}>{h.repuestos?.join(', ')}</td>
                  <td><button onClick={()=>deleteItem(h.id)} className="action-btn">🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{marginTop: '30px'}}>📦 Inventario Actual</h3>
          <table className="history-table">
            <thead><tr><th>Repuesto</th><th>Stock</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {stock.map(s => {
                const esCritico = s.stock_actual <= s.stock_minimo;
                return (
                  <tr key={s.id} className={esCritico ? 'row-critical' : ''}>
                    <td>{s.nombre}</td>
                    <td style={{fontWeight: 'bold', color: esCritico ? '#ef4444' : 'inherit'}}>{s.stock_actual}</td>
                    <td>{esCritico ? '⚠️ PEDIR' : '✅ OK'}</td>
                    <td><button onClick={()=>updateStock(s.id, s.nombre, s.stock_actual)} className="action-btn">✏️</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="logout-btn" onClick={()=>setUser(null)}>Cerrar Sesión</button>
        </div>
      )}
    </div>
  );
}

export default App;