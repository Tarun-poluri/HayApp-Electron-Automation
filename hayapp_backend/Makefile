# Makefile
ifeq ($(OS), Windows_NT)
  SHELL := cmd.exe
endif

# Scripts location depends on OS
ifeq ($(OS), Windows_NT)
	VENV_ACTIVATE = venv\Scripts\activate
else
	VENV_ACTIVATE = venv/bin/activate
endif

VERSION := $(shell python hayapp_python\version.py)
BUILDNUM ?= 000

.PHONY: build venv install upgrade-requirements run clean clean-itrace fix lint test install-opencv list-vir-versions install-vir restart-vir kill-port-8080 install-needle-detector install-image-decoder



# pyinstaller --onefile --collect-all autobahn --hidden-import=twisted.internet.utils hayapp_python\hayapp_broker.py
build:
	@echo "Clean previous build"
	@for %%D in (dist build artifacts) do @if exist %%D rd /s /q %%D
	@echo "Installing pyinstaller"
	@call $(VENV_ACTIVATE) && pip install pyinstaller==6.18.0
	@echo "Creating HayApp Meta Data"
	@call $(VENV_ACTIVATE) && python3.11 -m scripts.create_version_meta
	@echo "Building using pyinstaller"
	@call $(VENV_ACTIVATE) && pyinstaller \
		--onedir \
		--noconfirm \
		--clean \
		--collect-all autobahn \
		--hidden-import=twisted.internet.utils \
		--add-data "venv\Lib\site-packages\parlay\server\config.json;parlay\server" \
		--name "HayAppBroker" \
		--version-file "version_meta.txt" \
		--icon "hayapp.ico" \
		hayapp_python\hayapp_broker.py
	@echo "Syncing assets using Robocopy..."
	@robocopy dist\HayAppBroker dist /E /MOVE /R:2 /W:5 > nul || if %errorlevel% leq 1 exit 0
	@robocopy needle_detector dist\needle_detector /E /R:2 /W:5 > nul || if %errorlevel% leq 1 exit 0
	@robocopy image_decoder dist\image_decoder /E /R:2 /W:5 > nul || if %errorlevel% leq 1 exit 0
	@robocopy local_user_data dist\local_user_data /E /R:2 /W:5 > nul || if %errorlevel% leq 1 exit 0
	@robocopy ParlayUI dist\ParlayUI /E /R:2 /W:5 > nul || if %errorlevel% leq 1 exit 0
	@robocopy stm32flash dist\stm32flash /E /R:2 /W:5 > nul || if %errorlevel% leq 1 exit 0
	@echo "Extracting latest VIR package to dist\vir..."
	@powershell -NoProfile -Command "$$latest = Get-ChildItem -Path 'vir' -Filter '*.zip' -File | Sort-Object Name | Select-Object -Last 1; if ($$null -eq $$latest) { Write-Host 'No VIR zip found in vir/. Skipping extraction.' } else { New-Item -ItemType Directory -Path 'dist\\vir' -Force | Out-Null; Expand-Archive -Path $$latest.FullName -DestinationPath 'dist\\vir' -Force; Write-Host ('Extracted ' + $$latest.Name + ' to dist\\vir') }"
	@echo "Creating Archive ..."
	@md artifacts
	@powershell -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'artifacts\HayAppBroker-$(VERSION)-build$(BUILDNUM).zip' -Force"
	@echo "Build Complete: artifacts\HayAppBroker-$(VERSION)-build$(BUILDNUM).zip"


# Build using nuitka
build-nuitka:
	@echo "Building using nuitka"
	@call $(VENV_ACTIVATE) && python3.11 -m nuitka \
		--standalone \
		--no-deployment-flag=self-execution \
		--nofollow-import-to=*.tests \
		--nofollow-import-to=*.test \
		--nofollow-import-to=twisted.trial \
		--nofollow-import-to=unittest \
		--nofollow-import-to=doctest \
		--include-package=twisted,zope,zope.interface,incremental,constantly \
		--include-package-data=autobahn \
		--force-stdout-spec=hayapp_broker.log \
		--force-stderr-spec=hayapp_broker.err \
		--main=hayapp_python\hayapp_broker.py
	@echo "Build Complete."

