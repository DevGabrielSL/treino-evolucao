export async function playCard(button){
 if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
 const card=button?.closest?.('.sport-card');if(!card?.animate)return false;
 try{await card.animate([{transform:'translateY(0) scale(1)',filter:'brightness(1)'},{transform:'translateY(-14px) scale(1.035)',filter:'brightness(1.25)',offset:.5},{transform:'translateY(-4px) scale(.96)',opacity:.35}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'}).finished;}catch{}
 return true;
}
