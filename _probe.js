// Probe 2: bắt request lỗi (URL), giả lập gõ phím thật, và kiểm tra kết nối Supabase.
const { spawn } = require("child_process");
const os = require("os"), path = require("path"), fs = require("fs");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] || "https://ngoxnghiem2022.github.io/kho-mobile/";
const PORT = 9223;
const profile = path.join(os.tmpdir(), "crtest2-" + Date.now());
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "--window-size=390,844",
  "--user-agent=Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getWs() { for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const l = await r.json(); const p = l.find(t => t.type === "page"); if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch {} await sleep(250); } throw new Error("no ws"); }
(async () => {
  const ws = await getWs(); const sock = new WebSocket(ws);
  let id = 0; const pend = new Map(); const logs = []; const fails = [];
  const send = (m, p = {}) => new Promise(res => { const mid = ++id; pend.set(mid, res); sock.send(JSON.stringify({ id: mid, method: m, params: p })); });
  sock.addEventListener("message", ev => { const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") logs.push("[EXC] " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === "Runtime.consoleAPICalled") logs.push("[c." + m.params.type + "] " + m.params.args.map(a => a.value ?? a.description ?? "").join(" "));
    if (m.method === "Network.loadingFailed") fails.push("FAILED " + m.params.requestId + " " + (m.params.errorText || ""));
    if (m.method === "Network.responseReceived") { const r = m.params.response; if (r.status >= 400) fails.push(r.status + " " + r.url); }
  });
  await new Promise(r => sock.addEventListener("open", r));
  await Promise.all([send("Runtime.enable"), send("Log.enable"), send("Page.enable"), send("Network.enable")]);
  await send("Page.navigate", { url: URL }); await sleep(6000);
  const ev = async e => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  // focus rồi gõ như người thật bằng Input.insertText
  await ev("document.getElementById('u').focus(); document.activeElement.id");
  await send("Input.insertText", { text: "admin" });
  await ev("document.getElementById('p').focus(); document.activeElement.id");
  await send("Input.insertText", { text: "123456" });
  const after = await ev("({u:document.getElementById('u').value, p:document.getElementById('p').value})");
  console.log("TYPED=" + JSON.stringify(after));
  console.log("FAILS:\n" + (fails.join("\n") || "(none)"));
  console.log("LOGS:\n" + (logs.join("\n") || "(none)"));
  // test endpoint supabase
  try {
    const r = await fetch("https://ckgkgpczbpgcmzacclmp.supabase.co/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: "sb_publishable_mqghFqieCsMyu3F1L0WGcw_twYWYca2", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "khongco@kho.local", password: "sai" }),
    });
    console.log("SUPABASE_AUTH status=" + r.status + " body=" + (await r.text()).slice(0, 200));
  } catch (e) { console.log("SUPABASE_AUTH ERR " + e.message); }
  sock.close(); chrome.kill(); await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
})().catch(e => { console.log("ERR " + e.message); try { chrome.kill(); } catch {} process.exitCode = 1; });
