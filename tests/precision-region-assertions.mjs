// The visible copy, menu, counters and art may animate simultaneously in
// different visited sections, but never two items within the same section.
export async function maximumSimultaneousJobsInRegion(page){
 return page.evaluate(()=>{
  const active=[...document.querySelectorAll('[data-type-state=typing],[data-reveal-state=active],[data-count-state=counting]')];
  const regionOf=node=>{
   const nav=node.closest('#navbar');if(nav)return nav;
   const footer=node.closest('footer');if(footer)return footer;
   const main=node.closest('main');
   if(main){
    let section=node.closest('main section');
    if(section){
     while(section.parentElement){
      const upper=section.parentElement.closest('main section');
      if(!upper)break;
      section=upper;
     }
     return section;
    }
    let top=node;
    while(top.parentElement&&top.parentElement!==main)top=top.parentElement;
    return top.parentElement===main?top:main;
   }
   return node.parentElement||node;
  };
  const groups=new Map();
  for(const node of active){
   const section=regionOf(node);
   groups.set(section,(groups.get(section)||0)+1);
  }
  return Math.max(0,...groups.values());
 });
}
