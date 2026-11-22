// Pearly đã chuyển sang https://littledua.github.io/pearly/
// Bản này tự gỡ: xoá file cũ của /pinyaprinting/pearly/ trong kho tạm rồi unregister.
// Lưu ý: app mới dùng cùng tên kho "pearly-*" trên cùng tên miền, nên chỉ xoá file
// thuộc đường dẫn cũ, không xoá cả kho. Không đụng tới localStorage (sổ, outbox, phiên đăng nhập).
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  const OLD=new URL('./',self.registration.scope).pathname; // /pinyaprinting/pearly/
  for(const k of await caches.keys()){
    if(!k.startsWith('pearly-')) continue;
    const c=await caches.open(k);
    for(const req of await c.keys()){ if(new URL(req.url).pathname.startsWith(OLD)) await c.delete(req); }
    if((await c.keys()).length===0) await caches.delete(k);
  }
  await self.registration.unregister();
  for(const cl of await self.clients.matchAll({type:'window'})) cl.navigate('https://littledua.github.io/pearly/');
})())});
