// Run: node test/test.js
const fs=require('fs'),E=require('../js/engine.js'),assert=require('assert');
const V=JSON.parse(fs.readFileSync(__dirname+'/../data/vocabulary.json','utf8'));
const v=E.validate(V);console.log('entries',v.entries,'unique words',v.uniqueWords,'repeated',v.repeated,'errors',v.errs);
assert.deepStrictEqual(v.errs,[]);
assert.strictEqual(E.lev('abeyance','abeyence'),1);
assert.strictEqual(E.evalMeaning('to calm down','Subside, or moderate'),'wrong');
assert.strictEqual(E.evalMeaning('it subsides','Subside, or moderate'),'correct');
let r=E.blank();E.update(r,{mode:'recall',ok:true,unaided:true,now:1e12});assert(E.level(r)<=2,'one answer must not master');
for(let i=0;i<8;i++)E.update(r,{mode:['recall','rev','cloze'][i%3],ok:true,unaided:true,now:1e12+i*3*E.DAY});
assert.strictEqual(E.level(r),5);
E.update(r,{mode:'rev',ok:false,now:2e12});E.update(r,{mode:'rev',ok:false,now:2e12});assert(E.level(r)<5,'lapse demotes');
const a=E.blank(),b=E.blank();E.update(a,{mode:'rev',ok:false});E.update(b,{mode:'syn',ok:false});
assert(E.weakness(a).s>E.weakness(b).s,'unaided misses weigh more');
console.log('all tests passed');
