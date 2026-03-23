import { WebSocket } from 'undici';
import { connect as tlsConnect } from 'tls';
import { readFileSync, watch } from 'fs';

process.env.UV_THREADPOOL_SIZE = '128';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.title = 'salvia baban hep arkanda aslan oglum';

try {
    if (process.platform === 'win32') {
        const { spawn } = await import('child_process');
        spawn('wmic', ['process', 'where', 'processid=' + process.pid, 'CALL', 'setpriority', '256'], { stdio: 'ignore' });
        spawn('powershell', ['-Command', '$p=Get-Process -Id ' + process.pid + ';$p.ProcessorAffinity=0xFFFF'], { stdio: 'ignore' });
    } else {
        const os = await import('os');
        os.default.setPriority(0, -20);
    }
} catch {}

// === CONFIGURATION - MFA ENTEGRE ===
const CONFIG = {
  TOKEN: '', // Discord token
  GUILD_ID: '',     // Guild ID
  CHANNEL_ID: '
',   // Channel ID
  REQUEST_COUNT: 1,                     // Kaç request atmak istediğin
  MFA_PASSWORD: '',            // Account password (MFA fetch için)
  MFA_TOKEN: '',                        // MFA tokenı (auto yüklenecek)
  AUTO_FETCH_MFA: true,                 // MFA'yı otomatik al
  MFA_FETCH_INTERVAL: 120000,           // 2 dakikada bir MFA token al
};

const T = CONFIG.TOKEN;
const G = CONFIG.GUILD_ID;
const CH = CONFIG.CHANNEL_ID;
const N = CONFIG.REQUEST_COUNT;

const EDGE = [
    'discord.com',
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SP = 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEzMS4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTMxLjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiIiLCJyZWZlcnJpbmdfZG9tYWluIjoiIiwicmVmZXJyaW5nX2N1cnJlbnQiOiIiLCJyZWZlcnJpbmdfZG9tYWluX2N1cnJlbnQiOiIiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjozNTYxNDAsImNsaWVudF9ldmVudF9zb3VyY2UiOm51bGx9';
const PING = Buffer.from('HEAD / HTTP/1.1\r\nHost: discord.com\r\nConnection: keep-alive\r\n\r\n');

let M = CONFIG.MFA_TOKEN;
let SES = null;
const V = new Map();
const P = new Map();
const S = new Array(N);
let NS = null;
let gwGen = 0;
const gwConns = [];

// === AUTO MFA FETCH FUNCTION (Go kodu'nun JS eşdeğeri) ===
async function fetchMFAToken(token, password) {
    try {
        const resp1 = await fetch('https://canary.discord.com/api/v9/guilds/0/vanity-url', {
            method: 'PATCH',
            headers: {
                'Authorization': token,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9164 Chrome/124.0.6367.243 Electron/30.2.0 Safari/537.36',
                'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJwdGIiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC4xMTMwIiwib3NfdmVyc2lvbiI6IjEwLjAuMTkwNDUiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoidHIiLCJoYXNfY2xpZW50X21vZHMiOmZhbHNlLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBkaXNjb3JkLzEuMC4xMTMwIENocm9tZS8xMjguMC42NjEzLjE4NiBFbGVjdHJvbi8zMi4yLjcgU2FmYXJpLzUzNy4zNiIsImJyb3dzZXJfdmVyc2lvbiI6IjMyLjIuNyIsIm9zX3Nka192ZXJzaW9uIjoiMTkwNDUiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjozNjY5NTUsIm5hdGl2ZV9idWlsZF9udW1iZXIiOjU4NDYzLCJjbGllbnRfZXZlbnRfc291cmNlIjpudWxsfQ==',
                'X-Discord-Timezone': 'Europe/Istanbul',
                'X-Discord-Locale': 'en-US',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: '' })
        });

        if (!resp1.ok && resp1.status !== 401) return null;
        const data1 = await resp1.json();
        const ticket = data1.mfa?.ticket || data1.ticket;
        if (!ticket) return null;

        console.log(`✅ [MFA] Ticket alındı`);

        const resp2 = await fetch('https://canary.discord.com/api/v9/mfa/finish', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9164 Chrome/124.0.6367.243 Electron/30.2.0 Safari/537.36',
                'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJwdGIiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC4xMTMwIiwib3NfdmVyc2lvbiI6IjEwLjAuMTkwNDUiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoidHIiLCJoYXNfY2xpZW50X21vZHMiOmZhbHNlLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBkaXNjb3JkLzEuMC4xMTMwIENocm9tZS8xMjguMC42NjEzLjE4NiBFbGVjdHJvbi8zMi4yLjcgU2FmYXJpLzUzNy4zNiIsImJyb3dzZXJfdmVyc2lvbiI6IjMyLjIuNyIsIm9zX3Nka192ZXJzaW9uIjoiMTkwNDUiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjozNjY5NTUsIm5hdGl2ZV9idWlsZF9udW1iZXIiOjU4NDYzLCJjbGllbnRfZXZlbnRfc291cmNlIjpudWxsfQ==',
                'X-Discord-Timezone': 'Europe/Istanbul',
                'X-Discord-Locale': 'en-US',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ticket, mfa_type: 'password', data: password })
        });

        if (!resp2.ok) return null;
        const data2 = await resp2.json();
        if (!data2.token) return null;

        console.log(`✅ [MFA] Token başarıyla alındı`);
        return data2.token;
    } catch (err) {
        console.log(`❌ [MFA] Hata: ${err.message}`);
        return null;
    }
}

