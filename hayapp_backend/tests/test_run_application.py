import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from parlay import stop_for_test

from hayapp_python.hayapp_broker import start_broker


class TestHayappBroker(unittest.TestCase):
    @patch("hayapp_python.hayapp_broker.DetectorAdapter", new_callable=MagicMock)
    @patch("hayapp_python.hayapp_broker.DecoderAdapter", new_callable=MagicMock)
    @patch("hayapp_python.hayapp_broker.Camera", new_callable=MagicMock)
    @patch("hayapp_python.hayapp_broker.CloudStore", new_callable=MagicMock)
    def test_application_runs(self, mock_cloud, mock_camera, mock_decoder, mock_detector):
        mock_instance = mock_cloud.return_value
        mock_instance.update_needle_db = AsyncMock(return_value=True)
        mock_instance.update_suture_pack_images = AsyncMock(return_value=True)
        mock_instance.fetch_hayapp_users = AsyncMock(return_value=[])
        mock_instance.fetch_surgeons = AsyncMock(return_value=[])
        mock_instance.fetch_case_types = AsyncMock(return_value=[])
        mock_instance.fetch_suture_sheets = AsyncMock(return_value=[])
        mock_instance._check_connection = AsyncMock(return_value=None)
        mock_instance._upload = AsyncMock(return_value=None)
        # Command to start the application
        start_broker(for_test=True)
        stop_for_test()