# Setup virtual environment
venv:
	@echo "Creating python 3.11 virtual environment..."
	@python3.11 -m venv venv
ifeq ($(OS), Windows_NT)
	@call $(VENV_ACTIVATE) && python3.11 -m pip install --upgrade pip
else
	@. $(VENV_ACTIVATE) && pip install --upgrade pip
endif

# Install application dependencies
install: venv
	@echo "Installing requirements..."
ifeq ($(OS), Windows_NT)
	@call $(VENV_ACTIVATE) && pip install -r requirements.txt
	@call $(VENV_ACTIVATE) && pip install -r requirements-dev.txt
	@call $(VENV_ACTIVATE) && python3.11 -m scripts.initial_setup
else
	@. $(VENV_ACTIVATE) && pip install -r requirements.txt
	@. $(VENV_ACTIVATE) && pip install -r requirements-dev.txt
	@. $(VENV_ACTIVATE) && python3.11 -m scripts.initial_setup
endif

# Install only application dependencies
install-prod: venv
	@echo "Installing requirements..."
ifeq ($(OS), Windows_NT)
	@call $(VENV_ACTIVATE) && pip install -r requirements.txt
else
	@. $(VENV_ACTIVATE) && pip install -r requirements.txt
endif

# Upgrade application dependencies
upgrade-requirements:
	@echo "Updating requirements..."
ifeq ($(OS), Windows_NT)
	@call $(VENV_ACTIVATE) && pip install --upgrade pip-tools && pip-compile --upgrade requirements.in
	@call $(VENV_ACTIVATE) && pip-compile requirements-dev.in --upgrade
else
	@. $(VENV_ACTIVATE) && pip install --upgrade pip-tools && pip-compile --upgrade requirements.in
	@. $(VENV_ACTIVATE) && pip-compile requirements-dev.in --upgrade
endif

# Run the application
run:
ifeq ($(OS), Windows_NT)
	@venv\Scripts\python3.11.exe -m hayapp_python.hayapp_broker
else
	@. $(VENV_ACTIVATE) && python -m hayapp_python.hayapp_broker
endif

# Remove the virutal environment
clean-itrace:
ifeq ($(OS), Windows_NT)
	@echo "Not Implemented: Removing iTrace C++ on windows"
else
	@echo "Removing iTrace C++ extension..."
	@$(MAKE) -C hayapp_python/iTrace clean
endif

# Remove the virutal environment
clean: clean-itrace
	@echo "Removing virtual environment..."
ifeq ($(OS), Windows_NT)
	@if exist venv rmdir /s /q venv
else
	@rm -rf venv
endif

# Auto format code and sort imports
fix:
ifeq ($(OS), Windows_NT)
	@call $(VENV_ACTIVATE) && isort . && black . --line-length=100
else
	@. $(VENV_ACTIVATE) && isort . && black . --line-length=100
endif


lint:
ifeq ($(OS), Windows_NT)
	@call $(VENV_ACTIVATE) && \
	echo. && echo === isort: import sorting === && \
	isort --check-only . && echo PASS && \
	echo. && echo === flake8: general linter === && \
	flake8 . && echo PASS && \
	echo. && echo === black: code formatter === && \
	black --check --line-length=100 . &&  echo PASS && \
	echo. && echo === bandit: security linter === && \
	bandit -r hayapp_python -x hayapp_python/tests,hayapp_python/venv &&  echo PASS && \
	echo. && echo ✅ PASSED ALL LINT CHECKS
else
	@. $(VENV_ACTIVATE); \
\
	echo -e "\n=== isort: import sorting ==="; \
	isort --check-only . && echo "PASS" || exit 1; \
\
	echo -e "\n=== flake8: general linter ==="; \
	flake8 . && echo "PASS" || exit 1; \
\
	echo -e "\n=== black: code formatter ==="; \
	black --check --line-length=100 . && echo "PASS" || exit 1; \
\
	echo -e "\n=== bandit: security linter ==="; \
	bandit -r hayapp_python -x hayapp_python/tests,hayapp_python/venv && echo "PASS" || exit 1; \
