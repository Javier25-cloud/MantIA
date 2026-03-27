require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors({
  origin: 'https://mant-ia.vercel.app' 
}));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- RUTAS ---

app.get('/', (req, res) => res.send('MantIA Backend: Operativo 🚀'));

// LOGIN (Sincronizado con tus UUIDs reales)
app.post('/api/login', (req, res) => {
  const { pinInput } = req.body;
  if (pinInput === "1234") {
    res.json({ 
      success: true, 
      user: { 
        id: "cc01eafc-6bdc-44e9-bcf6-793e19a44bd3", 
        nombre: "Javier Caballero", 
        empresa_id: "bbbacdf4-bbc2-494f-9a51-d732cf1cbcaa", 
        rol: "gerente" 
      } 
    });
  } else {
    res.status(401).json({ success: false, message: "PIN Incorrecto" });
  }
});

// PROCESAR VOZ (Simulación de IA)
app.post('/api/process-text', async (req, res) => {
  const { text } = req.body;
  const palabras = text.toLowerCase();
  let maquina = "Cinta Transportadora 2"; // Usamos la de tu captura
  let repuestos = [];

  if (palabras.includes("rodamiento")) repuestos.push("Rodamiento SKF");
  if (palabras.includes("sensor")) repuestos.push("Sensor Inductivo");

  res.json({ 
    success: true, 
    data: { maquina_nombre: maquina, repuestos_usados: repuestos } 
  });
});

// GUARDAR INTERVENCIÓN
app.post('/api/save-intervention', async (req, res) => {
  const { maquina_nombre, repuestos_usados, empresa_id, usuario_id } = req.body;
  try {
    const { error } = await supabase
      .from('intervenciones')
      .insert([{ 
        maquina: maquina_nombre, 
        repuestos: repuestos_usados, 
        empresa_id, 
        usuario_id, 
        fecha: new Date().toISOString() 
      }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DATOS GERENCIA
app.get('/api/gerencia-data', async (req, res) => {
  const { empresa_id } = req.query;
  try {
    const { data: history } = await supabase.from('intervenciones').select('*').eq('empresa_id', empresa_id);
    const { data: stock } = await supabase.from('repuestos').select('*').eq('empresa_id', empresa_id);
    res.json({ history: history || [], stock: stock || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));