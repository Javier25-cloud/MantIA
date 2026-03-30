require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(cors({ origin: 'https://mant-ia.vercel.app' }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- RUTAS DE SISTEMA ---
app.get('/', (req, res) => res.send('MantIA Backend Pro v2: Operativo 🚀'));

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

// --- RUTA IA (GEMINI) ---
app.post('/api/process-text', async (req, res) => {
  const { text } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza: "${text}". Responde SOLO JSON: {"maquina_nombre": "...", "repuestos_usados": ["..."]}. Repuestos: Filtro de Aire Industrial, Aceite Lubricante Multigrado, Correa de Distribución V-Belt, Junta de Estanqueidad 50mm, Válvula Solenoide 24V, Rodamiento de Bolas de Alta Precisión.`;
    const result = await model.generateContent(prompt);
    const jsonText = result.response.text().replace(/```json|```/g, "").trim();
    res.json({ success: true, data: JSON.parse(jsonText) });
  } catch (error) { res.status(500).json({ error: "Error en IA" }); }
});

// --- GESTIÓN DE INTERVENCIONES ---
app.post('/api/save-intervention', async (req, res) => {
  const { maquina_nombre, repuestos_usados, empresa_id, usuario_id } = req.body;
  try {
    const { error } = await supabase.from('intervenciones').insert([{ maquina: maquina_nombre, repuestos: repuestos_usados, empresa_id, usuario_id, fecha: new Date().toISOString() }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/delete-intervention/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('intervenciones').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- GESTIÓN DE INVENTARIO ---
app.get('/api/gerencia-data', async (req, res) => {
  const { empresa_id } = req.query;
  try {
    const { data: history } = await supabase.from('intervenciones').select('*').eq('empresa_id', empresa_id).order('fecha', { ascending: false });
    const { data: stock } = await supabase.from('repuestos').select('*').eq('empresa_id', empresa_id).order('nombre', { ascending: true });
    res.json({ history: history || [], stock: stock || [] });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/update-stock/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('repuestos').update({ stock_actual: req.body.nuevoStock }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));