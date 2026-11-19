"""Full-outline localization regressions for split red and missed pale symbols."""
import hashlib
from pathlib import Path
import numpy as np
from candidate_stage import physical_symbols, overlap
from detect_symbols import read_image, locate_regions, load_library

ROOT=Path(__file__).resolve().parent


def main():
    cases=[(15, 'B', [383,105,45,44]), (17, 'B', [295,105,43,44])]
    for number, label, expected in cases:
        source=ROOT/'raw_data'/f'input{number}.png'
        image=read_image(source)
        _,scene,_=locate_regions(image)
        library=load_library(hashlib.sha256(source.read_bytes()).hexdigest())
        objects,_=physical_symbols(image,scene,library)
        assert len(objects)==5
        candidate=next(c for c in objects if c['id']==label)
        assert overlap(candidate['box'],expected)>.70, (number,candidate['box'])
        assert np.linalg.norm(np.array(candidate['center'])-np.array([expected[0]+expected[2]/2,expected[1]+expected[3]/2]))<6
        print(f"PASS input{number}: {label} encloses the full icon at {candidate['box']}",flush=True)


if __name__=='__main__':
    main()
