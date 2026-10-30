/* Hide only during initialization; content returns if the motion controller fails. */
if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){
 document.documentElement.classList.add('type-system');
 setTimeout(()=>{if(!document.documentElement.dataset.precisionTypeReady)document.documentElement.classList.remove('type-system');},4000);
}
