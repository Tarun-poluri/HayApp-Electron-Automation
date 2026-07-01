
from argparse import ArgumentParser


class IntegrationTestArgParser(ArgumentParser):
    """
    Every integration test should include this subclass of argument parser.
    """

    def __init__(self):
        ArgumentParser.__init__(self)
        self.add_argument("--http_port", type=int, default=16180)
        self.add_argument("--https_port", type=int, default=16181)
        self.add_argument("--websocket_port", type=int, default=16185)
        self.add_argument("--secure_websocket_port", type=int, default=16186)

        self.add_argument("--role", type=str, default="control",
                          help="one of three values: 'control', 'broker', 'script'")


def get_open_ports(num_ports):
    """
    Gets a set of random TCP port numbers that are currently available. There is a
    small possibility of a race condition when this function is used, as this
    function cannot guarantee that the provided port numbers are not stolen
    by some other process after this function exits before you can claim them.
    :param num_ports:  number of ports to find
    :return:  tuple of integer port numbers
    """
    import socket
    sockets = []
    ports = []

    for index in range(num_ports):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(("", 0))
        sockets.append(s)

    for s in sockets:
        ports.append(s.getsockname()[1])
        s.close()

    return tuple(ports)