\
	echo -e "\n✅ PASSED ALL LINT CHECKS"
endif

test:
ifeq ($(OS), Windows_NT)
	@call $(VENV_ACTIVATE) && pytest --cov=hayapp_python --cov-config=tests/.coveragerc --cov-report xml:coverage.xml --cov-report term --junitxml tests.xml
else
	@. $(VENV_ACTIVATE) && pytest --cov=hayapp_python --cov-config=tests/.coveragerc --cov-report xml:coverage.xml --cov-report term --junitxml tests.xml
endif

# Restart vir.service
restart-vir:
ifeq ($(OS), Windows_NT)
	@echo "Checking for administrative privileges..."
	@powershell -Command "if (!(([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))) { exit 1 }" || (echo ERROR: Admin privileges required. && exit 1)
	@echo "Running vir\win-x64\Server\restart.service.bat..."
	@cd vir\win-x64\Server && restart.service.bat
else
	@echo "Checking vir.service status..."
	@if systemctl is-active --quiet vir.service; then \
		echo "vir.service is already running. Skipping restart."; \
		echo ""; \
		echo "Current status of vir.service:"; \
		systemctl status vir.service --no-pager; \
	else \
		echo "vir.service is not running. Starting service..."; \
		sudo systemctl restart vir.service; \
		echo ""; \
		echo "Waiting 10 seconds before checking status..."; \
		sleep 10; \
		echo "Status of vir.service:"; \
		systemctl status vir.service --no-pager; \
	fi
endif

restart-vir-force:
ifeq ($(OS), Windows_NT)
	@echo "Checking for administrative privileges..."
	@powershell -Command "if (!(([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))) { exit 1 }" || (echo ERROR: Admin privileges required. && exit 1)
	@echo "Running vir\win-x64\Server\restart.service.bat..."
	@cd vir\win-x64\Server && restart.service.bat
else
	@echo "Forcing restart of vir.service..."
	@sudo systemctl restart vir.service; \
	echo ""; \
	echo "Waiting 10 seconds before checking status..."; \
	sleep 10; \
	echo "Status of vir.service:"; \
	sudo systemctl status vir.service --no-pager;
endif

# List available VIR versions
list-vir-versions:
ifeq ($(OS), Windows_NT)
	@echo "Available VIR versions:"
	@dir /B vir\*.zip 2>nul || echo " No packages found in vir/"
else
	@echo "Available VIR versions:"
	@ls -1 vir/*.tgz 2>/dev/null | sed 's/.*x86_64-\([0-9.]*\)-.*/  \1/' | sort -V || echo "  No packages found in vir/"
endif

# Install VIR (Video Image Recognition) service from packaged tgz
# Usage: make install-vir [VIR_VERSION=x.x.x.xxx]
# If VERSION is not specified, installs the latest version found
install-vir:
ifeq ($(OS), Windows_NT)
	@echo "Checking for administrative privileges..."
	@powershell -Command "if (!(([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))) { \
		Write-Host 'ERROR: Administrative privileges required.' -ForegroundColor Red; \
		Write-Host 'Please use a Command Prompt or PowerShell with Admin privileges to run this installation.'; \
		exit 1 \
	}" || exit 1
# Use 'word 1' to pick the first file if multiple exist (sorted in reverse order)
	$(eval VIR_ZIP := $(word 1, $(shell dir /B vir\*.zip 2>nul | sort /R)))

	@echo "Installing VIR service..."
	@if not "$(VIR_VERSION)" == "" ( \
		echo ERROR: Specifying VERSION is not supported on Windows. & \
		exit 1 \
	) else if "$(VIR_ZIP)" == "" ( \
		echo ERROR: No .zip file found in vir/ directory & \
		exit 1 \
	) else ( \
		echo "Extracting $(VIR_ZIP) to vir..." & \
		powershell -Command "Expand-Archive -Path 'vir\$(VIR_ZIP)' -DestinationPath 'vir\' -Force" & \
		echo "Running install.bat from vir\win-x64\Server..." & \
		cd vir\win-x64\Server && install.bat & \
		echo VIR installation complete. \
	)
