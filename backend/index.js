require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
// Ajusta el origin según tu URL de Vercel
app.use(cors({ origin: '*' })); 
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// LOGIN
app.post('/api/login', (req, res) => {
  const { pinInput } = req.body;
  if (pinInput === "1234") {
    res.json({ 
      success: true, 
      user: { id: "user_01", nombre: "Javier Caballero", empresa_id: "bbbacdf4-bbc2-494f-9a51-d732cf1cbcaa", rol: "gerente" } 
    });
  } else { res.status(401).json({ success: false }); }
});

// DATOS GERENCIA
app.get('/api/gerencia-data', async (req, res) => {
  const { empresa_id } = req.query;
  try {
    const [history, stock, machines] = await Promise.all([
      supabase.from('intervenciones').select('*').eq('empresa_id', empresa_id).order('fecha', { ascending: false }),
      supabase.from('repuestos').select('*').eq('empresa_id', empresa_id).order('nombre', { ascending: true }),
      supabase.from('maquinas').select('*').eq('empresa_id', empresa_id).order('nombre', { ascending: true })
    ]);

    const counts = {};
    history.data?.forEach(i => counts[i.maquina] = (counts[i.maquina] || 0) + 1);
    const chartData = Object.keys(counts).map(name => ({ name, valor: counts[name] }))
      .sort((a,b) => b.valor - a.valor).slice(0, 5);

    res.json({ history: history.data, stock: stock.data, maquinas: machines.data, chartData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// PROCESO IA
app.post('/api/process-text', async (req, res) => {
  const { text } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza este reporte técnico: "${text}". Responde únicamente en formato JSON: {"maquina_nombre": "NOMBRE_MAQUINA", "repuestos_usados": ["PIEZA1", "PIEZA2"]}. Si no detectas piezas, deja el array vacío.`;
    const result = await model.generateContent(prompt);
    const jsonText = result.response.text().replace(/```json|```/g, "").trim();
    res.json({ success: true, data: JSON.parse(jsonText) });
  } catch (error) { res.status(500).json({ error: "Error procesando IA" }); }
});

// GUARDAR INTERVENCIÓN
app.post('/api/save-intervention', async (req, res) => {
  const { maquina_nombre, repuestos_usados, empresa_id, usuario_id } = req.body;
  await supabase.from('intervenciones').insert([{ 
    maquina: maquina_nombre, 
    repuestos: repuestos_usados, 
    empresa_id, 
    usuario_id, 
    fecha: new Date().toISOString() 
  }]);
  res.json({ success: true });
});

// ACTUALIZAR STOCK
app.put('/api/update-stock/:id', async (req, res) => {
  await supabase.from('repuestos').update({ stock_actual: req.body.nuevoStock }).eq('id', req.params.id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor MantIA en puerto ${PORT}`));