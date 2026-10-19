// Pearly offline shell. Money data never goes in this cache; it lives in Supabase.
const V='pearly-6d3662c29b';
const SHELL=["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "sea/b0.webp", "sea/b1.webp", "sea/b2.webp", "sea/b3.webp", "sea/b4.webp", "sea/b5.webp", "sea/bg_pc.webp", "sea/bg_ph.webp", "sea/c0.webp", "sea/c1.webp", "sea/c2.webp", "sea/m_s0_00_L.webp", "sea/m_s0_00_R.webp", "sea/m_s0_06_L.webp", "sea/m_s0_12_L.webp", "sea/m_s0_12_R.webp", "sea/m_s0_14_L.webp", "sea/m_s0_14_R.webp", "sea/m_s0_18_L.webp", "sea/m_s0_18_R.webp", "sea/m_s0_20_L.webp", "sea/m_s0_22_L.webp", "sea/m_s0_22_R.webp", "sea/m_s0_27_L.webp", "sea/m_s0_27_R.webp", "sea/m_s0_34_L.webp", "sea/m_s1_04_L.webp", "sea/m_s1_04_R.webp", "sea/m_s1_15_L.webp", "sea/m_s1_15_R.webp", "sea/m_s1_19_L.webp", "sea/m_s1_19_R.webp", "sea/m_s1_24_L.webp", "sea/m_s1_24_R.webp", "sea/rays_pc.webp", "sea/rays_ph.webp", "sea/w0.webp", "sea/w1.webp", "sea/w2.webp", "sea/w3.webp", "sea/w4.webp", "sea/w5.webp", "sea/water_pc.webp", "sea/water_ph.webp"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('pearly-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return; // Supabase calls always go to the network
  if(e.request.mode==='navigate'){
    // fresh page when online, saved copy when offline
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put('index.html',c));return r}).catch(()=>caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r})));
});
