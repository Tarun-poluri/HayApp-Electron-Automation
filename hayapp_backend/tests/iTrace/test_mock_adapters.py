"""
Tests for Mock iTrace Adapters

These tests verify that the mock decoder and detector adapters work correctly
for cross-platform development without requiring actual DLL libraries.
"""

import tempfile
from pathlib import Path

import pytest

from hayapp_python.common.config_manager import config
from hayapp_python.iTrace.decoder_adapter import MockDecoderAdapter
from hayapp_python.iTrace.detector_adapter import MockDetectorAdapter


class TestMockDecoderAdapter:
    """Tests for MockDecoderAdapter"""

    @pytest.fixture
    def mock_decoder(self):
        """Create a mock decoder adapter instance"""
        decoder = MockDecoderAdapter()
        return decoder

    @pytest.fixture
    def temp_image(self):
        """Create a temporary image file for testing"""
        with tempfile.NamedTemporaryFile(suffix=".bmp", delete=False) as f:
            f.write(b"fake image data")
            temp_path = f.name
        yield temp_path
        # Cleanup
        Path(temp_path).unlink(missing_ok=True)

    def test_initialization(self, mock_decoder):
        """Test that mock decoder initializes correctly"""
        assert mock_decoder.decode_enabled is True
        assert mock_decoder.decoded_mark_count == 0
        assert mock_decoder._decoder_interface is None

    def test_initialize_decoder(self, mock_decoder):
        """Test mock decoder initialization"""
        result = mock_decoder.initialize_decoder()
        assert result is True
        assert mock_decoder.decode_enabled is True

    def test_decode_needle_image(self, mock_decoder, temp_image):
        """Test decoding a needle image (not reference)"""
        result = mock_decoder.decode_mark(image=temp_image, check_empty=False)

        # Verify structure
        assert "serial" in result
        assert "results" in result
        assert "pix_per_mm" in result
        assert "is_success" in result

        # Verify needle image returns mock serial
        assert result["serial"] is not None
        assert "MOCK" in result["serial"]
        assert result["pix_per_mm"] is not None
        assert result["pix_per_mm"] > 0

    def test_decode_any_image(self, mock_decoder, temp_image):
        """Test decoding any image returns mock data"""
        result = mock_decoder.decode_mark(image=temp_image, check_empty=False)

        # All images should return mock serial (no filename-based detection)
        assert result["serial"] is not None
        assert "MOCK" in result["serial"]
        assert result["pix_per_mm"] is not None
        assert result["pix_per_mm"] > 0

    def test_decode_missing_image(self, mock_decoder):
        """Test decoding a non-existent image"""
        result = mock_decoder.decode_mark(image="/nonexistent/image.bmp", check_empty=False)

        # Should still return a result structure but with error
        assert "serial" in result
        assert "results" in result
        assert result["serial"] is None
        assert "error" in result["results"]

    def test_decoded_count_increments(self, mock_decoder, temp_image):
        """Test that decoded count increments correctly"""
        initial_count = mock_decoder.decoded_mark_count

        mock_decoder.decode_mark(image=temp_image, check_empty=False)
        assert mock_decoder.decoded_mark_count == initial_count + 1

        mock_decoder.decode_mark(image=temp_image, check_empty=False)
        assert mock_decoder.decoded_mark_count == initial_count + 2


