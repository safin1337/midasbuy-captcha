import unittest
from unittest.mock import Mock
from pathlib import Path

import cv2
import numpy as np

from detect import detect
from drag import execute, plan
from annotate import render_annotation
from geometry import enclosing_square, locate_slider, measure_alignment
from desktop import on_desktop


def sample(scale=1, distractor=False):
    rng = np.random.default_rng(31)
    image = rng.integers(170, 231, (220, 360, 3), dtype=np.uint8)
    mask = np.zeros((50, 50), np.uint8)
    cv2.rectangle(mask, (1, 9), (40, 48), 255, -1)
    cv2.circle(mask, (21, 9), 8, 255, -1)
    cv2.circle(mask, (40, 29), 8, 255, -1)
    for x, value in ((45, 155), (190, 55)):
        patch = image[85:135, x:x + 50]
        patch[mask > 0] = value
        if x == 45:
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(patch, contours, -1, (255, 255, 255), 2)
    if distractor:
        # A plain rectangle should not fit the tabbed piece as well.
        cv2.rectangle(image, (280, 30), (315, 65), (55, 55, 55), -1)
    if scale != 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
    return image


class DetectionTests(unittest.TestCase):
    def test_colored_teal_gap_regression_at_multiple_scales(self):
        path = Path(__file__).parent / "examples" / "regressions" / "teal-gap.png"
        source = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
        for scale, dx, dy in ((1, 0, 0), (1, 70, 40), (1.5, 35, 25)):
            with self.subTest(scale=scale, dx=dx):
                resized = cv2.resize(source, None, fx=scale, fy=scale)
                image = cv2.copyMakeBorder(resized, dy, 0, dx, 0, cv2.BORDER_CONSTANT, value=(20, 20, 20))
                result = detect(image)
                self.assertEqual(result["status"], "detected", result)
                self.assertEqual(result["segmentation_method"], "dark_color_fallback")
                np.testing.assert_allclose(result["gap_box"][:2], np.array([180, 240]) * scale + [dx, dy], atol=3)
                np.testing.assert_allclose(result["piece_box"][:2], np.array([69, 240]) * scale + [dx, dy], atol=3)
                self.assertAlmostEqual(result["offset_image_px"][0] / scale, 111, delta=3)

    def test_colored_gap_fallback_retains_original_confidence_gate(self):
        image = sample()
        # Replace the synthetic gap interior with a dark saturated teal; the
        # outline still needs to match the piece, regardless of its color.
        patch = image[85:135, 190:240]
        patch[np.all(patch == 55, axis=2)] = (55, 50, 2)
        result = detect(image)
        self.assertEqual(result["status"], "detected", result)
        self.assertEqual(result["segmentation_method"], "dark_color_fallback")
        self.assertGreaterEqual(result["outline_score"], .72)
        self.assertAlmostEqual(result["offset_image_px"][0], 145, delta=3)

    def test_detection_emits_square_boxes_and_matching_measurements(self):
        result = detect(sample())
        self.assertEqual(result["piece_box"][2:], result["gap_box"][2:])
        self.assertEqual(result["piece_box"][2], result["piece_box"][3])
        alignment = result["alignment"]
        self.assertEqual([alignment["horizontal_distance_px"], alignment["vertical_offset_px"]], result["offset_image_px"])
        self.assertEqual(list(alignment["piece_corners"]), list("ABCD"))
        self.assertEqual(list(alignment["gap_corners"]), list("1234"))

    def test_close_x_anchor_moves_and_scales_with_dialog(self):
        dialog = np.full((480, 485, 3), 245, np.uint8)
        cv2.rectangle(dialog, (29, 21), (453, 100), (255, 128, 0), -1)
        cv2.circle(dialog, (432, 40), 12, (255, 255, 255), 2)
        cv2.line(dialog, (427, 35), (437, 45), (255, 255, 255), 2)
        cv2.line(dialog, (437, 35), (427, 45), (255, 255, 255), 2)
        dialog[101:321, 29:389] = sample()
        baseline = detect(dialog)
        self.assertEqual(baseline["status"], "detected", baseline)
        np.testing.assert_allclose(baseline["anchor"]["center"], [432, 40], atol=2)
        for scale, dx, dy in ((1, 80, 50), (1.5, 35, 60)):
            with self.subTest(scale=scale):
                resized = cv2.resize(dialog, None, fx=scale, fy=scale)
                shifted = cv2.copyMakeBorder(resized, dy, 0, dx, 0, cv2.BORDER_CONSTANT, value=(245, 245, 245))
                result = detect(shifted)
                self.assertEqual(result["status"], "detected", result)
                np.testing.assert_allclose(result["anchor"]["center"], np.array([432, 40]) * scale + [dx, dy], atol=2)
                for key in ("relative_piece_box", "relative_gap_box"):
                    np.testing.assert_allclose(np.array(result[key]) / scale, baseline[key], atol=3)

    def test_offsets_at_multiple_sizes(self):
        for scale in (1, 1.5, 2):
            with self.subTest(scale=scale):
                result = detect(sample(scale))
                self.assertEqual(result["status"], "detected", result)
                self.assertAlmostEqual(result["offset_image_px"][0], 145 * scale, delta=3)
                self.assertLessEqual(abs(result["offset_image_px"][1]), 3)

    def test_region_coordinates_remain_relative_to_full_image(self):
        result = detect(sample(), (20, 20, 300, 180))
        self.assertEqual(result["status"], "detected", result)
        self.assertAlmostEqual(result["piece_box"][0], 46, delta=3)
        self.assertAlmostEqual(result["gap_box"][0], 191, delta=3)

    def test_plain_scene_abstains(self):
        self.assertEqual(detect(np.full((220, 360, 3), 220, np.uint8))["status"], "no_match")

    def test_invalid_region(self):
        with self.assertRaises(ValueError):
            detect(sample(), (0, 0, 9999, 100))

    def test_rectangle_distractor(self):
        result = detect(sample(distractor=True))
        self.assertEqual(result["status"], "detected", result)
        self.assertAlmostEqual(result["offset_image_px"][0], 145, delta=3)


