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

// 1. LOGIN
app.post('/api/login', (req, res) => {
  const { pinInput } = req.body;
  if (pinInput === "1234") {
    res.json({ success: true, user: { id: "u01", nombre: "Javier Caballero", empresa_id: "bbbacdf4-bbc2-494f-9a51-d732cf1cbcaa", rol: "gerente" } });
  } else { res.status(401).json({ success: false }); }
});

// 2. DATOS GERENCIA + MOTOR AUTO-PLANIFICADOR (V10)
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

    // Lógica que autogenera tareas leyendo todos los planes
    const hoy = new Date();
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
    
    // Datos para la gráfica
    const counts = {};
    history.data?.forEach(i => counts[i.maquina] = (counts[i.maquina] || 0) + 1);
    const chartData = Object.keys(counts).map(name => ({ name, valor: counts[name] }));

    res.json({ history: history.data, stock: stock.data, maquinas: machines.data, tareas: finalTasks.data, planes: allPlans.data, chartData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 3. AÑADIR NUEVO PLAN A MÁQUINA (Con escudo de errores)
app.post('/api/add-plan', async (req, res) => {
  const { error } = await supabase.from('planes_mantenimiento').insert([req.body]);
  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  res.json({ success: true });
});

// 4. COMPLETAR TAREA PREVENTIVA Y RESETEAR EL CICLO
app.put('/api/complete-task/:id', async (req, res) => {
  const { maquina_nombre } = req.body;
  await supabase.from('tareas').update({ estado: 'completada' }).eq('id', req.params.id);
  // Actualizamos la máquina para que vuelva a contar desde hoy
  if (maquina_nombre) {
    await supabase.from('maquinas').update({ ultima_fecha_mantenimiento: new Date().toISOString().split('T')[0] }).eq('nombre', maquina_nombre);
  }
  res.json({ success: true });
});

// 5. PROCESO IA POR VOZ (Mantenido)
app.post('/api/process-text', async (req, res) => {
  const { text } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza: "${text}". Responde SOLO JSON: {"maquina_nombre": "...", "repuestos_usados": ["..."]}. Si no detectas piezas, deja el array vacío.`;
    const result = await model.generateContent(prompt);
    const jsonText = result.response.text().replace(/```json|```/g, "").trim();
    res.json({ success: true, data: JSON.parse(jsonText) });
  } catch (e) { res.status(500).json({ error: "Error procesando IA" }); }
});

// 6. GUARDAR INTERVENCIÓN DE AVERÍA (Mantenido)
app.post('/api/save-intervention', async (req, res) => {
  const { maquina_nombre, repuestos_usados, empresa_id, usuario_id } = req.body;
  await supabase.from('intervenciones').insert([{ maquina: maquina_nombre, repuestos: repuestos_usados, empresa_id, usuario_id, fecha: new Date().toISOString() }]);
  res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor MantIA V10 Online en puerto ${PORT}`));