function updateMfaToken(newToken) {
    if (M !== newToken) {
        M = newToken;
        P.clear();
        V.forEach(code => build(code));
        console.log('✅ MFA token güncellendi');
    }
}

async function autoFetchMFA() {
    if (!CONFIG.AUTO_FETCH_MFA || !CONFIG.MFA_PASSWORD) return;
    const token = await fetchMFAToken(CONFIG.TOKEN, CONFIG.MFA_PASSWORD);
    if (token) {
        try {
            const { writeFileSync } = await import('fs');
            writeFileSync('mfa.txt', token);
            console.log('💾 MFA Token mfa.txt dosyasına kaydedildi');
            updateMfaToken(token);
        } catch (err) {
            console.log(`⚠️ MFA dosyaya yazılamadı: ${err.message}`);
        }
    } else {
        console.log('⚠️ MFA Token alınamadı, tekrar deneniyor...');
    }
    setTimeout(autoFetchMFA, CONFIG.MFA_FETCH_INTERVAL);
}

function build(code) {
    const body = '{"code":"' + code + '"}';
    const bl = Buffer.byteLength(body);
    P.set(code, Buffer.from(
        'PATCH /api/v10/guilds/' + G + '/vanity-url HTTP/1.1\r\n' +
        'Host: discord.com\r\nAuthorization: ' + T + '\r\n' +
        'User-Agent: ' + UA + '\r\nX-Super-Properties: ' + SP + '\r\n' +
        'Content-Type: application/json\r\n' +
        (M ? 'X-Discord-MFA-Authorization: ' + M + '\r\n' : '') +
        'Content-Length: ' + bl + '\r\nConnection: keep-alive\r\n\r\n' + body
    ));
}

function makeConn(i) {
    const host = EDGE[i % EDGE.length];
    const s = tlsConnect({
        host: host, port: 443, servername: 'discord.com',
        rejectUnauthorized: false, ALPNProtocols: ['http/1.1'],
        session: SES, highWaterMark: 65536
    });
    s.setNoDelay(true);
    s.setKeepAlive(true, 0);
    if (s.socket) s.socket.setNoDelay(true);
    s.once('session', t => { SES = t; });
    s.on('data', chunk => {
        const r = chunk.toString();
        if (r.includes('cf-nel') || r.includes('Report-To:')) return;
        const a = r.indexOf('{'), b = r.lastIndexOf('}');
        if (a !== -1 && b > a) {
            const statusMatch = r.match(/HTTP\/\d\.\d (\d{3})/);
            const status = statusMatch ? statusMatch[1] : '???';
            const body = r.slice(a, b + 1);
            console.log('[S' + i + '] ' + status + ' ' + body.slice(0, 300));
            if (r.includes('/vanity-url')) {
                try {
                    const parsed = JSON.parse(body);
                    const code = parsed.code || 'unknown';
                    process.nextTick(notify, code, body);
                } catch {}
            }
        }
    });
    s.on('error', (err) => {
        console.log('TLS' + i + ' error:', err.message || 'unknown');
    });
    s.on('close', () => { 
        S[i] = null; 
        // Yavaşlama: Bağlantı kapanınca 2 saniye bekle
        setTimeout(() => makeConn(i), 2000); 
    });
    S[i] = s;
}

function makeNotifier() {
    NS = tlsConnect({
        host: EDGE[0], port: 443, servername: 'discord.com',
        rejectUnauthorized: false, ALPNProtocols: ['http/1.1'], session: SES
    });
    NS.setNoDelay(true);
    NS.setKeepAlive(true, 0);
    NS.on('data', () => {});
    NS.on('error', (err) => {
        console.log('Notifier error:', err.message || 'unknown');
    });
    NS.on('close', () => { 
        NS = null; 
        setTimeout(makeNotifier, 1000); 
    });
}

