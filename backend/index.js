require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. LOGIN DINÁMICO (Con roles y seguridad)
app.post('/api/login', async (req, res) => {
  const { pinInput } = req.body;
  
  try {
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id, nombre, empresa_id, rol')
      .eq('pin_acceso', pinInput)
      .eq('activo', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: "PIN incorrecto o inactivo" });
    }

    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. PANEL SUPERADMIN (Solo Javier)
app.get('/api/admin/stats', async (req, res) => {
  const { user_role } = req.query;
  if (user_role !== 'superadmin') return res.status(403).send("Acceso denegado");
  try {
    const { data: stats } = await supabase.from('usuarios').select('nombre, peticiones_ia_mes, empresas(nombre)').order('peticiones_ia_mes', { ascending: false });
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. MOTOR DE AUTOGENERACIÓN Y DATOS GERENCIA
app.get('/api/gerencia-data', async (req, res) => {
  const { empresa_id } = req.query;
  try {
    const [history, stock, machines, currentTasks, allPlans] = await Promise.all([
      supabase.from('intervenciones').select('*').eq('empresa_id', empresa_id).order('fecha', { ascending: false }),
      supabase.from('repuestos').select('*').eq('empresa_id', empresa_id),
      supabase.from('maquinas').select('*').eq('empresa_id', empresa_id),
      supabase.from('tareas').select('*').eq('empresa_id', empresa_id).eq('estado', 'pendiente'),
      supabase.from('planes_mantenimiento').select('*').eq('empresa_id', empresa_id)
    ]);

    const hoy = new Date();
    // Bucle inteligente que revisa todos los planes y autogenera tareas
    for (let plan of (allPlans.data || [])) {
      const ultima = new Date(plan.ultima_fecha);
      const diasPasados = Math.floor((hoy - ultima) / (1000 * 60 * 60 * 24));

      if (diasPasados >= plan.frecuencia_dias) {
        const maquina = machines.data.find(m => m.id === plan.maquina_id);
        const yaExiste = currentTasks.data?.find(t => t.titulo === plan.titulo && t.maquina_nombre === maquina?.nombre);
        
        if (!yaExiste && maquina) {
          await supabase.from('tareas').insert([{
            empresa_id, maquina_nombre: maquina.nombre, titulo: plan.titulo, fecha_limite: hoy.toISOString().split('T')[0]
          }]);
        }
      }
    }

    const finalTasks = await supabase.from('tareas').select('*').eq('empresa_id', empresa_id).order('fecha_limite', { ascending: true });
    
    // Gráfica de averías
    const counts = {};
    history.data?.forEach(i => counts[i.maquina] = (counts[i.maquina] || 0) + 1);
    const chartData = Object.keys(counts).map(name => ({ name, valor: counts[name] }));

    res.json({ history: history.data, stock: stock.data, maquinas: machines.data, tareas: finalTasks.data, planes: allPlans.data, chartData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. PLANES, EQUIPO Y TAREAS
app.post('/api/add-plan', async (req, res) => {
  const { error } = await supabase.from('planes_mantenimiento').insert([req.body]);
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.get('/api/users', async (req, res) => {
  const { empresa_id } = req.query;
  const { data, error } = await supabase.from('usuarios').select('id, nombre, email, rol, activo').eq('empresa_id', empresa_id);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/users', async (req, res) => {
  const { error } = await supabase.from('usuarios').insert([req.body]);
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.put('/api/complete-task/:id', async (req, res) => {
  const { maquina_nombre, titulo_tarea } = req.body;
  await supabase.from('tareas').update({ estado: 'completada' }).eq('id', req.params.id);
  
  if (maquina_nombre && titulo_tarea) {
    const maq = await supabase.from('maquinas').select('id').eq('nombre', maquina_nombre).single();
    if (maq.data) {
      await supabase.from('planes_mantenimiento').update({ ultima_fecha: new Date().toISOString().split('T')[0] })
        .eq('maquina_id', maq.data.id).eq('titulo', titulo_tarea);
    }
  }
  res.json({ success: true });
});

// 5. PROCESAMIENTO IA POR VOZ
app.post('/api/process-text', async (req, res) => {
  const { text } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza: "${text}". Responde SOLO JSON: {"maquina_nombre": "...", "repuestos_usados": ["..."]}. Si no hay repuestos, deja el array vacío.`;
    const result = await model.generateContent(prompt);
    const jsonText = result.response.text().replace(/```json|```/g, "").trim();
    res.json({ success: true, data: JSON.parse(jsonText) });
  } catch (e) { res.status(500).json({ error: "Error IA" }); }
});

// 6. GUARDAR REPORTE DE AVERÍA (Operario)
app.post('/api/save-intervention', async (req, res) => {
  const { maquina_nombre, repuestos_usados, empresa_id, usuario_id, fecha } = req.body;
  await supabase.from('intervenciones').insert([{ maquina: maquina_nombre, repuestos: repuestos_usados, empresa_id, usuario_id, fecha: fecha || new Date().toISOString() }]);
  res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor MantIA SaaS Online en puerto ${PORT}`));