class DragTests(unittest.TestCase):
    def test_secondary_monitor_with_negative_y_is_supported(self):
        monitors = [[0, 0, 1920, 1080], [2400, -928, 4800, 422]]
        pointer = Mock()
        execute({"start_screen_px": [3000, -500], "end_screen_px": [3135, -500]}, pointer, monitors=monitors)
        pointer.moveTo.assert_any_call(3135, -500, duration=1)
        pointer.mouseUp.assert_called_once()
        self.assertFalse(on_desktop([2200, -500], monitors))

    def test_destination_in_gap_between_monitors_is_rejected(self):
        pointer = Mock()
        with self.assertRaises(ValueError):
            execute({"start_screen_px": [1900, 100], "end_screen_px": [2000, 100]}, pointer,
                    monitors=[[0, 0, 1920, 1080], [2400, -928, 4800, 422]])
        pointer.mouseDown.assert_not_called()

    def test_drag_uses_horizontal_distance_and_checks_geometry(self):
        alignment = measure_alignment([10, 20, 50, 50], [110, 23, 50, 50])
        result = {"status": "detected", "offset_image_px": [100, 3], "alignment": alignment}
        self.assertEqual(plan(result, (100, 400), 1.5)["distance_screen_px"], 150)
        result["offset_image_px"] = [101, 3]
        with self.assertRaises(ValueError):
            plan(result, (100, 400), 1)

    def test_calibrated_plan(self):
        result = {"status": "detected", "offset_image_px": [137, 0]}
        self.assertEqual(plan(result, (100, 400), 2)["end_screen_px"], [374, 400])

    def test_uncertain_result_cannot_drag(self):
        with self.assertRaises(ValueError):
            plan({"status": "uncertain"}, (100, 400), 1)

    def test_mouse_is_released_on_movement_failure(self):
        pointer = Mock()
        pointer.onScreen.return_value = True
        pointer.moveTo.side_effect = [None, RuntimeError("movement failed")]
        with self.assertRaises(RuntimeError):
            execute({"start_screen_px": [100, 400], "end_screen_px": [237, 400]}, pointer, monitors=[[0, 0, 1920, 1080]])
        pointer.mouseUp.assert_called_once()


class GeometryTests(unittest.TestCase):
    def test_square_padding_and_all_four_correspondences(self):
        piece = enclosing_square([10, 20, 40, 50])
        gap = enclosing_square([110, 23, 40, 50])
        self.assertEqual(piece, [5, 20, 50, 50])
        result = measure_alignment(piece, gap, {"center": [432, 40]})
        self.assertEqual(result["piece_corners"], {"A": [5, 20], "B": [54, 20], "C": [54, 69], "D": [5, 69]})
        self.assertEqual(result["gap_corners"]["1"], [105, 23])
        self.assertEqual(result["relative_piece_corners"]["A"], [-427, -20])
        for pair in result["point_pairs"]:
            self.assertEqual(pair["offset_px"], [100, 3])
        self.assertAlmostEqual(result["center_distance_px"], 100.045, places=3)

    def test_mismatched_boxes_are_rejected(self):
        with self.assertRaises(ValueError):
            measure_alignment([10, 20, 40, 50], [110, 20, 50, 50])

    def test_slider_zero_excludes_blue_header(self):
        image = np.full((480, 485, 3), 240, np.uint8)
        cv2.rectangle(image, (29, 20), (454, 99), (255, 128, 0), -1)
        cv2.rectangle(image, (57, 354), (138, 398), (255, 128, 0), -1)
        slider = locate_slider(image, [29, 100, 425, 247])
        self.assertEqual(slider["status"], "located")
        self.assertEqual(slider["zero_center"], [97.5, 376])
        self.assertEqual(slider["zero_displacement_px"], 0)

    def test_ambiguous_slider_is_not_selected(self):
        image = np.full((480, 485, 3), 240, np.uint8)
        for x in (57, 200):
            cv2.rectangle(image, (x, 354), (x + 81, 398), (255, 128, 0), -1)
        self.assertEqual(locate_slider(image, [29, 100, 425, 247])["status"], "ambiguous")

    def test_annotation_keeps_image_origin_and_handles_no_match(self):
        image = np.full((220, 360, 3), 220, np.uint8)
        output = render_annotation(image, detect(image))
        np.testing.assert_array_equal(output[:220, :360], image)
        self.assertGreater(output.shape[0], image.shape[0])


if __name__ == "__main__":
    unittest.main()
