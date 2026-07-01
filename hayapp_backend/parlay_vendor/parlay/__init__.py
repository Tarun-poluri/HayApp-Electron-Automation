__version__ = '2.1.1'

# ignore all warnings for now. These messages cause confusion for users on a production system
import warnings
warnings.filterwarnings("ignore")

# twisted import
from twisted.internet.defer import Deferred, maybeDeferred
from twisted.python.failure import Failure
# Item Public API
from parlay.items.parlay_standard import ParlayCommandItem, ParlayProperty, parlay_command, ParlayDatastream
from parlay.protocols.local_item import local_item

# Script Public API
from .utils.parlay_script import ParlayScript

from .utils.reporting import log_stack_on_error

from .server.broker import Broker, DEFAULT_BROKER_CONFIG_FILE


# Broker public API
Modes = Broker.Modes
start = Broker.start
start_for_test = Broker.start_for_test
stop = Broker.stop
stop_for_test = Broker.stop_for_test


def open_protocol(protocol_name, **kwargs):
    """
    Sets up a protocol to be opened after the Broker initializes.

    This function has the same effect as opening a new protocol from the
    browser-based user interface.

    :param protocol_name: name of protocol class to call the open method
    :type protocol_name: str
    :param kwargs: keyword arguments to pass to the protocol's _open_ method
    :return: none


    **Example Usage**::

        from parlay import open_protocol, start
        open_protocol("ASCIILineProtocol", port="/dev/ttyUSB0", baudrate=57600)
        start()

    """
    result = log_stack_on_error(Deferred())  # actual result that will callback when it's opened

    def do_open_protocol():
        """
        Actually do the opening of the protocol once the broker is running
        :return:
        """
        # call the open protocol method and get its result as a deferred
        d = maybeDeferred(Broker.get_instance().open_protocol, protocol_name, kwargs)
        d.addCallback(lambda x: result.callback(x))
        d.addErrback(lambda error: Failure(Exception("Could not open Protocol")))
        #d.chainDeferred(result)  # call result with whatever our success or failure is

    Broker.call_on_start(do_open_protocol)
    return result


def install_config(path):
    """
    Install a config file to the parlay broker
    :param path: path to the config file
    :return:
    """
    with open(path) as infile:
        with open(BROKER_CONFIG_FILE, 'w') as outfile:
            # read 1KB at a time
            buf = infile.read(1024)
            while buf != "":
                outfile.write(buf)
                buf = infile.read(1024)


class WidgetsImpl(object):
    """
    Stub that will warn users that accidentally import or try to use widgets that it can only be used in the UI
    """

    def __getitem__(self, item):
        raise NotImplementedError("widgets can only be used from the Parlay UI")

    def __setitem__(self, key, value):
        raise NotImplementedError("widgets can only be used from the Parlay UI")

widgets = WidgetsImpl()
