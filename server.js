import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const dataDir=process.env.CP_DATA_DIR || root+'data';
await mkdir(dataDir, { recursive: true });
const initial = { products: [
 ['Lenovo IdeaPad Slim 3','Laptops','Lenovo',42990,49990,12,'15.6-inch FHD · Ryzen 5 · 16GB RAM · 512GB SSD','laptop'],
 ['ASUS Vivobook 15','Laptops','ASUS',54990,62990,8,'15.6-inch OLED · Intel Core i5 · 16GB · 512GB SSD','laptop'],
 ['Logitech MX Master 3S','Peripherals','Logitech',7995,10995,18,'Wireless performance mouse · Quiet clicks · USB-C','mouse'],
 ['Samsung 24-inch IPS Monitor','Monitors','Samsung',9990,13990,4,'Full HD · 100Hz refresh rate · Eye Saver mode','monitor'],
 ['Kingston FURY Beast 16GB','Components','Kingston',3499,4999,22,'DDR4 · 3200MHz · Desktop memory · Lifetime warranty','ram'],
 ['Zebronics Mechanical Keyboard','Peripherals','Zebronics',2499,3999,5,'Tactile switches · RGB backlight · USB wired','keyboard'],
 ['TP-Link Archer C6','Networking','TP-Link',2499,3499,9,'AC1200 · Dual-band Wi-Fi · Gigabit ports','router'],
 ['Crucial P3 1TB NVMe SSD','Components','Crucial',5299,6999,3,'PCIe 3.0 · Up to 3500MB/s · 5-year warranty','ssd']
 ].map((p,i)=>({id:String(i+1),name:p[0],category:p[1],brand:p[2],price:p[3],mrp:p[4],stock:p[5],specs:p[6],art:p[7],sku:`CP-${1001+i}`,active:true})),orders:[],coupons:[{code:'WELCOME5',type:'percent',value:5,min:1000,active:true}] };
let db; try {db=JSON.parse(await readFile(dataDir+'/store.json','utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;db=initial;}
const save=()=>writeFile(dataDir+'/store.json',JSON.stringify(db,null,2));
let queue=Promise.resolve();
const statuses=['Pending','Confirmed','Packed','Shipped','Delivered','Cancelled'];
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>100000)fail('Request too large',413);}try{return JSON.parse(s);}catch{fail('Invalid JSON');}}
function quote(b){if(!Array.isArray(b.items)||!b.items.length)fail('Your cart is empty');const seen=new Set();const items=b.items.map(i=>{const p=db.products.find(p=>p.id===i.id&&p.active);if(!p||!Number.isInteger(i.qty)||i.qty<1||seen.has(i.id))fail('Invalid cart item');seen.add(i.id);if(p.stock<i.qty)fail(`${p.name}: only ${p.stock} available`);return {id:p.id,name:p.name,price:p.price,qty:i.qty};});const subtotal=items.reduce((n,i)=>n+i.price*i.qty,0);const coupon=b.coupon?db.coupons.find(c=>c.active&&c.code===String(b.coupon).toUpperCase()):null;if(b.coupon&&(!coupon||subtotal<coupon.min))fail('Coupon is invalid or minimum order is not met');const discount=coupon?Math.min(subtotal,Math.round(coupon.type==='percent'?subtotal*coupon.value/100:coupon.value)):0;return {items,subtotal,discount,shipping:subtotal>=5000?0:99,total:subtotal-discount+(subtotal>=5000?0:99)};}
async function api(req,res,path){
 if(req.method==='GET'&&path==='/api/store')return {products:db.products,orders:db.orders,coupons:db.coupons};
 const b=await body(req);
 if(req.method==='POST'&&path==='/api/quote')return quote(b);
 if(req.method==='POST'&&path==='/api/orders'){const q=quote(b);if(!b.customer||!['name','phone','address','city','pin'].every(k=>typeof b.customer[k]==='string'&&b.customer[k].trim()))fail('Complete all delivery fields');if(!/^[6-9]\d{9}$/.test(b.customer.phone)||!/^\d{6}$/.test(b.customer.pin))fail('Enter a valid Indian phone number and PIN code');if(!['COD','UPI demo','Card demo'].includes(b.payment))fail('Choose a payment method');const order={...q,id:'CP-'+randomUUID().slice(0,8).toUpperCase(),customer:b.customer,payment:b.payment,status:'Pending',createdAt:new Date().toISOString()};q.items.forEach(i=>db.products.find(p=>p.id===i.id).stock-=i.qty);db.orders.unshift(order);await save();return order;}
 if(req.method==='POST'&&path==='/api/products'){if(!b.name?.trim()||!b.category?.trim()||!Number.isFinite(b.price)||b.price<=0||!Number.isFinite(b.mrp)||b.mrp<b.price||!Number.isInteger(b.stock)||b.stock<0)fail('Check product name, category, prices and stock');const existing=db.products.find(p=>p.id===b.id);const p={id:existing?.id||randomUUID(),name:b.name.trim().slice(0,150),category:b.category,brand:String(b.brand||''),price:b.price,mrp:b.mrp,stock:b.stock,specs:String(b.specs||''),sku:String(b.sku||''),art:existing?.art||'laptop',active:b.active!==false};if(existing)Object.assign(existing,p);else db.products.push(p);await save();return p;}
 if(req.method==='POST'&&path==='/api/order-status'){const o=db.orders.find(o=>o.id===b.id);if(!o||!statuses.includes(b.status))fail('Invalid order or status');if(o.status==='Cancelled'||o.status==='Delivered')fail('This order is closed');if(b.status!=='Cancelled'&&statuses.indexOf(b.status)!==statuses.indexOf(o.status)+1)fail('Advance orders one step at a time');if(b.status==='Cancelled')o.items.forEach(i=>db.products.find(p=>p.id===i.id).stock+=i.qty);o.status=b.status;await save();return o;}
 if(req.method==='POST'&&path==='/api/coupons'){const code=String(b.code||'').trim().toUpperCase();if(!/^[A-Z0-9]{3,20}$/.test(code)||!['percent','fixed'].includes(b.type)||!Number.isFinite(b.value)||b.value<=0||(b.type==='percent'&&b.value>100)||!Number.isFinite(b.min)||b.min<0)fail('Enter a valid coupon and discount');if(db.coupons.some(c=>c.code===code))fail('Coupon already exists');db.coupons.push({code,type:b.type,value:b.value,min:b.min,active:true});await save();return {ok:true};}
 fail('Not found',404);
}
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path.startsWith('/api/')){const task=queue.then(()=>api(req,res,path));queue=task.catch(()=>{});const result=await task;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));return;}const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};if(!files[path])fail('Not found',404);const content=await readFile(root+'public/'+files[path]);res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html','X-Content-Type-Options':'nosniff'});res.end(content);}catch(e){res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.status?e.message:'Server error'}));}});
server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('Computer Parivaar: http://127.0.0.1:3000'));
