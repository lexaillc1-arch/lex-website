export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const { messages, system } = req.body;
 
  if (!messages || !system) {
    return res.status(400).json({ error: 'Missing messages or system prompt' });
  }
 
  // Check if the LAST message contains a document or image
  const lastMsg = messages[messages.length - 1];
  const hasDocument = Array.isArray(lastMsg?.content);
 
  // Strip document data from history messages to keep payload small
  // Only the last message keeps the full document content
  const cleanMessages = messages.map((m, i) => {
    if (i === messages.length - 1) return m; // keep last message as-is
    if (Array.isArray(m.content)) {
      // Replace document content in history with text placeholder
      return {
        role: m.role,
        content: m.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join(' ') || '[Document uploaded]'
      };
    }
    return m;
  });
 
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: hasDocument ? 4000 : 1000,
        system,
        messages: cleanMessages,
      }),
    });
 
    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(response.status).json({ error: err });
    }
 
    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Unable to generate a response.';
    return res.status(200).json({ reply });
 
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
