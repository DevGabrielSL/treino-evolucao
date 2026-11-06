const norm=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const art=slug=>({src:'./exercise-'+slug+'.webp',width:768,height:1152});
export function exerciseArt(name,equipment=''){
 const n=norm(name),q=norm(equipment),both=n+' '+q;
 if(/supino/.test(n)&&/inclinado/.test(n)&&/halter/.test(both))return art('supino-inclinado-halteres');
 if(/supino reto/.test(n)&&/barra/.test(both))return art('supino-reto-barra');
 if(/supino declinado/.test(n)&&/maquina/.test(both))return art('supino-declinado-maquina');
 if(/crucifixo/.test(n)&&!/inverso/.test(n)&&/maquina/.test(both)&&/inclinad/.test(both))return art('crucifixo-maquina-inclinada');
 if(/rosca.*scott/.test(n)&&/unilateral/.test(both))return art('rosca-scott-unilateral');
 if(/rosca.*inclinad/.test(n)&&/45/.test(both))return art('rosca-inclinada-45');
 if(/rosca martelo/.test(n)&&/halter/.test(both))return art('rosca-martelo');
 if(/elevacao lateral/.test(n)&&/polia/.test(both))return art('elevacao-lateral-polia');
 return null;
}
export function renderExerciseArt(name,equipment='',mini=false){
 const item=exerciseArt(name,equipment);if(!item)return '';
 return '<img class="exercise-card-image" src="'+item.src+'" alt="" width="768" height="1152" loading="lazy" decoding="async"'+(mini?' sizes="138px"':'')+'>';
}
