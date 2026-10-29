let promptEvent=null,installObserved=false,installBusy=false,helpOpen=false,message='';
const runningStandalone=()=>typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||window.navigator?.standalone===true);
export async function requestAppInstall(event){await event.prompt();return (await event.userChoice)?.outcome||'unknown';}
export function renderInstallCard(){
 const installed=installObserved||runningStandalone();
 return `<section class="surface install-card" id="app-install-card"><h2>Instalar aplicativo</h2><p class="text-small">Tenha o Treino &amp; Evolução na tela inicial, com o novo ícone RPG.</p>${installed?'<p role="status">App instalado ou aberto como aplicativo.</p>':`<button type="button" class="btn primary block" data-install-app ${installBusy?'disabled':''}>${installBusy?'Aguardando o navegador…':'Instalar aplicativo'}</button>`}${message?'<p class="text-small" role="status">'+message+'</p>':''}<details ${helpOpen?'open':''}><summary>Como instalar pelo navegador</summary><ol class="text-small"><li>Se abriu este link dentro de outro aplicativo, use o menu ⋮ no topo e escolha <strong>Abrir no Chrome</strong> ou <strong>Abrir no navegador</strong>.</li><li>No Chrome, toque em ⋮ e procure <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>. Confirme a instalação.</li><li>Se a opção não aparecer logo após desinstalar, feche as abas deste app e abra o endereço novamente no Chrome.</li></ol><p class="text-small">No iPhone ou iPad, abra no Safari e use Compartilhar → Adicionar à Tela de Início.</p><a class="btn block" href="https://devgabrielsl.github.io/treino-evolucao/?v=151" target="_blank" rel="noopener">Abrir endereço do app</a><p class="text-small">Não é necessário limpar os dados do navegador para tentar instalar.</p></details></section>`;
}
function refresh(){const el=document.getElementById('app-install-card');if(el)el.outerHTML=renderInstallCard();}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;message='Instalação disponível neste navegador.';refresh();});
 window.addEventListener('appinstalled',()=>{installObserved=true;promptEvent=null;installBusy=false;message='Instalação confirmada pelo navegador.';refresh();});
 document.addEventListener('click',async event=>{
  if(!event.target.closest?.('[data-install-app]')||installBusy)return;
  if(!promptEvent){helpOpen=true;message='O navegador ainda não disponibilizou a instalação direta. Siga as instruções abaixo.';refresh();return;}
  const current=promptEvent;promptEvent=null;installBusy=true;
  try{const outcome=await requestAppInstall(current);message=outcome==='accepted'?'Instalação solicitada. Aguarde a confirmação do navegador.':'Instalação não concluída. Você pode tentar pelo menu do navegador.';helpOpen=outcome!=='accepted';}
  catch{message='Não foi possível abrir a instalação direta. Use o menu do navegador.';helpOpen=true;}
  finally{installBusy=false;refresh();}
 });
}
