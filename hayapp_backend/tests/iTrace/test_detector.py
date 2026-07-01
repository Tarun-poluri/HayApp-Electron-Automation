import os
import unittest

from hayapp_python.common.config_manager import config
from hayapp_python.iTrace.decoder_interface import DecoderInterface
from hayapp_python.iTrace.detector_interface import DetectorInterface


def is_detector_available():
    """Check if iTrace library is available by attempting to initialize the interfaces."""
    try:
        # Check if the interfaces can be initialized
        detector = DetectorInterface(
            needle_config_path=config.itrace.needle_detector_config_path,
            needle_detector_dll_path=config.itrace.needle_detector_dll_path,
        )
        decoder = DecoderInterface(
            mark_config_path=config.itrace.decoder_config_path,
            mark_decoder_dll_path=config.itrace.decoder_dll_path,
            auth_key_path=config.itrace.decoder_key_path,
            decode_flags=config.itrace.decoder_flags,
        )
        return detector.detect_enabled() and decoder.decode_enabled()
    except Exception:
        return False


# Skip all tests if iTrace library is not available
skip_bool = not is_detector_available()
skip_reason = "iTrace libraries not detected" if skip_bool else None


@unittest.skipIf(skip_bool, skip_reason)
class TestiTraceNeedleDetection(unittest.TestCase):

    # Get the directory where this test file is located (use absolute paths)
    test_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.abspath(os.path.join(test_dir, "images")) + os.path.sep
    reference_image = os.path.abspath(os.path.join(path, "HayStackFlatWhitePostDistortion.bmp"))

    @classmethod
    def setUpClass(cls):
        """Initialize interfaces only if tests are not skipped."""
        cls.decoder = DecoderInterface(
            mark_config_path=config.itrace.decoder_config_path,
            mark_decoder_dll_path=config.itrace.decoder_dll_path,
            auth_key_path=config.itrace.decoder_key_path,
            decode_flags=config.itrace.decoder_flags,
        )

        cls.detector = DetectorInterface(
            needle_detector_dll_path=config.itrace.needle_detector_dll_path,
            needle_config_path=config.itrace.needle_detector_config_path,
        )
        cls.detector.set_reference_image(cls.reference_image)

    def test_1_needle(self):
        image = self.path + "HayStackSingleNeedlePostDistortion.bmp"

        # First decode to get pix_per_mm
        decode_result = self.decoder.decode_mark(image)
        self.assertIsNotNone(decode_result.pix_per_mm)

        # Then analyze needle using pix_per_mm
        result = self.detector.analyze_needle(image, decode_result.pix_per_mm)
        self.assertEqual(result.response_type, "SINGLE_NEEDLE")
        self.assertEqual(result.needle_count, 1)
        self.assertEqual(result.object_count, 1)
        self.assertEqual(result.not_a_needle_count, 0)

    # TODO: Need to capture new image
    @unittest.skip("Need to capture new image")
    def test_2_needles(self):
        image = self.path + "HayStackDualNeedlePostDistortion.bmp"

        # First decode to get pix_per_mm
        decode_result = self.decoder.decode_mark(image)
        self.assertIsNotNone(decode_result.pix_per_mm)

        # Then analyze needle using pix_per_mm
        result = self.detector.analyze_needle(image, decode_result.pix_per_mm)
        self.assertEqual(result.response_type, "MULTIPLE_NEEDLES")
        self.assertEqual(result.needle_count, 2)
        self.assertEqual(result.object_count, 2)
        self.assertEqual(result.not_a_needle_count, 0)

    def test_empty(self):
        image = self.path + "HayStackFlatWhitePostDistortion.bmp"

        # First decode to get pix_per_mm
        decode_result = self.decoder.decode_mark(image)
        self.assertIsNotNone(decode_result.pix_per_mm)

        # Then analyze needle using pix_per_mm
        result = self.detector.analyze_needle(image, decode_result.pix_per_mm)
        self.assertEqual(result.response_type, "NO_OBJECTS")
        self.assertEqual(result.object_count, 0)
        self.assertEqual(result.not_a_needle_count, 0)
        self.assertEqual(result.needle_count, 0)

    @unittest.skip("Need to capture new image")
    def test_not_a_needle(self):
        image = self.path + "HayStackBladePostDistortion.bmp"

        # First decode to get pix_per_mm
        decode_result = self.decoder.decode_mark(image)
        self.assertIsNotNone(decode_result.pix_per_mm)

        # Then analyze - should detect an object but with error about it not being a needle
        result = self.detector.analyze_needle(image, decode_result.pix_per_mm)
        self.assertEqual(result.response_type, "SINGLE_SHARP")
        self.assertEqual(result.object_count, 1)
        self.assertEqual(result.needle_count, 0)
        self.assertEqual(result.not_a_needle_count, 1)

    def test_haystack_paperclip_image(self):
        image = self.path + "HayStackPaperclipPostDistortion.bmp"
        decode_result = self.decoder.decode_mark(image)
        self.assertIsNotNone(decode_result.pix_per_mm)

        result = self.detector.analyze_needle(image, decode_result.pix_per_mm)
        self.assertEqual(result.response_type, "SINGLE_SHARP")
        self.assertEqual(result.needle_count, 0)
        self.assertEqual(result.object_count, 1)
        # self.assertEqual(result.not_a_needle_count, 1)

    def test_reference_image_not_empty(self):
        image = self.path + "HayStackSingleNeedlePostDistortion.bmp"
        decode_result = self.decoder.decode_mark(image)
        self.assertIsNotNone(decode_result.pix_per_mm)

        result = self.detector.analyze_reference_image(image, decode_result.pix_per_mm)
        self.assertEqual(result.is_success, False)

    def test_reference_image_empty(self):
        image = self.path + "HayStackFlatWhitePostDistortion.bmp"
        decode_result = self.decoder.decode_mark(image)
        self.assertIsNotNone(decode_result.pix_per_mm)

        result = self.detector.analyze_reference_image(image, decode_result.pix_per_mm)
        self.assertEqual(result.is_success, True)
