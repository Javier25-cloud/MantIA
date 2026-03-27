require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// --- CONFIGURACIÓN DE CORS ---
// RECUERDA: Cambia la URL por la que te dio Vercel (la de la pantalla del confeti)
app.use(cors({
  origin: 'https://mant-ia.vercel.app' 
}));

app.use(express.json());

// --- CONEXIÓN CON SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- RUTAS ---

// Ruta de prueba para ver si el servidor responde
app.get('/', (req, res) => {
  res.send('Servidor de MantIA funcionando correctamente 🚀');
});

// La ruta que usas en el frontend para procesar texto
app.post('/api/process-text', async (req, res) => {
  const { text, empresa_id } = req.body;

  try {
    // Aquí iría tu lógica de IA o de guardado en base de datos
    // Por ahora, registramos la entrada en los logs de Render
    console.log(`Procesando texto para empresa ${empresa_id}: ${text}`);

    // Ejemplo: Guardar el log en Supabase (ajusta el nombre de tu tabla)
    /*
    const { data, error } = await supabase
      .from('logs_mantenimiento')
      .insert([{ detalle: text, empresa_id: empresa_id }]);
    */

    res.json({ 
      success: true, 
      message: "Texto recibido y procesado",
      analizado: text 
    });

  } catch (error) {
    console.error("Error en el servidor:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// --- ARRANCAR SERVIDOR ---
// Render asigna el puerto automáticamente mediante process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MantIA Backend activo en puerto ${PORT}`);
});