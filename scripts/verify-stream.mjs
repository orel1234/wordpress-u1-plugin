// The streamed transport in ai-advisor.js, against a real stream.
//
//   node scripts/verify-stream.mjs
//
// A 94-element screenful with a picture, at high effort, ran past the 150s
// total-elapsed deadline: 150 seconds of waiting, a screen marked "not read",
// and in all likelihood a bill from Anthropic for work that was done and then
// dropped on the floor.
//
// Waiting longer is not the fix. To a total-elapsed timeout, a request with no
// bytes on the wire and a request busy producing a long answer are the same
// observation, so it must guess — and any guess is wrong for one of them.
//
// Streaming makes them two different observations. That is the only reason it
// is here, and it is what these tests are about: a long healthy answer must
// never be dropped however long it runs, and a silent one must be dropped
// quickly. Everything downstream still expects the single-object shape, so the
// reassembly has to be exact — a usage field taken from the wrong event prices
// every call as though it answered with nothing.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'ai-advisor.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

// Lift readStream out of the IIFE. Brace-matched from its own body, so this
// runs the code that ships rather than a copy that would drift from it.
function lift(name) {
  const a = SRC.indexOf(`async function ${name}(`);
  if (a < 0) throw new Error(`could not find ${name}`);
  let i = SRC.indexOf('{', SRC.indexOf(')', a));
  let depth = 0;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return SRC.slice(a, j + 1);
  }
  throw new Error(`unbalanced ${name}`);
}
const readStream = new Function(`${lift('readStream')}; return readStream;`)();

/** A Response-alike whose body yields the frames given, in the chunks given. */
function streamOf(chunks) {
  let i = 0;
  const enc = new TextEncoder();
  return {
    body: {
      getReader: () => ({
        read: async () => i < chunks.length
          ? { done: false, value: enc.encode(chunks[i++]) }
          : { done: true, value: undefined },
      }),
    },
  };
}
const frame = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;

// A whole ordinary answer, as the API sends one.
const ANSWER = [
  frame({ type: 'message_start', message: { model: 'claude-sonnet-5', usage: { input_tokens: 4210, output_tokens: 0 } } }),
  frame({ type: 'content_block_start', index: 0, content_block: { type: 'thinking' } }),
  frame({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'weighing it up' } }),
  frame({ type: 'content_block_start', index: 1, content_block: { type: 'text' } }),
  frame({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '{"components":' } }),
  frame({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '[{"u1Type":"tabs"}]}' } }),
  frame({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 812 } }),
  frame({ type: 'message_stop' }),
];

console.log('\nan ordinary answer, reassembled');
{
  const out = await readStream(streamOf(ANSWER), () => {});
  const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  check('the answer comes back whole', text === '{"components":[{"u1Type":"tabs"}]}', text);
  check('…and parses', (() => { try { JSON.parse(text); return true; } catch { return false; } })());
  check('the thinking block is kept apart from the answer',
    out.content.some(b => b.type === 'thinking') && !/weighing it up/.test(text));
  check('the model is carried through', out.model === 'claude-sonnet-5', String(out.model));
  check('stop_reason survives, since the refusal check reads it',
    out.stop_reason === 'end_turn', String(out.stop_reason));
  // The output count exists ONLY on message_delta — message_start carries the
  // input side and a zero for output. Take the first and every call is priced
  // as though it answered with nothing.
  check('the input tokens come from the start of the message',
    out.usage.input_tokens === 4210, JSON.stringify(out.usage));
  check('…and the output tokens from the end, not the zero at the start',
    out.usage.output_tokens === 812, JSON.stringify(out.usage));
}

console.log('\nframes split across reads');
{
  // A frame is not delivered whole. Splitting mid-JSON is the ordinary case on
  // a real socket and the one a naive line-splitter gets wrong.
  const whole = ANSWER.join('');
  const chunks = [];
  for (let i = 0; i < whole.length; i += 7) chunks.push(whole.slice(i, i + 7));
  const out = await readStream(streamOf(chunks), () => {});
  const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  check('an answer cut into 7-byte pieces still arrives whole',
    text === '{"components":[{"u1Type":"tabs"}]}', text);
  check('…with its usage intact',
    out.usage.input_tokens === 4210 && out.usage.output_tokens === 812, JSON.stringify(out.usage));
}

