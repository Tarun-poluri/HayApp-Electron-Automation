require "google/apis/drive_v3"
require "googleauth"
require "fileutils"

MAX_RETRIES = 5

# Improved retry logic: only retry on server errors or rate limits
def retryable
  retries = 0
  begin
    yield
  rescue Google::Apis::ServerError, Google::Apis::TransmissionError, Google::Apis::RateLimitError => e
    retries += 1
    if retries <= MAX_RETRIES
      sleep_time = 2**retries
      puts "Retrying (#{retries}/#{MAX_RETRIES}) after recoverable error: #{e.message}"
      sleep(sleep_time)
      retry
    else
      raise e
    end
  rescue StandardError => e
    # Don't retry logic errors, auth errors, or missing files
    puts "Non-recoverable error encountered: #{e.message}"
    raise e
  end
end

if ARGV.length < 2
  puts "Usage: ruby upload.rb <filename> <subfolder>"
  exit 1
end

file_name = ARGV[0]
subfolder = ARGV[1]
parent_id = ENV["GOOGLE_DRIVE_BUILD_FOLDER_ID"]
file_path = File.expand_path("./out/artifacts/#{file_name}")
keyfile   = "./scripts/google-drive-cicd-ac5b4a1bbf34.json"

if parent_id.to_s.strip.empty?
  puts "Error: GOOGLE_DRIVE_BUILD_FOLDER_ID is not set"
  exit 1
end

# Robustness Check: Ensure local file exists before talking to Google
unless File.exist?(file_path)
  puts "Error: Local file not found at #{file_path}"
  exit 1
end

drive = Google::Apis::DriveV3::DriveService.new
# Set a longer timeout for large build uploads
drive.client_options.open_timeout_sec = 20
drive.client_options.read_timeout_sec = 300 

drive.authorization = Google::Auth::ServiceAccountCredentials.make_creds(
  json_key_io: File.open(keyfile),
  scope: ["https://www.googleapis.com/auth/drive"]
)

def escape_drive_query_value(value)
  value.to_s.gsub("\\", "\\\\").gsub("'", "\\\\'")
end

def shared_drive_list_options(query)
  options = {
    q: query,
    supports_all_drives: true,
    include_items_from_all_drives: true,
    spaces: "drive",
    page_size: 1,
    fields: "files(id,name)",
    corpora: "allDrives"
  }

  options
end

# --- Subfolder Logic ---
puts "Ensuring subfolder '#{subfolder}' exists..."
escaped_subfolder = escape_drive_query_value(subfolder)
query = "name='#{escaped_subfolder}' and mimeType='application/vnd.google-apps.folder' and '#{parent_id}' in parents and trashed=false"
query_options = shared_drive_list_options(query)

folder = retryable { drive.list_files(**query_options).files.first }

unless folder
  begin
    folder = retryable do
      drive.create_file(
        { name: subfolder, mime_type: "application/vnd.google-apps.folder", parents: [parent_id] },
        supports_all_drives: true
      )
    end
  rescue Google::Apis::ClientError => e
    # Handle race condition: if another process created it just now, find it.
    folder = drive.list_files(**query_options).files.first
    raise "Could not find or create folder: #{e.message}" unless folder
  end
end

# --- Upload Logic ---
escaped_file_name = escape_drive_query_value(file_name)
file_query = "name='#{escaped_file_name}' and '#{folder.id}' in parents and trashed=false"
file_query_options = shared_drive_list_options(file_query)
existing = retryable { drive.list_files(**file_query_options).files.first }

upload_options = {
  upload_source: file_path,
  content_type: "application/octet-stream",
  supports_all_drives: true,
  options: { resumable: true } # Vital for larger build artifacts
}

if existing
  puts "Updating existing file: #{file_name} (ID: #{existing.id})"
  retryable { drive.update_file(existing.id, nil, **upload_options) }
else
  puts "Uploading new file: #{file_name}"
  metadata = { name: file_name, parents: [folder.id] }
  retryable { drive.create_file(metadata, **upload_options) }
end

puts "Success: #{file_name} is live on Google Drive."