import { useState, useEffect } from 'react';
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

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Usa Chrome.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    
    recognition.onstart = () => { setIsRecording(true); setStatus('Escuchando...'); };
    
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setStatus(`Analizando: "${text}"`);
      try {
        const res = await fetch(`${API_URL}/api/process-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, empresa_id: user.empresa_id })
        });
        const result = await res.json();
        setIaData(result.data);
        setStatus('');
      } catch (err) { setStatus('❌ Error servidor'); }
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinInput: pinInput })
      });
      const result = await res.json();
      if (result.success) setUser(result.user);
      else alert("PIN Incorrecto");
    } catch (err) { alert("Servidor despertando... espera 30s."); }
  };

  useEffect(() => {
    if (user && view === 'gerencia') {
      fetch(`${API_URL}/api/gerencia-data?empresa_id=${user.empresa_id}`)
        .then(r => r.json())
        .then(data => { setHistory(data.history || []); setStock(data.stock || []); });
    }
  }, [view, user]);

  const saveToDB = async () => {
    setStatus('Guardando...');
    try {
      await fetch(`${API_URL}/api/save-intervention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...iaData, empresa_id: user.empresa_id, usuario_id: user.id }),
      });
      setStatus('✅ Registrado');
      setIaData(null);
      setTimeout(() => setStatus(''), 2000);
    } catch (err) { setStatus('❌ Error'); }
  };

  if (!user) {
    return (
      <div className="container login-screen">
        <header className="header"><h1>MantIA</h1><p>Sistema de Mantenimiento</p></header>
        <form onSubmit={handleLogin} className="main-content">
          <input type="password" value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="pin-input" maxLength="4" placeholder="PIN" autoFocus />
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
      <header className="header"><h1>MantIA</h1><p>Operario: {user.nombre}</p></header>
      {view === 'operario' ? (
        <main className="main-content">
          <button className={`record-button ${isRecording ? 'recording' : ''}`} onClick={!isRecording ? startListening : null}>
            {isRecording ? '👂' : '🎤'}<span style={{fontSize: '0.7rem'}}>{isRecording ? 'OYENDO...' : 'GRABAR'}</span>
          </button>
          {status && <p className="status-msg">{status}</p>}
          {iaData && (
            <div className="ia-card">
              <h3>Detección Automática</h3>
              <p><strong>MÁQUINA:</strong> {iaData.maquina_nombre}</p>
              <p><strong>PIEZAS:</strong> {iaData.repuestos_usados?.join(', ') || 'Ninguna'}</p>
              <button className="confirm-button" onClick={saveToDB}>Confirmar Registro</button>
            </div>
          )}
        </main>
      ) : (
        <div className="dashboard-view">
          <h3>📋 Historial de Planta</h3>
          <table className="history-table">
            <thead><tr><th>Fecha</th><th>Máquina</th><th>Repuestos</th></tr></thead>
            <tbody>{history.map(h => (<tr key={h.id}><td>{new Date(h.fecha).toLocaleDateString()}</td><td>{h.maquina}</td><td>{h.repuestos?.join(', ')}</td></tr>))}</tbody>
          </table>
          <h3 style={{marginTop: '30px'}}>📦 Inventario Actual</h3>
          <table className="history-table">
            <thead><tr><th>Repuesto</th><th>Stock</th></tr></thead>
            <tbody>{stock.map(s => (<tr key={s.id}><td>{s.nombre}</td><td>{s.stock_actual}</td></tr>))}</tbody>
          </table>
          <button className="confirm-button" style={{marginTop:'30px', background:'#334155'}} onClick={()=>setUser(null)}>Cerrar Sesión</button>
        </div>
      )}
    </div>
  );
}

export default App;