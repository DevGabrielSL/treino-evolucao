from pathlib import Path
p=Path(__file__).resolve().parents[1]/'dist/testes'
f=p/'coach_logic.js';s=f.read_text();needle=" const src=normalize(message).replace(/\\u00d7/g,'x');"
guard=r'''
 // Validate full numeric tokens before the legacy parser can match a suffix.
 let checked=src;
 const rirTokens=[...src.matchAll(/\brir\s*[:=]?\s*([+-]?\d+(?:[.,]\d+)?)(?:\s*[-–—]\s*([+-]?\d+(?:[.,]\d+)?))?(?![\w.,])/g)];
 if(/\brir\b/.test(src)&&rirTokens.length!==1)throw new Error('Informe um RIR válido entre 0 e 10.');
 for(const m of rirTokens){const low=Number(m[1].replace(',','.')),high=m[2]===undefined?low:Number(m[2].replace(',','.'));if(low<0||high>10||high<low)throw new Error('RIR deve estar entre 0 e 10 e a faixa deve ser crescente.');checked=checked.replace(m[0],' ');}
 if(/(^|[\s:=])[-−]\s*\d/.test(checked))throw new Error('Carga ou repetições negativas não são permitidas.');
 for(const m of checked.matchAll(/(?<![\d.,])([+-]?\d+(?:[.,]\d+)?)\s*(?:reps?|repetic(?:oes|ao))\b/g))if(/[.,]/.test(m[1])||!Number.isInteger(Number(m[1].replace(',','.'))))throw new Error('Repetições devem ser inteiras.');
 for(const m of checked.matchAll(/\b\d+(?:[.,]\d+)?\s*x\s*([+-]?\d+(?:[.,]\d+)?)/g))if(/[.,]/.test(m[1])||!Number.isInteger(Number(m[1].replace(',','.'))))throw new Error('Repetições devem ser inteiras.');
 if(/(?<![a-z])(?:lb|lbs|pounds?|libras?|g|gramas?)\b/.test(checked))throw new Error('Unidade incompatível ou não suportada.');
 if(/[\d][.,]\d+[.,]\d/.test(src))throw new Error('Número ambíguo. Confira a entrada.');
'''
assert s.count(needle)==1;s=s.replace(needle,needle+guard);f.write_text(s)
f=p/'store.js';s=f.read_text();needle="function checkRelationships(e){";extra="""function checkRelationships(e){
 for(const s of e.sessions)if(s.duration_minutes!=null&&(typeof s.duration_minutes!=='number'||!Number.isFinite(s.duration_minutes)||s.duration_minutes<0))throw new Error('Duração inválida');
 for(const s of e.sets)if(s.rpe!=null&&(typeof s.rpe!=='number'||!Number.isFinite(s.rpe)||s.rpe<0||s.rpe>10))throw new Error('RPE inválido');
""";assert s.count(needle)==1;f.write_text(s.replace(needle,extra))
