import base64
import unittest
import cv2
import numpy as np

from detect import detect
from guided import group_candidates, sprite_mask, piece_from_dom
from test_detector import sample
from annotate import render_annotation


def dialog():
    image=np.full((480,485,3),245,np.uint8)
    cv2.rectangle(image,(29,21),(453,100),(255,128,0),-1)
    cv2.circle(image,(432,40),12,(255,255,255),2)
    cv2.line(image,(427,35),(437,45),(255,255,255),2)
    cv2.line(image,(437,35),(427,45),(255,255,255),2)
    image[101:321,29:389]=sample()
    cv2.rectangle(image,(57,355),(138,399),(255,128,0),-1)
    return image


class GuidedTests(unittest.TestCase):
    def test_dom_guidance_limits_piece_location(self):
        r=detect(dialog(),guidance={'dom':{'piece':{'x':74,'y':186,'width':50,'height':50},
                                         'handle':{'x':57,'y':355,'width':82,'height':45}}})
        self.assertTrue(r['evidence']['dom_guided'])
        self.assertAlmostEqual(r['offset_image_px'][0],145,delta=3)
        self.assertLess(abs(r['piece_box'][0]-75),5)

    def test_bad_dom_geometry_fails_instead_of_guessing(self):
        with self.assertRaises(ValueError):
            piece_from_dom({'piece':{'x':5000,'y':20,'width':50,'height':50},
                            'handle':{'x':57,'y':355,'width':82,'height':45}},
                           {'status':'located','handle_box':[57,355,82,45]},[29,101,425,247])

    def test_overlapping_hypotheses_group_without_hiding_offset_disagreement(self):
        def candidate(x,w,offset,score):
            return {'gap_box':[x,100,w,w],'piece_box':[x-offset,100,w,w],
                    'offset_image_px':[offset,0],'outline_score':score}
        groups=group_candidates([candidate(180,50,111,.8),candidate(174,60,78,.79),candidate(300,50,220,.7)])
        self.assertEqual(len(groups),2)
        self.assertEqual(groups[0]['hypothesis_count'],2)
        self.assertEqual(groups[0]['offset_spread_px'],33)

    def test_sprite_transparency_and_padding(self):
        image=np.zeros((60,60,4),np.uint8)
        cv2.rectangle(image,(8,12),(47,51),(10,180,100,255),-1)
        cv2.circle(image,(28,12),7,(10,180,100,255),-1)
        encoded=base64.b64encode(cv2.imencode('.png',image)[1]).decode()
        mask,box=sprite_mask(encoded,[100,200,60,60])
        self.assertEqual(box,[108,205,40,47])
        self.assertEqual(mask.shape,(47,40))
        image[:,:,3]=255
        self.assertIsNone(sprite_mask(base64.b64encode(cv2.imencode('.png',image)[1]).decode(),[100,200,60,60]))

    def test_sprite_shape_is_matched_with_dom_guidance(self):
        sprite=np.zeros((50,50,4),np.uint8)
        cv2.rectangle(sprite,(1,9),(40,48),(50,180,50,255),-1)
        cv2.circle(sprite,(21,9),8,(50,180,50,255),-1)
        cv2.circle(sprite,(40,29),8,(50,180,50,255),-1)
        r=detect(dialog(),guidance={'dom':{'piece':{'x':74,'y':186,'width':50,'height':50},'handle':{'x':57,'y':355,'width':82,'height':45}},
                                   'sprite_png':base64.b64encode(cv2.imencode('.png',sprite)[1]).decode(),'sprite_status':'readable'})
        self.assertTrue(r['evidence']['sprite_silhouette'])
        self.assertTrue(any(h['method']=='sprite_silhouette' for c in r['candidates'] for h in c['hypotheses']))
        self.assertAlmostEqual(r['offset_image_px'][0],145,delta=3)

    def test_manual_points_have_explicit_provenance(self):
        r=detect(dialog(),guidance={'manual_points':[100,210,245,210]})
        self.assertEqual(r['status'],'manual')
        self.assertEqual(r['offset_image_px'],[145,0])
        self.assertIsNone(r['outline_score'])
        self.assertEqual(r['selection_source'],'user_points')
        self.assertGreater(render_annotation(dialog(),r).shape[0],480)
        with self.assertRaises(ValueError):
            detect(dialog(),guidance={'manual_points':[100,210,245,230]})


if __name__=='__main__':unittest.main()
