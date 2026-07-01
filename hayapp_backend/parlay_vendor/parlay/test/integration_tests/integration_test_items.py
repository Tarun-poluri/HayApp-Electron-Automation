import sys
import time
import subprocess
import unittest
from argparse import ArgumentError
from os.path import abspath, dirname, join

from .utilities import IntegrationTestArgParser, get_open_ports
from .defs import *


LOCAL_ADDER_ID = "LocalAdder"
REMOTE_ADDER_ID = "RemoteAdder"
REMOTE_DISC_ADDER_ID = "RemoteDiscAdder"


def start_broker(http_port, https_port, websocket_port, secure_websocket_port):
    """
    This function is defines and instantiates local items, and starts the Parlay broker.
    :param http_port: TCP port to pass to parlay.start()
    :param https_port: TCP port to pass to parlay.start()
    :param websocket_port: TCP port to pass to parlay.start()
    :param secure_websocket_port: TCP port to pass to parlay.start()
    :return: None
    """

    from twisted.internet import defer
    from parlay import ParlayCommandItem, ParlayProperty, parlay_command, local_item, start
    from parlay.server.broker import run_in_thread

    @local_item()
    class LocalAdder(ParlayCommandItem):
        """
        Helper class to test custom commands
        """

        property_x = ParlayProperty(val_type=int)

        @parlay_command()
        def add(self, x, y):
            return x + y

        @parlay_command(_async=True)
        def add_async(self, x, y):
            return x + y

        @parlay_command()
        def set_property_x_to(self, x, delay):
            if delay > 0:
                self.sleep(delay)
            self.property_x = x

    @local_item()
    class RemoteAdder(ParlayCommandItem):

        @parlay_command()
        def add(self, x, y, item_id):
            cmd = self.send_parlay_command(item_id, "add", _timeout=2, x=x, y=y)
            return cmd.wait_for_complete()

        @parlay_command(_async=True)
        def add_async(self, x, y, item_id):
            cmd = self.send_parlay_command(item_id, "add", _timeout=2, x=x, y=y)
            result = yield cmd.wait_for_complete()
            defer.returnValue(result)

        @parlay_command(_async=True)
        def set_remote_property_x_to(self, item_id, value):
            cmd = self.send_parlay_command(item_id, "set_property_x_to", _timeout=2, x=value, delay=0)
            yield cmd.wait_for_complete()

    @local_item()
    class RemoteAdderWithDiscovery(ParlayCommandItem):

        def __init__(self, item_id, name, remote_id):
            self.discovered = False
            self.remote_id = remote_id
            ParlayCommandItem.__init__(self, item_id=item_id, name=name)

        @run_in_thread
        def _check_discovered(self):
            if not self.discovered:
                self.discover()
                self.remote_item = self.get_item_by_id(self.remote_id)
                self.discovered = True

        @parlay_command()
        def add(self, x, y):
            self._check_discovered()
            return self.remote_item.add(x, y)

        @parlay_command(_async=True)
        def add_async(self, x, y):
            yield self._check_discovered()
            result = yield self.remote_item.add(x, y)
            defer.returnValue(result)

    LocalAdder(LOCAL_ADDER_ID, LOCAL_ADDER_ID)
    RemoteAdder(REMOTE_ADDER_ID, REMOTE_ADDER_ID)
    RemoteAdderWithDiscovery(REMOTE_DISC_ADDER_ID, REMOTE_DISC_ADDER_ID, LOCAL_ADDER_ID)

    start(open_browser=False,
          http_port=http_port,
          https_port=https_port,
          websocket_port=websocket_port,
          secure_websocket_port=secure_websocket_port
          )