class TestMockDetectorAdapter:
    """Tests for MockDetectorAdapter"""

    @pytest.fixture
    def mock_detector(self):
        """Create a mock detector adapter instance"""
        detector = MockDetectorAdapter()
        return detector

    @pytest.fixture
    def temp_image(self):
        """Create a temporary image file for testing"""
        with tempfile.NamedTemporaryFile(suffix=".bmp", delete=False) as f:
            f.write(b"fake image data")
            temp_path = f.name
        yield temp_path
        # Cleanup
        Path(temp_path).unlink(missing_ok=True)

    def test_initialization(self, mock_detector):
        """Test that mock detector initializes correctly"""
        assert mock_detector.detect_enabled is True
        assert mock_detector.analyzed_count == 0
        assert mock_detector._detector_interface is None

    def test_initialize_detector(self, mock_detector):
        """Test mock detector initialization"""
        result = mock_detector.initialize_detector()
        assert result is True
        assert mock_detector.detect_enabled is True

    def test_analyze_needle_image(self, mock_detector, temp_image):
        """Test analyzing a needle image (not reference)"""
        pix_per_mm = 24.5
        result = mock_detector.analyze_needle(image=temp_image, pix_per_mm=pix_per_mm)

        # Verify structure (with computed fields from Pydantic model)
        assert "meta" in result
        assert "mock_mode" in result
        assert result["mock_mode"] is True

        # Verify needle detection
        assert result["meta"]["number_of_objects_found"] == 1
        assert "results" in result  # This is a computed field
        assert len(result["results"]) == 1

        # Verify needle measurements exist
        needle_result = result["results"][0]
        assert "needle_length_mm" in needle_result
        assert "needle_radius_mm" in needle_result
        assert needle_result["needle_length_mm"] is not None
        assert needle_result["needle_decode_nResult"] == 0  # Success

    def test_analyze_any_needle_image(self, mock_detector, temp_image):
        """Test analyzing any needle image returns 1 needle"""
        pix_per_mm = 24.5
        result = mock_detector.analyze_needle(image=temp_image, pix_per_mm=pix_per_mm)

        # All images should return 1 needle (no filename-based detection)
        assert result["meta"]["number_of_objects_found"] == 1
        assert len(result["results"]) == 1

    def test_analyze_reference_image_method(self, mock_detector, temp_image):
        """Test the analyze_reference_image method"""
        pix_per_mm = 24.5
        result = mock_detector.analyze_reference_image(image=temp_image, pix_per_mm=pix_per_mm)

        # Verify structure
        assert "meta" in result
        assert result["meta"]["key"] == "ANALYZE_CHECK_EMPTY_RESULT"

        # Verify check empty result (checking raw or is_success from computed field)
        assert "is_success" in result or "raw" in result
        # The model has results in the raw.results structure
        if "raw" in result:
            check_result = result["raw"]["results"]
            assert "object_pixel_count" in check_result
            assert "object_to_image_ratio" in check_result

    def test_analyze_missing_image(self, mock_detector):
        """Test analyzing a non-existent image"""
        result = mock_detector.analyze_needle(image="/nonexistent/image.bmp", pix_per_mm=24.5)

        # Should still return a result structure
        assert "meta" in result
        # No needles found for missing image
        assert result["meta"]["number_of_objects_found"] == 0
        # Check for error_string computed field
        assert "error_string" in result or "results" in result

    def test_analyzed_count_increments(self, mock_detector, temp_image):
        """Test that analyzed count increments correctly"""
        initial_count = mock_detector.analyzed_count

        mock_detector.analyze_needle(image=temp_image, pix_per_mm=24.5)
        assert mock_detector.analyzed_count == initial_count + 1

        mock_detector.analyze_needle(image=temp_image, pix_per_mm=24.5)
        assert mock_detector.analyzed_count == initial_count + 2

    def test_set_reference_image(self, mock_detector, temp_image):
        """Test setting reference image (should not raise error)"""
        # This should complete without error
        mock_detector.set_reference_image(temp_image)


class TestConfigIntegration:
    """Test that config flags are properly loaded"""

    def test_config_has_mock_flags(self):
        """Test that config manager has the new mock flags"""
        assert hasattr(config.itrace, "use_mock_decoder")
        assert hasattr(config.itrace, "use_mock_detector")
        assert isinstance(config.itrace.use_mock_decoder, bool)
        assert isinstance(config.itrace.use_mock_detector, bool)
