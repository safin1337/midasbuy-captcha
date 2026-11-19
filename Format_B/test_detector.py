"""Deterministic offline regression checks, with synthetic evidence clearly labeled."""
from pathlib import Path
import tempfile
import cv2
import numpy as np
from detect_symbols import run, save_image

ROOT = Path(__file__).resolve().parent

def symbol(kind):
    mask = np.zeros((80,80), np.uint8)
    if kind == 0:
        cv2.rectangle(mask,(12,12),(67,67),255,5)
        cv2.line(mask,(12,24),(67,24),255,4)
        cv2.line(mask,(39,34),(39,57),255,5)
        cv2.line(mask,(28,45),(50,45),255,5)
    elif kind == 1:
        cv2.rectangle(mask,(14,8),(64,70),255,5)
        for y in (23,38,53):
            cv2.line(mask,(21,y),(57,y),255,4)
    elif kind == 2:
        cv2.polylines(mask,[np.array([(10,69),(10,20),(31,8),(31,69),(48,69),(48,8),(69,20),(69,69),(10,69)])],False,255,4)
        for x in (19,56):
            for y in (27,41,55):
                cv2.line(mask,(x,y),(x+5,y),255,4)
    elif kind == 3:
        for y in (18,39,60):
            cv2.ellipse(mask,(40,y),(17,10),0,0,360,255,4)
    else:
        cv2.polylines(mask,[np.array([(12,12),(33,12),(33,48),(64,48),(64,68),(12,68),(12,12)])],False,255,4)
        cv2.line(mask,(22,16),(22,62),255,3)
    return mask


def fixture(path, angles=(15,-10,25,0,0), order=(0,1,2)):
    image=np.full((445,447,3),245,np.uint8)
    image[10:89,15:437]=(255,125,0)
    cv2.putText(image,'Click in this order:',(22,77),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),2)
    cv2.circle(image,(417,29),11,(255,255,255),2)
    cv2.line(image,(413,25),(421,33),(255,255,255),2)
    cv2.line(image,(421,25),(413,33),(255,255,255),2)
    scene=image[89:393,15:437]
    yy,xx=np.indices(scene.shape[:2])
    scene[:,:,0]=(180+15*np.sin(yy/11)).astype(np.uint8)
    scene[:,:,1]=(160+20*np.sin((yy+xx)/30)).astype(np.uint8)
    scene[:,:,2]=(80+10*np.sin(xx/19)).astype(np.uint8)
    image[52:84,231:333]=(170,165,65)
    for index,kind in enumerate(order):
        small=cv2.resize(symbol(kind),(27,27),interpolation=cv2.INTER_NEAREST)
        region=image[55:82,234+index*33:261+index*33]
        region[small>0]=(20,20,20)
    centers=[(212,113),(123,157),(254,114),(344,201),(124,291)]
    colors=[(140,40,180),(140,40,135),(50,145,60),(30,110,140),(20,230,230)]
    for kind,(cx,cy),color,angle in zip(range(5),centers,colors,angles):
        mask=cv2.warpAffine(symbol(kind),cv2.getRotationMatrix2D((39.5,39.5),angle,1),(80,80))
        mask=cv2.resize(mask,(47,47),interpolation=cv2.INTER_NEAREST)
        region=image[cy-23:cy+24,cx-23:cx+24]
        region[mask>0]=color
    save_image(path,image)
    return [centers[k] for k in order]


def main():
    output=ROOT/'examples'/'synthetic'
    output.mkdir(parents=True,exist_ok=True)
    cases=[((15,-10,25,0,0),(0,1,2)),((-35,30,-20,15,20),(2,0,1)),((0,0,0,0,0),(1,2,0))]
    for case,(angles,order) in enumerate(cases):
        source=output/f'case-{case}.png'
        expected=fixture(source,angles,order)
        result=run(source,output/f'case-{case}')
        actual=[m['center'] for m in result['matches']]
        print(f'case {case}: expected={expected} actual={actual} status={result["status"]}')
        assert len({m['candidate'] for m in result['matches']})==3
        assert all(np.linalg.norm(np.array(a)-np.array(e))<15 for a,e in zip(actual,expected)), result['score_matrix']
    ambiguous_source=output/'ambiguous.png'
    fixture(ambiguous_source)
    image=cv2.imdecode(np.fromfile(str(ambiguous_source),dtype=np.uint8),cv2.IMREAD_COLOR)
    duplicate=cv2.warpAffine(symbol(0),cv2.getRotationMatrix2D((39.5,39.5),15,1),(80,80))
    duplicate=cv2.resize(duplicate,(47,47),interpolation=cv2.INTER_NEAREST)
    region=image[267:314,322:369]
    region[duplicate>0]=(140,40,180)
    save_image(ambiguous_source,image)
    ambiguous=run(ambiguous_source,output/'ambiguous')
    assert ambiguous['status']=='review_required', ambiguous
    print('Ambiguous duplicate shape correctly flagged for review.')
    slider=ROOT.parent/'Format_A'/'examples'/'real'/'slider-01.png'
    if slider.exists():
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            try:
                run(slider,temporary)
            except ValueError:
                print('Existing slider screenshot correctly rejected by click-order detector.')
            else:
                raise AssertionError('Slider was incorrectly treated as a click-order image.')
    print('PASS: 3 rotated/permuted synthetic cases, unique assignments, ambiguity detection, and unsupported-format handling.')

if __name__=='__main__':
    main()


