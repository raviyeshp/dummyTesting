import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
test('checkout validates totals and stock, orders progress, cancellation restores inventory',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cp-test-'));const port=31000+Math.floor(Math.random()*15000);
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),CP_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server failed');}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server startup timed out')),8000).unref())]);
  const request=async(path,b)=>{const r=await fetch(`http://127.0.0.1:${port}/api/${path}`,b?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}:{});return {status:r.status,data:await r.json()};};
  assert.equal((await fetch(`http://127.0.0.1:${port}`)).status,200);
  const before=(await request('store')).data.products[0];const items=[{id:before.id,qty:1}];
  const q=(await request('quote',{items,coupon:'WELCOME5'})).data;assert.equal(q.discount,Math.round(before.price*.05));assert.equal(q.total,before.price-q.discount);
  assert.equal((await request('quote',{items:[{id:before.id,qty:999}]})).status,400);
  assert.equal((await request('quote',{items:[...items,...items]})).status,400);
  assert.equal((await request('quote',{items,coupon:'BAD'})).status,400);
  const b={items,coupon:'WELCOME5',payment:'COD',customer:{name:'Test Customer',phone:'9876543210',address:'Test street',city:'Test city',pin:'400001'}};
  const result=await request('orders',b);assert.equal(result.status,200);assert.equal(result.data.total,q.total);const id=result.data.id;
  assert.equal((await request('store')).data.products[0].stock,before.stock-1);
  assert.equal((await request('order-status',{id,status:'Shipped'})).status,400);
  assert.equal((await request('order-status',{id,status:'Confirmed'})).status,200);
  assert.equal((await request('order-status',{id,status:'Cancelled'})).status,200);
  assert.equal((await request('store')).data.products[0].stock,before.stock);
  assert.equal((await request('order-status',{id,status:'Cancelled'})).status,400);
  assert.equal((await request('products',{name:'Invalid',category:'Test',price:-1,mrp:0,stock:1})).status,400);
 }finally{child.kill();await once(child,'exit');await rm(dir,{recursive:true,force:true});}
});
