from collections import namedtuple
import json
ProtocolInfo = namedtuple("Protocol", ["name", "arguments"])

class ConfigurationManager(object):
    """
    This object parses a config file and manages the different install options
    """

    def __init__(self, config_file_path):
        self._config_file = config_file_path

        # fill with defaults
        self.version_prefix = ""
        self.protocols = []  # List[Protocol]
        self.config_dict = {}  # default
        try:
            with open(self._config_file) as fi:
                j = json.loads(fi.read())
                self.config_dict = j
                self.version_prefix = j.get("version_prefix", self.version_prefix)
                self.protocols = [ProtocolInfo(**x) for x in j.get("protocols", [])]

        # eat and log all exceptions since we don't want to crash here
        except Exception as e:
            print(("Could not load configuration file " + str(e)))










