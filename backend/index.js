require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// --- 1. CONFIGURACIÓN ---
app.use(cors({
  origin: 'https://mant-ia.vercel.app' 
}));
app.use(express.json());

// Clientes de Base de Datos e IA
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- 2. RUTAS ---

// Estado del servidor
app.get('/', (req, res) => res.send('MantIA Backend con Gemini: Operativo 🚀'));

// LOGIN (Sincronizado con tus UUIDs reales de Supabase)
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

// PROCESAR TEXTO CON GEMINI (IA Real)
app.post('/api/process-text', async (req, res) => {
  const { text } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Actúa como un experto en mantenimiento industrial. 
    Analiza este texto extraído de un audio: "${text}"
    Extrae la información técnica y responde ÚNICAMENTE en formato JSON con esta estructura exacta:
    {
      "maquina_nombre": "Nombre de la máquina detectada",
      "repuestos_usados": ["Repuesto 1", "Repuesto 2"]
    }
    
    Contexto de repuestos disponibles en inventario:
    - Filtro de Aire Industrial
    - Aceite Lubricante Multigrado
    - Correa de Distribución V-Belt
    - Junta de Estanqueidad 50mm
    - Válvula Solenoide 24V
    - Rodamiento de Bolas de Alta Precisión
    
    Si no detectas una máquina, pon "General". Si no detectas repuestos, devuelve [].
    Responde solo el objeto JSON, sin comentarios ni formato markdown.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonText = response.text().trim();
    
    // Limpieza de posibles etiquetas markdown que Gemini suele añadir
    jsonText = jsonText.replace(/```json|```/g, "");
    
    const aiData = JSON.parse(jsonText);
    res.json({ success: true, data: aiData });

  } catch (error) {
    console.error("Error con Gemini:", error);
    res.status(500).json({ error: "Error al procesar con IA" });
  }
});

// GUARDAR INTERVENCIÓN EN SUPABASE
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
    res.json({ success: true, message: "Guardado correctamente" });
  } catch (error) {
    console.error("Error al guardar:", error);
    res.status(500).json({ error: error.message });
  }
});

// OBTENER DATOS DE GERENCIA
app.get('/api/gerencia-data', async (req, res) => {
  const { empresa_id } = req.query;
  try {
    const { data: history } = await supabase
      .from('intervenciones')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('fecha', { ascending: false });

    const { data: stock } = await supabase
      .from('repuestos')
      .select('*')
      .eq('empresa_id', empresa_id);

    res.json({ history: history || [], stock: stock || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 3. ARRANQUE ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor MantIA activo en puerto ${PORT}`);
});