export async function playCard(button){
 if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
 const card=button?.closest?.('.sport-card');if(!card?.animate)return false;
 try{await card.animate([{transform:'perspective(850px) translateY(0) rotateY(0) scale(1)',filter:'brightness(1)',opacity:1},{transform:'perspective(850px) translateY(-24px) rotateY(-16deg) scale(1.045)',filter:'brightness(1.55)',offset:.45},{transform:'perspective(850px) translateY(-38px) rotateY(30deg) scale(.86)',filter:'brightness(1.1)',opacity:.2}],{duration:620,easing:'cubic-bezier(.2,.7,.2,1)'}).finished;}catch{}
 return true;
}
