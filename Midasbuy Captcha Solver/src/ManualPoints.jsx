import React,{useState} from 'react';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';

export function ManualPoints({result,busy,onApply}) {
  const center=box=>box?[box[0]+(box[2]-1)/2,box[1]+(box[3]-1)/2]:['',''];
  const [values,setValues]=useState([...center(result.piece_box || result.piece_dom_box),...center(result.gap_box)]);
  const [next,setNext]=useState(0);
  const labels=['Piece center X','Piece center Y','Gap center X','Gap center Y'];
  const ready=values.every(value=>value!=='' && Number.isFinite(Number(value)));
  function choose(event) {
    if(busy || event.detail===0)return; // Keyboard users have the coordinate inputs.
    const image=event.currentTarget.querySelector('img'),rect=image.getBoundingClientRect();
    const point=[Math.round((event.clientX-rect.x)*result.width/rect.width),Math.round((event.clientY-rect.y)*result.height/rect.height)];
    if(point[0]<0 || point[0]>=result.width || point[1]<0 || point[1]>=result.height)return;
    setValues(previous=>previous.map((v,i)=>i===next*2?point[0]:i===next*2+1?point[1]:v));
    setNext(next===0?1:0);
  }
  return <section className="manual-points" aria-label="Manual center selection">
    <p className="solver-note">Click the piece center, then the gap center. You can also enter image coordinates below.</p>
    <p className="status">Next point: {next===0?'piece center (P)':'gap center (G)'}</p>
    <button type="button" className="manual-canvas" disabled={busy} aria-label={`Select ${next===0?'piece':'gap'} center on image`} onClick={choose}>
      <img src={`data:image/png;base64,${result.source_image}`} alt="Current puzzle for manual center selection" />
      {[0,1].map(index=>values[index*2]!=='' && values[index*2+1]!=='' && <span key={index} className="manual-point" style={{left:`${Number(values[index*2])/result.width*100}%`,top:`${Number(values[index*2+1])/result.height*100}%`}}>{index===0?'P':'G'}</span>)}
    </button>
    <div className="manual-fields">{labels.map((label,i)=><div key={label}>
      <label htmlFor={`manual-point-${i}`}>{label}</label>
      <Input id={`manual-point-${i}`} type="number" min="0" max={(i%2?result.height:result.width)-1} step="1" disabled={busy} value={values[i]}
        onChange={e=>setValues(previous=>previous.map((v,j)=>i===j?e.target.value:v))} />
    </div>)}</div>
    <Button className="solver-full" variant="outline" disabled={busy || !ready} onClick={()=>onApply(values.map(Number))}>Apply manual points</Button>
    <p className="solver-note">Manual points set the movement; they do not increase detector confidence.</p>
  </section>;
}
