from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from hayapp_python.items.cloud_store import CloudStore

MODULE_PATH = "hayapp_python.items.cloud_store"


@pytest.mark.asyncio
async def test_check_connection_success():
    mock_response = AsyncMock()
    mock_response.is_success = True

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response

    store = CloudStore()
    store.client = mock_client

    await store._check_connection()

    assert store.is_online is True
    store.client.get.assert_awaited_once_with("health", timeout=1.0)


@pytest.mark.asyncio
async def test_check_connection_failure():
    mock_client = AsyncMock()
    mock_client.get.side_effect = httpx.RequestError("Error")

    store = CloudStore()
    store.client = mock_client

    await store._check_connection()

    assert store.is_online is False


@pytest.mark.asyncio
async def test_fetch_hayapp_users_success():
    expected_data = [{"name": "Alice"}]
    mock_response = AsyncMock()
    mock_response.is_success = True
    mock_response.json = MagicMock(return_value=expected_data)

    store = CloudStore()
    store.client = AsyncMock()
    store.client.get.return_value = mock_response

    result = await store.fetch_hayapp_users()
    assert result == expected_data


@pytest.mark.asyncio
async def test_fetch_hayapp_users_failure():
    mock_response = AsyncMock()
    mock_response.is_success = False
    mock_response.status_code = 500

    store = CloudStore()
    store.client = AsyncMock()
    store.client.get.return_value = mock_response

    result = await store.fetch_hayapp_users()
    assert result == []


@pytest.mark.asyncio
@patch(f"{MODULE_PATH}.calculate_md5", return_value="abc123")
@patch(f"{MODULE_PATH}.download_to_file", new_callable=AsyncMock)
async def test_update_needle_db_no_update(mock_download, mock_md5):
    mock_response = AsyncMock()
    mock_response.is_success = True
    mock_response.json = MagicMock(return_value={"etag": "abc123", "url": "http://fake.url"})

    store = CloudStore()
    store.client = AsyncMock()
    store.client.get.return_value = mock_response

    result = await store.update_needle_db()
    assert result is False
    mock_download.assert_not_awaited()


@pytest.mark.asyncio
@patch(f"{MODULE_PATH}.calculate_md5", return_value="abc123")
@patch(f"{MODULE_PATH}.download_to_file", new_callable=AsyncMock, return_value=True)
async def test_update_needle_db_downloads_when_mismatch(mock_download, mock_md5):
    mock_response = AsyncMock()
    mock_response.is_success = True
    mock_response.json = MagicMock(return_value={"etag": "xyz", "url": "http://fake.url"})

    store = CloudStore()
    store.client = AsyncMock()
    store.client.get.return_value = mock_response

    result = await store.update_needle_db()
    assert result is True
    mock_download.assert_awaited_once()


@pytest.mark.asyncio
@patch(f"{MODULE_PATH}.os.remove")
async def test_upload_file_success(mock_remove, tmp_path):
    test_file = tmp_path / "log.txt"
    test_file.write_text("log data")

    store = CloudStore()
    store.client = AsyncMock()
    store.client.request.return_value = AsyncMock(status_code=200)
    store.client.request.return_value.raise_for_status = lambda: None

    with patch.object(store, "_update_upload_db", new=AsyncMock()) as mock_update:
        await store.upload_log_file(test_file, timestamp="2025-01-01T00:00:00Z", case_id="case123")
        mock_update.assert_awaited()
        mock_remove.assert_called_once_with(test_file)


@pytest.mark.asyncio
@patch(f"{MODULE_PATH}.os.remove")
async def test_upload_file_failure(mock_remove, tmp_path):
    test_file = tmp_path / "log.txt"
    test_file.write_text("log data")

    store = CloudStore()
    store.client = AsyncMock()

    # Build fake request/response
    request = httpx.Request("PUT", "https://api.example.com/file")
    response = httpx.Response(404, request=request)
    error = httpx.HTTPStatusError("Not Found", request=request, response=response)
    store.client.request = AsyncMock(side_effect=error)

    with patch.object(store, "_update_upload_db", new=AsyncMock()) as mock_update:
        await store.upload_log_file(test_file, timestamp="2025-01-01T00:00:00Z", case_id="case123")
        mock_update.assert_awaited()
        # Get the item (arg of _update_upload_db) and verify it has the correct error
        args, kwargs = mock_update.call_args
        item = args[0]
        assert "404" in item.last_error
        assert "https://api.example.com/file" in item.last_error


@pytest.mark.asyncio
async def test_update_upload_db_success_removes():
    store = CloudStore()
    store.pending_uploads = MagicMock()
    mock_item = MagicMock()
    mock_item.last_error = None
    mock_item.id = "123"

    await store._update_upload_db(mock_item)
    store.pending_uploads.remove.assert_called_once()


@pytest.mark.asyncio
async def test_update_upload_db_error_upserts():
    store = CloudStore()
    store.pending_uploads = MagicMock()
    mock_item = MagicMock()
    mock_item.last_error = "Error"
    mock_item.id = "123"

    await store._update_upload_db(mock_item)
    store.pending_uploads.upsert.assert_called_once()
