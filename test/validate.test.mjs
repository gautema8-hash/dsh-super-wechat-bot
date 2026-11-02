// dsh-super-wechat-bot / test/validate.test.mjs — 配置校验与默认正则
import { validatePatch } from '../bridge/validate.mjs';
import { DEFAULTS } from '../bridge/policy.mjs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.error('  FAIL ' + name + (extra ? ' — ' + extra : '')); } };

// 默认配置里的正则必须能通过校验（就是这次线上报错的现场）
const def = validatePatch({ ackOnly: DEFAULTS.ackOnly });
ok('内置 ackOnly 能通过校验', def.ok, JSON.stringify(def.errors));
ok('内置 ackOnly 被原样接受', def.patch.ackOnly === DEFAULTS.ackOnly);

// 真坏的正则必须拦下
const broken = validatePatch({ ackOnly: '[' });
ok('坏 ackOnly 被拦下', broken.ok === false && broken.errors.length > 0);
const brokenUrgent = validatePatch({ urgentRe: '([a-' });
ok('坏 urgentRe 被拦下', brokenUrgent.ok === false);

// patch 只包含传进来的键，不会把默认值带进去
ok('patch 只含传入键', Object.keys(def.patch).length === 1 && def.patch.ackOnly !== undefined);

ok('processName 合法', validatePatch({ processName: 'Weixin' }).ok);
ok('processName 非法被拒', validatePatch({ processName: 'Wei xin!' }).ok === false);
ok('baseUrl 非法被拒', validatePatch({ baseUrl: 'notaurl' }).ok === false);
ok('skipAckProbability 越界被拒', validatePatch({ skipAckProbability: 2 }).ok === false);

console.log('\n配置校验：' + pass + ' 项通过' + (fail ? '，' + fail + ' 项失败' : ''));
if (fail) process.exitCode = 1;
