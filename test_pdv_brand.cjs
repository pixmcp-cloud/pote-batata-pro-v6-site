const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const site=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const brand=path.join(root,'public','assets','brand');
function present(name){const p=path.join(brand,name);assert(fs.existsSync(p),'Missing branded asset '+name);return fs.readFileSync(p)}
function png(name,size){const data=present(name);assert.equal(data.subarray(1,4).toString('ascii'),'PNG');assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);return data}
png('pdv-64.png',64);png('pdv-180.png',180);png('pdv-192.png',192);png('pdv-512.png',512);
const share=present('pdv-share.jpg');
assert(share[0]===255 && share[1]===216,'OG preview must be JPEG');
assert(share.length < 400000,'Keep WhatsApp preview economical in size');
const svg=present('pdv-icon.svg').toString('utf8');
assert(svg.includes('>PDV</text>') && svg.includes('>MULTIVERSAL</text>'));
const manifest=JSON.parse(present('manifest.webmanifest'));
assert.equal(manifest.short_name,'PDV MULTIVERSAL');
assert.equal(manifest.display,'standalone');
assert.equal(manifest.icons.length,2);
for(const [token,what] of [
 ['href="./assets/brand/pdv-64.png?v=multiversal-20261125"','favicon'],
 ['href="./assets/brand/pdv-icon.svg?v=multiversal-20261125"','SVG favicon'],
 ['href="./assets/brand/pdv-180.png?v=multiversal-20261125"','iOS icon'],
 ['href="./assets/brand/manifest.webmanifest?v=multiversal-20261125"','app manifest'],
 ['property="og:title" content="PDV MULTIVERSAL"','WhatsApp title'],
 ['property="og:image" content="https://potobatata-b71f3.web.app/assets/brand/pdv-share.jpg"','WhatsApp preview'],
 ['property="og:image:width" content="1200"','WhatsApp image dimensions'],
 ['property="og:image:height" content="630"','WhatsApp image dimensions'],
 ['content="https://pdv.livresom.com/"','custom domain'],
])assert(site.includes(token),'Missing '+what);
assert(site.includes('poteAuthGate'),'Must retain Google login gate');
console.log('PASS PDV MULTIVERSAL: favicon, app icons, PWA manifest and WhatsApp OG image metadata.');

assert.equal(manifest.name,'PDV MULTIVERSAL');
assert(site.includes('<h1>PDV MULTIVERSAL</h1>'));
assert(site.includes('>Meu Negócio</strong>'));
assert(site.includes('class="ops-business-label">RAMO</span>'));
