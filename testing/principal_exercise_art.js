const norm=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const art=slug=>({src:'./exercise-'+slug+'.webp',width:768,height:1152});
export function exerciseArt(name,equipment=''){
 const n=norm(name),q=norm(equipment),both=n+' '+q;
 if(/rosca/.test(n)&&/polia/.test(both)&&/alongad/.test(both))return art('rosca-polia-alongada');
 if(/triceps testa/.test(n)&&/halter/.test(both))return art('triceps-testa-halteres');
 if(/desenvolvimento/.test(n)&&/ombro/.test(n)&&/maquina/.test(both))return art('desenvolvimento-ombros-maquina');

 if(/puxada alta/.test(n)&&/unilateral/.test(both))return art('puxada-alta-unilateral');
 if(n==='puxada alta')return art('puxada-alta');
 if(/remada articulada/.test(n)&&/apoio/.test(both))return art('remada-articulada-apoio');
 if(/remada alta/.test(n)&&/apoio no peito/.test(both))return art('remada-alta-apoio-peito');
 if(/triceps frances/.test(n)&&/barra v/.test(both))return art('triceps-frances-polia-barra-v');
 if(/triceps testa/.test(n)&&/barra v/.test(both)&&!/halter/.test(both))return art('triceps-testa-barra-v');
 if(/triceps/.test(n)&&!/frances|testa/.test(n)&&/polia/.test(both)&&/barra v/.test(both))return art('triceps-polia-barra-v');
 if(/crucifixo inverso/.test(n)&&/maquina/.test(both))return art('crucifixo-inverso-maquina');

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


