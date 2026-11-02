
import { chat, buildMessages } from '../bridge/llm.mjs';
import { sanitizeReply } from '../bridge/policy.mjs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cred = await fs.readFile(path.join(os.homedir(), '.dsh', '.credentials.yaml'), 'utf8');
const m = cred.match(/^\s*DEEPSEEK_API_KEY:\s*(\S+)\s*$/m);
const apiKey = m ? m[1].replace(/^['"]|['"]$/g, '') : '';
console.log('apiKey present:', !!apiKey, 'prefix:', apiKey.slice(0, 3) + '***');

const persona = '你在替「主人」用他本人的口吻回微信。一次只回 1-2 句，总长不超过 40 字；标点要懒；只输出要发送的文字本身。';
const history = [
  { dir: 'in', text: '你发的这是啥啊' },
  { dir: 'out', text: '在测个软件 发错了' },
  { dir: 'in', text: '哦哦好吧' },
];
const pending = [{ text: '今晚出来吃饭吗' }];
const t0 = Date.now();
const raw = await chat({ apiKey, baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', messages: buildMessages({ persona, contact: 'aaa', history, pending }) });
const ms = Date.now() - t0;
console.log('raw:', JSON.stringify(raw));
console.log('latency:', ms, 'ms');
console.log('sanitized:', JSON.stringify(sanitizeReply(raw, 40)));