function fire(code) {
    const pkt = P.get(code);
    if (!pkt) return;
    console.log('>>> FIRE ' + code + ' x' + N);
    
    // Yavaşlama: Her request'ten sonra 500ms bekle
    for (let i = 0; i < N; i++) {
        setTimeout(() => {
            const s = S[i];
            if (s && s.writable && !s.destroyed) s.write(pkt);
        }, i * 500); // i * 500ms delay
    }
}

function notify(code, info) {
    if (!NS || !NS.writable || NS.destroyed) return;
    
    // Yavaşlama: 2 saniye bekle mesaj göndermeden önce
    setTimeout(() => {
        const text = '@everyone `' + code + '`\n```json\n' + (info || '').slice(0, 1800) + '\n```';
        const json = JSON.stringify({ content: text });
        const bl = Buffer.byteLength(json);
        NS.write(Buffer.from(
            'POST /api/v10/channels/' + CH + '/messages HTTP/1.1\r\n' +
            'Host: discord.com\r\nAuthorization: ' + T + '\r\n' +
            'Content-Type: application/json\r\nContent-Length: ' + bl + '\r\n' +
            'Connection: keep-alive\r\n\r\n' + json
        ));
    }, 2000); // 2 saniye delay
}

function gw(tk, idx, gen) {
    if (gen !== gwGen) return;
    const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
    gwConns.push(ws);
    let hb = null, sq = null, hbPay = '{"op":1,"d":null}';

    ws.addEventListener('open', () => {
        console.log('WS' + idx + ' connected');
    });

    ws.addEventListener('message', (event) => {
        let data;
        if (typeof event.data === 'string') {
            data = event.data;
        } else {
            try {
                data = event.data.toString();
            } catch (e) {
                console.log('WS' + idx + ' data parse error');
                return;
            }
        }
        
        if (data.indexOf('GUILD_UPDATE') !== -1) {
            let p; try { p = JSON.parse(data); } catch { return; }
            if (typeof p.s === 'number') { sq = p.s; hbPay = '{"op":1,"d":' + p.s + '}'; }
            if (p.t !== 'GUILD_UPDATE') return;
            const gid = p.d.id;
            const prev = V.get(gid);
            const curr = p.d.vanity_url_code;
            if (prev && prev !== curr) {
                if (curr) { V.set(gid, curr); build(curr); }
                else V.delete(gid);
                process.nextTick(fire, prev);
                console.log('WS' + idx + ' >>> ' + prev + ' -> ' + (curr || 'null'));
            } else if (!prev && curr) {
                V.set(gid, curr);
                build(curr);
            }
            return;
        }

        if (data.indexOf('GUILD_DELETE') !== -1) {
            let p; try { p = JSON.parse(data); } catch { return; }
            if (typeof p.s === 'number') { sq = p.s; hbPay = '{"op":1,"d":' + p.s + '}'; }
            if (p.t !== 'GUILD_DELETE') return;
            const prev = V.get(p.d.id);
            if (prev) {
                V.delete(p.d.id);
                process.nextTick(fire, prev);
            }
            return;
        }

        const si = data.indexOf('"s":');
        if (si !== -1) {
            let j = si + 4;
            while (j < data.length && data[j] === ' ') j++;
            if (data[j] >= '0' && data[j] <= '9') {
                let n = 0;
                while (j < data.length && data[j] >= '0' && data[j] <= '9') {
                    n = n * 10 + data.charCodeAt(j++) - 48;
                }
                sq = n;
                hbPay = '{"op":1,"d":' + n + '}';
            }
        }

        if (data.indexOf('"GUILD_CREATE"') !== -1) {
            let p; try { p = JSON.parse(data); } catch { return; }
            if (typeof p.s === 'number') { sq = p.s; hbPay = '{"op":1,"d":' + p.s + '}'; }
            if (p.t !== 'GUILD_CREATE' || !p.d) return;
            if (p.d.vanity_url_code) {
                V.set(p.d.id, p.d.vanity_url_code);
                build(p.d.vanity_url_code);
                console.log('WS' + idx + ' guild: ' + p.d.name + ' vanity: ' + p.d.vanity_url_code);
            }
            return;
        }

        if (data.indexOf('"READY"') !== -1) {
            let p; try { p = JSON.parse(data); } catch { console.log('WS' + idx + ' ready parse error'); return; }
            if (p.t !== 'READY' || !p.d) return;
            const gs = p.d.guilds || [];
            let vanityCount = 0;
            for (let i = 0; i < gs.length; i++) {
                if (gs[i].vanity_url_code) {
                    V.set(gs[i].id, gs[i].vanity_url_code);
                    build(gs[i].vanity_url_code);
                    vanityCount++;
                }
            }
            console.log('WS' + idx + ' ready: ' + gs.length + ' guilds, ' + vanityCount + ' vanity');
            return;
        }

        if (data.indexOf('"op":10') !== -1) {
            let p; try { p = JSON.parse(data); } catch { return; }
            if (p.op !== 10) return;
            if (hb) clearInterval(hb);
            const iv = p.d.heartbeat_interval;
            // Yavaşlama: Heartbeat interval'ı 1.5x daha yavaş yap
            const slowedIv = Math.floor(iv * 1.5);
            setTimeout(() => {
                if (ws.readyState === 1) ws.send(hbPay);
            }, Math.random() * slowedIv | 0);
            hb = setInterval(() => {
                if (ws.readyState === 1) ws.send(hbPay);
            }, slowedIv * 0.85 | 0);
            ws.send('{"op":2,"d":{"token":"' + tk + '","intents":513,"large_threshold":250,"properties":{"os":"linux","browser":"chrome","device":""}}}');
            return;
        }

        if (data.indexOf('"op":7') !== -1 || data.indexOf('"op":9') !== -1) {
            ws.close();
        }
    });

    ws.addEventListener('close', () => {
        console.log('WS' + idx + ' closed');
        const ci = gwConns.indexOf(ws);
        if (ci !== -1) gwConns.splice(ci, 1);
        if (hb) { clearInterval(hb); hb = null; }
        // Yavaşlama: Reconnect delay'ını 3 saniyeye çıkar
        if (gen === gwGen) setTimeout(() => gw(tk, idx, gen), 3000);
    });

    ws.addEventListener('error', (err) => {
        console.log('WS' + idx + ' error:', err.message || 'unknown');
    });
}

