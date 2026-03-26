const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3000;

const supabase = createClient('https://hikaaalttvuohosmyzdu.supabase.co', 'sb_publishable_p5NVMqbhBDa3T4Q5bb3cuw_9DS3VmsK');

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// 1. LOGIN
app.post('/api/login', async (req, res) => {
  const { pin } = req.body;
  const { data: perfil } = await supabase.from('perfiles').select('*').eq('pin', pin).single();
  if (!perfil) return res.status(401).json({ success: false });
  res.json({ success: true, user: perfil });
});

// 2. PROCESADOR DE TEXTO (INTELIGENCIA "MANUAL" GRATIS)
app.post('/api/process-text', async (req, res) => {
  const { text, empresa_id } = req.body;
  const frase = text.toLowerCase();

  // Buscamos máquinas y repuestos reales en tu DB para comparar
  const [maqDB, repDB] = await Promise.all([
    supabase.from('maquinas').select('nombre').eq('empresa_id', empresa_id),
    supabase.from('repuestos').select('nombre').eq('empresa_id', empresa_id)
  ]);

  // Lógica de detección por coincidencia de palabras
  const maquinaEncontrada = maqDB.data.find(m => frase.includes(m.nombre.toLowerCase()));
  const repuestosEncontrados = repDB.data
    .filter(r => frase.includes(r.nombre.toLowerCase()))
    .map(r => r.nombre);

  res.json({
    success: true,
    data: {
      maquina_nombre: maquinaEncontrada ? maquinaEncontrada.nombre : "Desconocida",
      accion: "Mantenimiento preventivo/correctivo",
      repuestos_usados: repuestosEncontrados
    }
  });
});

// 3. GUARDAR Y CONSULTAR (Igual que antes)
app.post('/api/save-intervention', async (req, res) => {
  const { empresa_id, usuario_id, maquina_nombre, accion, repuestos_usados } = req.body;
  const { data: maq } = await supabase.from('maquinas').select('id').eq('nombre', maquina_nombre).eq('empresa_id', empresa_id).single();
  
  await supabase.from('intervenciones').insert([{ empresa_id, usuario_id, maquina_id: maq?.id, accion, repuestos_usados }]);
  
  if (repuestos_usados) {
    for (const r of repuestos_usados) {
      const { data: it } = await supabase.from('repuestos').select('stock_actual').eq('nombre', r).eq('empresa_id', empresa_id).single();
      if (it) await supabase.from('repuestos').update({ stock_actual: it.stock_actual - 1 }).eq('nombre', r).eq('empresa_id', empresa_id);
    }
  }
  res.json({ success: true });
});

app.get('/api/gerencia-data', async (req, res) => {
  const { empresa_id } = req.query;
  const [h, s] = await Promise.all([
    supabase.from('intervenciones').select('*').eq('empresa_id', empresa_id).order('fecha', { ascending: false }),
    supabase.from('repuestos').select('*').eq('empresa_id', empresa_id)
  ]);
  res.json({ history: h.data || [], stock: s.data || [] });
});

app.listen(port, () => console.log(`MantIA Low-Cost activa en puerto ${port}`));