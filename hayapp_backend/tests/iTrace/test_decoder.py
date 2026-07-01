import os
import unittest

from hayapp_python.common.config_manager import config
from hayapp_python.iTrace.decoder_interface import DecoderInterface


# Check if iTrace library is available
def is_decoder_available():
    """Check if iTrace library is available by attempting to initialize the interfaces."""
    try:
        # Check if the interfaces can be initialized
        decoder = DecoderInterface(
            mark_config_path=config.itrace.decoder_config_path,
            mark_decoder_dll_path=config.itrace.decoder_dll_path,
            auth_key_path=config.itrace.decoder_key_path,
            decode_flags=config.itrace.decoder_flags,
        )
        return decoder.decode_enabled()
    except Exception:
        return False


skip_bool = not is_decoder_available()
skip_reason = "iTrace library not detected" if skip_bool else None


@unittest.skipIf(skip_bool, skip_reason)
class TestiTraceMarkDecoding(unittest.TestCase):

    # Get the directory where this test file is located (use absolute paths)
    test_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.abspath(os.path.join(test_dir, "images")) + os.path.sep

    @classmethod
    def setUpClass(cls):
        """Initialize interfaces only if tests are not skipped."""
        cls.decoder = DecoderInterface(
            mark_config_path=config.itrace.decoder_config_path,
            mark_decoder_dll_path=config.itrace.decoder_dll_path,
            auth_key_path=config.itrace.decoder_key_path,
            decode_flags=config.itrace.decoder_flags,
        )

    def test_post_distortion_mark(self):
        image = self.path + "HayStackSingleNeedlePostDistortion.bmp"
        result = self.decoder.decode_mark(image)
        self.assertTrue(result.is_success)
        self.assertIsNotNone(result.pix_per_mm)
        self.assertEqual(result.serial, "1000010314403")

    def test_get_version(self):
        version = self.decoder.get_version()
        self.assertIsNotNone(version)
        self.assertEqual(version, "1.2.0.081")
