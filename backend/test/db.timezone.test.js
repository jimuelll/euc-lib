const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

test('every pooled connection sets its SQL timezone to match UTC date parsing',()=>{
 let options,initialize;
 const pool={on(event,handler){assert.equal(event,'connection');initialize=handler;}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../db.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,process:{env:{}},require(name){if(name==='mysql2/promise')return {createPool(config){options=config;return pool;}};if(name==='dotenv')return {config(){}};throw new Error(name);}});
 assert.equal(options.timezone,'Z');assert.equal(module.exports,pool);
 let command,callback,destroyed=false;
 initialize({query(sql,done){command=sql;callback=done;},destroy(){destroyed=true;}});
 assert.equal(command,"SET time_zone = '+00:00'");callback(null);assert.equal(destroyed,false);
 callback(new Error('Session initialization failed'));assert.equal(destroyed,true);
});