console.log('\nthe idle clock, which is the whole point');
{
  let beats = 0;
  await readStream(streamOf(ANSWER), () => { beats++; });
  check('every chunk rearms the clock', beats === ANSWER.length, String(beats));
  // A model thinking hard between tokens sends pings for exactly this reason.
  // If they did not count, a long deliberation would look like silence — which
  // is the failure this whole change exists to stop.
  const pinged = [ANSWER[0], frame({ type: 'ping' }), frame({ type: 'ping' }), ...ANSWER.slice(1)];
  beats = 0;
  const out = await readStream(streamOf(pinged), () => { beats++; });
  check('a ping counts as alive', beats === pinged.length, String(beats));
  check('…and does not corrupt the answer',
    (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('') ===
    '{"components":[{"u1Type":"tabs"}]}');
  check('an unknown event type is ignored rather than fatal',
    (await readStream(streamOf([ANSWER[0], frame({ type: 'something_new', x: 1 }), ...ANSWER.slice(1)]), () => {}))
      .content.some(b => b.type === 'text'));
}

console.log('\nwhat can go wrong mid-answer');
{
  const errored = [ANSWER[0], ANSWER[1],
    frame({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } })];
  const out = await readStream(streamOf(errored), () => {});
  check('an error event becomes an error, not a half answer',
    out.err && /Overloaded/.test(out.err), JSON.stringify(out).slice(0, 90));
  // A truncated answer must not be handed on as though it were complete: it
  // parses as invalid JSON downstream and the screen fails, which is right.
  const cut = ANSWER.slice(0, 5);
  const half = await readStream(streamOf(cut), () => {});
  const text = (half.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  check('a stream that stops early yields only what arrived',
    text === '{"components":', text);
  check('…and no stop_reason, so nothing downstream reads it as finished',
    !half.stop_reason, String(half.stop_reason));
  // Structured output arrives on partial_json rather than text on some paths.
  const structured = [ANSWER[0],
    frame({ type: 'content_block_start', index: 0, content_block: { type: 'text' } }),
    frame({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"a":1}' } }),
    frame({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } })];
  const s = await readStream(streamOf(structured), () => {});
  check('structured output on partial_json is collected too',
    s.content.map(b => b.text).join('') === '{"a":1}', JSON.stringify(s.content));
  // A browser with no streaming body must say so rather than throwing on
  // `.getReader` of undefined.
  const none = await readStream({ body: null }, () => {});
  check('a body that cannot be streamed is an error, not a crash',
    none.err && /cannot read a streamed response/.test(none.err), JSON.stringify(none));
}

console.log('\nthe deadline is silence, not duration');
{
  check('the request asks for a stream', /stream: true/.test(SRC));
  check('there is an idle limit, and it is a minute',
    /const CALL_IDLE_MS = 60000/.test(SRC));
  check('…rearmed by every chunk that arrives',
    /data = await readStream\(res, armIdle\)/.test(SRC) &&
    /clearTimeout\(idle\);\s*\n\s*idle = setTimeout/.test(SRC));
  // The old behaviour, which must not come back: a healthy call that takes
  // three minutes was killed at 150 seconds.
  check('a long healthy answer is no longer killed on elapsed time alone',
    !/CALL_TIMEOUT_MS = 150000/.test(SRC) && /const CALL_TIMEOUT_MS = 600000/.test(SRC));
  // The two aborts say different things because they mean different things,
  // and "nothing was charged" is not a claim this code can make about work
  // Anthropic may already have done.
  check('silence and the ten-minute ceiling report differently',
    /sent nothing for/.test(SRC) && /ran past ten minutes/.test(SRC));
  // Three ways out, and a timer left armed on any of them aborts a controller
  // that a later call is no longer watching.
  check('the clocks stop when the request itself fails',
    /\} catch \(e\) \{\s*\n\s*stopClocks\(\);/.test(SRC));
  check('…when the server answers with an error status',
    /if \(!res\.ok\) \{\s*\n\s*stopClocks\(\);/.test(SRC));
  check('…and when the stream ends, however it ends',
    /\} finally \{\s*\n\s*stopClocks\(\);\s*\n\s*\}/.test(SRC));
  check('and those are all the ways out there are',
    (SRC.match(/stopClocks\(\)/g) || []).length === 3,
    String((SRC.match(/stopClocks\(\)/g) || []).length));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
