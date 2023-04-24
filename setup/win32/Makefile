include Makefile.version
include Makefile.python
include Makefile.servicename

ODOO_BUILD_DIR=/cygdrive/c/odoobuild
SERVER_DIRECTORY=$(ODOO_BUILD_DIR)/server
FILES_DIRECTORY=release

ISCC_ARGUMENTS=/Fodoo_setup_$(VERSION)

LAUNCH_INNO_SETUP=/cygdrive/c/tools/cygwin/iscc.exe $(ISCC_ARGUMENTS) setup.iss
WINPY64_DIR=$(ODOO_BUILD_DIR)/WinPy64/python-${PYTHON_VERSION}.amd64

default: allinone

clean: server_clean
	rm -rf $(FILES_DIRECTORY)/*.exe
	rm -rf *.exe

server_clean:
	rm -rf $(SERVER_DIRECTORY)/dist
	rm -rf $(SERVER_DIRECTORY)/build
	rm -rf $(SERVER_DIRECTORY)/win32/dist
	rm -rf $(SERVER_DIRECTORY)/win32/build
	rm -rf $(SERVER_DIRECTORY)/*.exe
	rm -rf $(SERVER_DIRECTORY)/.cyg*

allinone: server_clean
# 	need to install requirements-local-proxy.txt for local proxy install
	cp $(SERVER_DIRECTORY)/requirements.txt $(WINPY64_DIR)/
	cp requirements-local-proxy.txt $(WINPY64_DIR)/
	-(cd $(WINPY64_DIR) && ./python.exe -m pip install --upgrade pip)
	-(cd $(WINPY64_DIR) && cat requirements*.txt | while read PAC ; do Scripts/pip3.exe install "$${PAC%%#*}" ; done)
	-(cd $(WINPY64_DIR) && Scripts/pip3.exe list)
	rm $(WINPY64_DIR)/requirements.txt
	(cd $(SERVER_DIRECTORY)/setup/win32 && $(LAUNCH_INNO_SETUP))
	(cd $(SERVER_DIRECTORY)/setup/win32 && mkdir -p $(FILES_DIRECTORY))
	(cd $(ODOO_BUILD_DIR)/release && mv odoo_setup_*.exe $(SERVER_DIRECTORY)/setup/win32/$(FILES_DIRECTORY)/)
	(cd $(SERVER_DIRECTORY)/setup/win32/release && ls -lhatr)
	(cd $(SERVER_DIRECTORY)/setup/win32/$(FILES_DIRECTORY) && chmod 0766 odoo_setup_*.exe)
