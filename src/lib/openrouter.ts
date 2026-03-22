const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-3-haiku'

async function callOpenRouter(messages: { role: string; content: string }[], apiKey: string): Promise<string> {
  const response = await fetch(OPENROUTER_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
      'X-Title': 'SmartPDF Reader',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function askQuestion(pdfText: string, question: string, apiKey: string): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that answers questions about PDF documents. Be concise and accurate. If the answer is not found in the provided text, say so clearly.',
    },
    {
      role: 'user',
      content: `Here is the PDF content:\n\n${pdfText.substring(0, 8000)}\n\nQuestion: ${question}`,
    },
  ]

  return callOpenRouter(messages, apiKey)
}

export async function summarizeText(text: string, apiKey: string): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that summarizes text. Provide a clear, concise summary highlighting the main points.',
    },
    {
      role: 'user',
      content: `Please summarize the following text:\n\n${text.substring(0, 8000)}`,
    },
  ]

  return callOpenRouter(messages, apiKey)
}
