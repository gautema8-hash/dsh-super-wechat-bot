// super-wechat-bot / llm.mjs
// Minimal DeepSeek chat call used by the bridge (no framework, ~1 request per reply).

export async function chat({ apiKey, baseUrl, model, messages, temperature = 0.85, maxTokens = 120, timeoutMs = 9000 }) {
  if (!apiKey) throw new Error('missing apiKey');
  const url = String(baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '') + '/chat/completions';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model: model || 'deepseek-flash', messages, temperature, max_tokens: maxTokens, stream: false }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error('LLM ' + res.status + ' ' + body.slice(0, 200));
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    return String(text);
  } finally {
    clearTimeout(timer);
  }
}

export function buildMessages({ persona, contact, history, pending }) {
  const recent = history.slice(-8).map((m) => (m.dir === 'in' ? contact + '：' : '我：') + m.text).join('\n');
  const ask = pending.length > 1
    ? '对方连着发了几条：\n' + pending.map((p) => '- ' + p.text).join('\n')
    : '对方刚发：「' + (pending[0]?.text ?? '') + '」';
  return [
    { role: 'system', content: persona },
    {
      role: 'user',
      content:
        '最近对话：\n' + (recent || '（无）') + '\n\n' + ask +
        '\n\n只输出要直接发出去的文字本身：不加引号，不加解释，不加前缀，不用 markdown，' +
        '一句话为主，最多两句，总长不超过 40 个字。若这句话不需要回，只输出 SKIP。',
    },
  ];
}