def run_script_all_local_item_tests(websocket_port):

    from parlay.scripts import setup, discover, get_item_by_id, shutdown_broker, sleep

    connected = False
    for _ in range(BROKER_SETUP_NUM_RETRIES):
        time.sleep(BROKER_SETUP_WAIT_TIME)
        try:
            setup(timeout=BROKER_SETUP_TIMEOUT_TIME, port=websocket_port)
            connected = True
        except RuntimeError as _:
            pass

    if not connected:
        raise RuntimeError("Can't connect to broker process")

    discover()

    local_adder = get_item_by_id(LOCAL_ADDER_ID)
    remote_adder = get_item_by_id(REMOTE_ADDER_ID)
    remote_adder_disc = get_item_by_id(REMOTE_DISC_ADDER_ID)

    # ### Test Local Commands ###
    result = local_adder.add(2, 3)
    assert result == 5

    result = local_adder.add_async(2, 3)
    assert result == 5

    # ### Test Remote Commands ###
    result = remote_adder.add(2, 3, LOCAL_ADDER_ID)
    assert result == 5

    result = remote_adder.add_async(2, 3, LOCAL_ADDER_ID)
    assert result == 5

    result = remote_adder_disc.add(2, 3)
    assert result == 5

    result = remote_adder_disc.add_async(2, 3)
    assert result == 5

    # ### Test Remote Properties ###
    remote_adder.set_remote_property_x_to(LOCAL_ADDER_ID, 7)
    assert local_adder.property_x == 7

    # ### Test Remote Streaming ###
    local_adder.property_x = 4
    assert local_adder.property_x == 4

    cmd = local_adder.send_parlay_command("set_property_x_to", x=10, delay=0.5)  # change after a delay
    new_val = local_adder.streams["property_x"].wait_for_value()
    cmd.wait_for_complete()
    assert new_val, 10
    assert local_adder.property_x == 10

    shutdown_broker()  # this should be called at the end of every test script
    sleep(0.5)  # ensure time for shutdown message to be sent


class LocalItemTests(unittest.TestCase):

    TEST_TIMEOUT_TIME = 90
    TEST_CHECK_LOOP_TIME = 0.5

    def setUp(self):
        self.script_process = None

        http_port, https_port, websocket_port, secure_websocket_port = get_open_ports(4)

        self.broker_process = subprocess.Popen(["python", __file__,
                                                "--role", "broker",
                                                "--http_port", str(http_port),
                                                "--https_port", str(https_port),
                                                "--websocket_port", str(websocket_port),
                                                "--secure_websocket_port", str(secure_websocket_port)],
                                               )
        self.websocket_port = websocket_port

    def tearDown(self):
        if self.broker_process is not None:
            self.broker_process.poll()
            if self.broker_process.returncode is None:
                self.broker_process.kill()

        if self.script_process is not None:
            self.script_process.poll()
            if self.script_process.returncode is None:
                self.script_process.kill()

    def _wait_verify_process_exits(self):
        duration = 0
        while True:
            time.sleep(self.TEST_CHECK_LOOP_TIME)
            self.script_process.poll()
            if self.script_process.returncode is not None:
                break
            duration += self.TEST_CHECK_LOOP_TIME
            if duration > self.TEST_TIMEOUT_TIME:
                raise RuntimeError("Integration test timed out")

        if self.script_process.returncode != 0:
            raise RuntimeError("Integration Test Failed")

        while True:
            time.sleep(self.TEST_CHECK_LOOP_TIME)
            self.broker_process.poll()
            if self.broker_process.returncode is not None:
                break
            duration += self.TEST_CHECK_LOOP_TIME
            if duration > self.TEST_TIMEOUT_TIME:
                raise RuntimeError("Broker did not quit as expected")

    def test_local_items(self):

        self.script_process = subprocess.Popen(["python", __file__,
                                                "--role", "script",
                                                "--websocket_port", str(self.websocket_port)])
        self._wait_verify_process_exits()


def add_top_level_to_sys_path():
    # Add top level Parlay directory to path
    #   This is necessary since sometimes this script is run as a subprocess
    sys.path.insert(1, abspath(join(dirname(__file__), "../../..")))


def main():
    parser = IntegrationTestArgParser()
    args = parser.parse_args()

    add_top_level_to_sys_path()

    if args.role == "control":
        unittest.main()

    elif args.role == "broker":
        start_broker(http_port=args.http_port,
                     https_port=args.https_port,
                     websocket_port=args.websocket_port,
                     secure_websocket_port=args.secure_websocket_port)

    elif args.role == "script":
        run_script_all_local_item_tests(websocket_port=args.websocket_port)

    else:
        raise ArgumentError("--role", "Must be one of 'control', 'start-broker', or 'script'")


if __name__ == "__main__":
    main()
