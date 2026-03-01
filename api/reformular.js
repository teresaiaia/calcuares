export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { texto, cliente, modelo, serial, caso } = req.body;

    const prompt = `Sos un redactor técnico de informes de servicio para equipos médicos de la empresa ARES MEDICAL EQUIPMENT.

Te voy a pasar un texto crudo de un informe de servicio técnico. Necesito que lo transformes en un informe profesional y estructurado.

DATOS DEL SERVICIO:
- Cliente: ${cliente || 'N/A'}
- Equipo: ${modelo || 'N/A'}
- Serial: ${serial || 'N/A'}
- Caso: ${caso || 'N/A'}

TEXTO ORIGINAL DEL TÉCNICO:
${texto}

INSTRUCCIONES:
Respondé SOLO con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "descripcion": "Texto profesional, técnico, formal y breve describiendo el servicio realizado. Redacción clara para un profesional médico dueño del equipo.",
  "repuestos": ["item1", "item2"],
  "recomendaciones": ["recomendación1", "recomendación2"],
  "observaciones": ""
}

REGLAS:
- "descripcion": Reformulá el texto con lenguaje técnico simple, formal y comprensible. Que sea breve y preciso.
- "repuestos": Lista de filtros, partes, piezas, componentes que se cambiaron, reemplazaron o agregaron. Si no hay, dejá el array vacío [].
- "recomendaciones": Sugerencias de mantenimiento futuro, cambios preventivos, acciones correctivas que el técnico haya mencionado. Si no hay, dejá el array vacío [].
- "observaciones": Cualquier nota adicional relevante. Si no hay, dejá string vacío "".
- NO agregues información que no esté en el texto original.
- Respondé SOLO el JSON, nada más.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    const textoRespuesta = data.content.map(c => c.text || '').join('');
    const jsonLimpio = textoRespuesta.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const resultado = JSON.parse(jsonLimpio);

    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
