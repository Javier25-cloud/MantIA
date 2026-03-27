require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// --- 1. CONFIGURACIÓN DE SEGURIDAD (CORS) ---
app.use(cors({
  // SUSTITUYE esto por tu URL real de Vercel (sin la / al final)
  origin: 'https://mant-ia.vercel.app' 
}));

app.use(express.json());

// --- 2. CONEXIÓN CON TU BASE DE DATOS (SUPABASE) ---
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_KEY
);

// --- 3. RUTAS (LAS PUERTAS DE TU SERVIDOR) ---

// Puerta de prueba
app.get('/', (req, res) => {
  res.send('Servidor de MantIA operativo y en la nube 🚀');
});

// Puerta de Login (La que fallaba en tu captura)
app.post('/api/login', (req, res) => {
  const { pinInput } = req.body; 
  
  // Realidad: Aquí defines el PIN de acceso a tu app
  if (pinInput === "1234") { 
    res.json({ 
      success: true, 
      user: { name: "Operario Javier", empresa_id: 1 } 
    });
  } else {
    res.status(401).json({ success: false, message: "PIN Incorrecto" });
  }
});

// Puerta de Gerencia (La que también salía en tu App.jsx)
app.get('/api/gerencia-data', (req, res) => {
  // Por ahora mandamos datos vacíos para que la web no se rompa al cargar
  res.json({ 
    history: [], 
    stock: [
      { id: 1, nombre: "Rodamiento SKF", cantidad: 5 },
      { id: 2, nombre: "Sensor Inductivo", cantidad: 12 }
    ] 
  });
});

// --- 4. ARRANQUE ---
// Render usa puertos dinámicos, por eso usamos process.env.PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`MantIA Backend activo en puerto ${PORT}`);
});