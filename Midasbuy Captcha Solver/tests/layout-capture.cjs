// Read rendered geometry locally. Does not read input values or upload data.
const captureScript=`(() => {
  const round=n=>Math.round(n*10)/10;
  const num=value=>Number.parseFloat(value)||0;
  const nodes=[...document.querySelectorAll('body *')].filter(e=>{
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none' && e.checkVisibility({opacityProperty:true,visibilityProperty:true});
  });
  const ids=new Map(nodes.map((e,i)=>[e,e.id?'#'+e.id:e.tagName.toLowerCase()+'@'+i]));
  const edges=(s,key)=>Object.fromEntries(['top','right','bottom','left'].map(side=>[side,round(num(s[key+side[0].toUpperCase()+side.slice(1)]))]));
  return {name:'solver-'+innerWidth,title:document.title,viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},
    elements:nodes.map(e=>{
      const r=e.getBoundingClientRect(),s=getComputedStyle(e),tag=e.tagName.toLowerCase();
      const control=['button','input','select','textarea'].includes(tag);
      return {id:ids.get(e),tag,parentId:ids.get(e.parentElement),role:e.getAttribute('role')||undefined,
        label:(e.getAttribute('aria-label') || (tag==='img'?e.alt:control?e.labels?.[0]?.textContent||e.textContent:/^h[1-6]$/.test(tag)?e.textContent:'')).trim().slice(0,100),
        interactive:control,rect:{x:round(r.x),y:round(r.y),width:round(r.width),height:round(r.height)},
        style:{display:s.display,position:s.position,padding:edges(s,'padding'),margin:edges(s,'margin'),
          flexDirection:s.flexDirection,flexWrap:s.flexWrap,alignItems:s.alignItems,justifyContent:s.justifyContent,
          rowGap:round(num(s.rowGap)),columnGap:round(num(s.columnGap)),overflowX:s.overflowX,overflowY:s.overflowY,
          boxShadow:s.boxShadow,backgroundColor:s.backgroundColor},
        clientWidth:e.clientWidth,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight};
    })};
})()`;
module.exports={captureScript};