else
	@echo "Installing VIR service..."
	@if [ -n "$(VIR_VERSION)" ]; then \
		VIR_TGZ=$$(ls -1 vir/*-$(VIR_VERSION)-*.tgz 2>/dev/null | head -1); \
		if [ -z "$$VIR_TGZ" ]; then \
			echo "ERROR: No .tgz file found for version $(VIR_VERSION)"; \
			echo "Available versions:"; \
			ls -1 vir/*.tgz 2>/dev/null | sed 's/.*x86_64-\([0-9.]*\)-.*/  \1/' | sort -V; \
			exit 1; \
		fi; \
	else \
		VIR_TGZ=$$(ls -1 vir/*.tgz 2>/dev/null | sort -V -t'-' -k2 | tail -1); \
		if [ -z "$$VIR_TGZ" ]; then \
			echo "ERROR: No .tgz file found in vir/ directory"; \
			exit 1; \
		fi; \
	fi; \
	VERSION_NUM=$$(echo "$$VIR_TGZ" | sed 's/.*x86_64-\([0-9.]*\)-.*/\1/'); \
	echo "Installing version: $$VERSION_NUM"; \
	echo "Package: $$VIR_TGZ"; \
	\
	ORIG_DIR=$$(pwd); \
	TEMP_DIR=$$(mktemp -d); \
	echo "Extracting to $$TEMP_DIR..."; \
	tar -xzf "$$VIR_TGZ" -C "$$TEMP_DIR"; \
	\
	if [ -f "$$TEMP_DIR/build/install.sh" ]; then \
		echo "Running build/install.sh..."; \
		cd "$$TEMP_DIR/build" && sudo bash install.sh; \
		cd "$$ORIG_DIR"; \
	else \
		echo "ERROR: Could not find build/install.sh in package"; \
		rm -rf "$$TEMP_DIR"; \
		exit 1; \
	fi; \
	\
	rm -rf "$$TEMP_DIR"; \
	\
	echo "Copying Distortion Correction matrix data..."; \
	if [ -f "$$ORIG_DIR/vir/out_camera_data.json" ]; then \
		mkdir -p /opt/vir; \
		sudo cp "$$ORIG_DIR/vir/out_camera_data.json" /opt/vir/out_camera_data.json; \
		echo "Copied out_camera_data.json to /opt/vir/"; \
	else \
		echo "WARNING: vir/out_camera_data.json not found, skipping copy"; \
	fi; \
	\
	echo "VIR installation complete (version $$VERSION_NUM)."
endif

# Install needle detector library from extracted files under needle_detector/extracted/ directory
install-needle-detector:
ifeq ($(OS), Windows_NT)
	@echo "Needle detector installation is not needed on Windows."
else
	@echo "Installing Needle Detector library..." \
	# Find the tar.gz file in needle_detector directory \
	DETECTOR_TAR=$$(ls -1 needle_detector/*.tar.gz 2>/dev/null | head -1); \
	if [ -z "$$DETECTOR_TAR" ]; then \
		echo "ERROR: No .tar.gz file found in image_decoder/ directory"; \
		exit 1; \
	fi; \
	echo "Package: $$DETECTOR_TAR"; \
	\
	TEMP_DIR=$$(mktemp -d); \
	echo "Extracting to $$TEMP_DIR..."; \
	tar -xzf "$$DETECTOR_TAR" -C "$$TEMP_DIR"; \
	\
	# Copy library file to both general and needle detector \
	echo "Copying library files to /usr/local/lib..."; \
	# Copy to general lib folder in case other libraries need it \
	sudo cp $$TEMP_DIR/*.so /usr/local/lib/; \
	if [ ! -f "$$TEMP_DIR/libNeedleDetectorObjectInterfaceLib.so" ]; then \
		echo "ERROR: libNeedleDetectorObjectInterfaceLib.so not found in archive/"; \
		exit 1; \
	fi; \
	sudo cp "$$TEMP_DIR/libNeedleDetectorObjectInterfaceLib.so" ./needle_detector/; \
	\
	# Cleanup \
	echo "Cleaning up temporary files..."; \
	rm -rf "$$TEMP_DIR"; \
	\
	echo "Needle Detector installation complete."
endif

# Install image decoder library from .tar.gz under image_decoder/ directory
install-image-decoder:
ifeq ($(OS), Windows_NT)
	@echo "Image decoder installation is not needed on Windows."
else
	@echo "Installing Image Decoder library..."
	@# Detect architecture
	@arch=$$(uname -m); \
	if [ "$$arch" = "x86_64" ]; then \
		echo "x86_64 architecture detected"; \
		BUILD_TYPE="intel"; \
	elif [ "$$arch" = "armv7l" ] || [ "$$arch" = "aarch64" ]; then \
		echo "ARM architecture detected"; \
		BUILD_TYPE="arm"; \
	else \
		echo "Unknown architecture detected: $$arch"; \
		echo "Currently only x86_64 and ARM architectures are supported."; \
		exit 1; \
	fi; \
	\
	# Find the tar.gz file in image_decoder directory \
	DECODER_TAR=$$(ls -1 image_decoder/*.tar.gz 2>/dev/null | head -1); \
	if [ -z "$$DECODER_TAR" ]; then \
		echo "ERROR: No .tar.gz file found in image_decoder/ directory"; \
		exit 1; \
	fi; \
	echo "Package: $$DECODER_TAR"; \
	\
	TEMP_DIR=$$(mktemp -d); \
	echo "Extracting to $$TEMP_DIR..."; \
	tar -xzf "$$DECODER_TAR" -C "$$TEMP_DIR"; \
	\
	# Copy library files \
	echo "Copying library files to /usr/local/lib..."; \
	# Copy to general lib folder since detector needs some of the so files \
	sudo cp $$TEMP_DIR/*.so /usr/local/lib/; \
	if [ ! -f "$$TEMP_DIR/libitrace.decodeImage.intel.so" ]; then \
		echo "ERROR: libitrace.decodeImage.intel.so not found in archive/"; \
		exit 1; \
	fi; \
	sudo cp "$$TEMP_DIR/libitrace.decodeImage.intel.so" ./image_decoder/; \
	\
	# Copy header files needed for building our itrace wrapper \
	echo "Copying header files to /usr/local/include..."; \
	sudo cp -r $$TEMP_DIR/itrace /usr/local/include/; \
	sudo cp -r $$TEMP_DIR/nlohmann /usr/local/include/; \
    \
	# Cleanup \
	echo "Cleaning up temporary files..."; \
	rm -rf "$$TEMP_DIR"; \
	\
	echo "Image Decoder installation complete."
endif

# Kill process using port 8080
kill-port-8080:
ifeq ($(OS), Windows_NT)
	@echo "Checking for process using port 8080..."
	@powershell -Command "$$port = 8080; $$connection = Get-NetTCPConnection -LocalPort $$port -ErrorAction SilentlyContinue; if ($$connection) { $$pid = $$connection.OwningProcess; Write-Host \"Found process $$pid using port $$port. Killing it...\"; Stop-Process -Id $$pid -Force; Write-Host \"Process $$pid killed successfully.\" } else { Write-Host \"No process found using port $$port.\" }"
else
	@echo "Checking for process using port 8080..."
	@PID=$$(lsof -ti:8080 2>/dev/null) && \
	if [ -n "$$PID" ]; then \
		echo "Found process $$PID using port 8080. Killing it..."; \
		kill -9 $$PID && echo "Process $$PID killed successfully."; \
	else \
		echo "No process found using port 8080."; \
	fi
endif

# Configure AIO system
configure:
ifeq ($(OS), Windows_NT)
	@echo "Not supported on Windows."
else
	@echo "Configuring system..."
	@echo "Adding user to dialout group to allow serial port access..."
	@sudo usermod -a -G dialout $(USER)
	@echo "Disabling ambient light..."
	@gsettings set org.gnome.settings-daemon.plugins.power ambient-enabled false
	@echo "Disabling idle dimming..."
	@gsettings set org.gnome.settings-daemon.plugins.power idle-dim false
	@echo "Disabling automatic suspend"
	@gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
	@gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing'
	@echo "System configured."
endif