function startGateway() {
    gwGen++;
    const gen = gwGen;
    for (const ws of gwConns) { try { ws.close(); } catch {} }
    gwConns.length = 0;
    gw(T, 0, gen);
}

let M = CONFIG.MFA_TOKEN; // CONFIG'den başla, sonra file'dan override et

let mt = null;
try {
    watch('mfa.txt', () => {
        if (mt) return;
        // Yavaşlama: File watch debounce'ı 500ms'e çıkar (50ms'den)
        mt = setTimeout(() => {
            mt = null;
            try {
                const n = readFileSync('mfa.txt', 'utf8').trim();
                if (n && n !== M) {
                    console.log('✅ MFA token updated from file');
                    M = n;
                    P.clear();
                    V.forEach(code => build(code));
                }
            } catch {}
        }, 500);
    });
    console.log('👁️ Watching mfa.txt for changes');
} catch {}

// Initial load from file if exists
try { 
    const fileMfa = readFileSync('mfa.txt', 'utf8').trim(); 
    if (fileMfa) {
        M = fileMfa;
        console.log('📄 MFA token loaded from mfa.txt');
    }
} catch {}

console.log('🚀 Starting Salvia...');
console.log(`📊 Configuration:`);
console.log(`   Token: ${CONFIG.TOKEN.slice(0, 20)}...`);
console.log(`   Guild ID: ${CONFIG.GUILD_ID}`);
console.log(`   Channel ID: ${CONFIG.CHANNEL_ID}`);
console.log(`   Request Count: ${CONFIG.REQUEST_COUNT}`);
console.log(`   Auto MFA Fetch: ${CONFIG.AUTO_FETCH_MFA ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`   MFA: ${M ? '✅ Configured' : '⚠️ Not configured'}`);
console.log('');

// Auto MFA fetch başlat
if (CONFIG.AUTO_FETCH_MFA && CONFIG.MFA_PASSWORD) {
    console.log('🔄 Otomatik MFA fetch başlıyor...');
    autoFetchMFA();
}

for (let i = 0; i < N; i++) makeConn(i);
makeNotifier();
startGateway();

let pi = 0;
// Yavaşlama: Ping interval'ını 10 saniyeye çıkar (3 saniyeden)
setInterval(() => {
    const s = S[pi];
    if (s && s.writable && !s.destroyed) s.write(PING);
    if (++pi >= N) pi = 0;
}, 10000);

// Yavaşlama: Notifier ping interval'ını 30 saniyeye çıkar (15 saniyeden)
setInterval(() => {
    if (NS && NS.writable && !NS.destroyed) NS.write(PING);
}, 30000);

process.on('uncaughtException', (err) => {
    console.log('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (err) => {
    console.log('Unhandled Rejection:', err.message || err);
});
