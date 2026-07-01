import functools
import itertools
import json
import logging
import os
import signal
import socket
import sys
import twisted.internet.error
from autobahn.twisted.websocket import WebSocketServerFactory, listenWS
from twisted.internet import defer
from parlay.server.adapter import Adapter
from twisted.python.log import addObserver
from twisted.web import static

import os
import signal
import functools
import parlay
import logging
from parlay.server import advertiser
from parlay.server import config_manager
import twisted.internet.error
from parlay.server.adapter import PyAdapter
from parlay.server.http_server import CacheControlledSite
from parlay.server.reactor import reactor


# path to the root parlay folder
PARLAY_PATH = os.path.dirname(os.path.realpath(__file__)) + "/.."
BROKER_DIR = os.path.dirname(os.path.realpath(__file__))
DEFAULT_BROKER_CONFIG_FILE = BROKER_DIR + "/config.json"

BROKER_VERSION = "v"+str(parlay.__version__)
portErr = 80


class Broker(object):
    """
    The Broker is the sole holder of global state. There should be only one.
    It also coordinates all communication between protocols.
    """
    instance = None
    _started = defer.Deferred()
    _stopped = defer.Deferred()

    class Modes:
        """
        These are the modes that the broker can run in.
        * Development mode is purposefully easy to use an insecure to allow logging and
        easy control of the parlay system
        * Production mode is locked down and *more* secure (Security should always be
        validated independently)
        """
        DEVELOPMENT = "DEVELOPER_MODE"
        PRODUCTION = "PRODUCTION_MODE"

        def __init__(self):
            raise BaseException("Broker.Modes should never be instantiated.  It is only for enumeration.")

    def __init__(self, reactor):
        assert(Broker.instance is None)

        self.config_file = DEFAULT_BROKER_CONFIG_FILE

        # :type parlay.server.reactor.ReactorWrapper
        self.reactor = reactor

        # the one python adapter for this Broker's python environment
        self.pyadapter = PyAdapter(broker=self)

        # set the default adapter for items to our pyadapter
        #  (unless it has already been customized)
        if Adapter.DEFAULT_ADAPTER is None:
            Adapter.DEFAULT_ADAPTER = self.pyadapter

        # all of the attached adapters
        self.adapters = [self.pyadapter]

        # the currently connected protocols
        self._protocols = []

        # The listeners that will be called whenever a message is received
        self._listeners = {}  # See Listener lookup document for more info

        # the broker is a singleton
        Broker.instance = self

        logging.basicConfig(format='%(asctime)s.%(msecs)03d  %(message)s', datefmt='%m/%d/%Y %H:%M:%S')
        self._logger = logging.getLogger(__name__)  # use this as the logger

    @staticmethod
    def get_instance():
        """
        @rtype Broker
        """
        if Broker.instance is None:
            Broker.instance = Broker(reactor)

        return Broker.instance

    @staticmethod
    def start(mode=Modes.DEVELOPMENT, ssl_only=False, open_browser=True, http_port=16180, https_port=16181,
              websocket_port=16185, secure_websocket_port=16186, ui_path=None, log_level=logging.DEBUG, ui_caching=False,
              config_file=DEFAULT_BROKER_CONFIG_FILE, default_ip="127.0.0.1"):
        """
        Run the default Broker implementation.
        This call will not return.
        """
        broker = Broker.get_instance()
        # do some construction stuff here
        broker.websocket_port = websocket_port
        broker.http_port = http_port
        broker.https_port = https_port
        broker.secure_websocket_port = secure_websocket_port
        broker._run_mode = Broker.Modes.PRODUCTION  # safest default
        broker.config_file = config_file

        # the broker config loaded from file
        broker.config = config_manager.ConfigurationManager(broker.config_file)

        # discovery info for the broker
        broker._discovery = {'TEMPLATE': 'Broker', 'NAME': 'Broker', "ID": "__Broker__",
                             "VERSION": str(broker.config.version_prefix) + BROKER_VERSION,
                             "interfaces": ['broker'],
                             "CHILDREN": []}

        for p in broker.config.protocols:
            Broker.call_on_start(lambda: broker.open_protocol(p.name, p.arguments))

        if log_level is not None:
            broker._logger.setLevel(log_level)
            # This needs to be included here due to scripting imports.
            from parlay.utils.twisted_log_observer import LevelFileLogObserver
            logger = LevelFileLogObserver(level=logging.ERROR)
            addObserver(logger.emit)

        return broker.run(mode=mode, ssl_only=ssl_only, open_browser=open_browser,
                          ui_path=ui_path, ui_caching=ui_caching, default_ip=default_ip)


    @staticmethod
    def start_for_test():
        broker = Broker.get_instance()
        broker.reactor.callWhenRunning(broker._started.callback, None)

    @staticmethod
    def stop():
        if Broker.instance is not None:
            Broker.get_instance().cleanup()

    @staticmethod
    def stop_for_test():
        Broker.get_instance().cleanup(stop_reactor=False)

    def publish(self, msg, write_method=None):
        """
        Publish a message to the Parlay system
        :param msg : The message to publish
        :param write_method : the protocol's method to callback if the broker needs to send a response
        :type msg : dict
        """
        self._logger.debug(msg)

        if write_method is None:
            write_method = lambda _: _

        topic_type = msg['TOPICS'].get('type', None)
        # handle broker and subscribe messages special
        if topic_type == 'broker':
            self.handle_broker_message(msg, write_method)
        elif topic_type == 'subscribe':
            self.handle_subscribe_message(msg, write_method)
        elif topic_type == 'unsubscribe':
            self.handle_unsubscribe_message(msg, write_method)
        # generic publish for all other messages
        else:
            self._publish(msg)

    def _publish(self, msg, root_list=None):
        """
        Call all of the listeners that match msg

        Time Complexity is O(2*n) * O(k)
        where:  n = the number of levels of the listener list
                k = the number of keys in the msg
        """
        if root_list is None:
            root_list = self._listeners

        # call any functions in the None key
        for func, owner in root_list.get(None, []):
            try:
                func(msg)
            except Exception as e:
                print("UNCAUGHT EXCEPTION IN PROTOCOL")
                print(e)
                print(("Function: " + str(func)))

        TOPICS = msg['TOPICS']
        # for each key in the listeners list
        for k in list(TOPICS.keys()):
            # If the key exists and  values match, then call any functions or look further
            #   root_list[k] is the value, which is a key to another dictionary
            #   The None key in that dictionary will contain a list of funcs to call
            #   Any other key will lead to yet another dictionary of keys and values
            if k in root_list and TOPICS[k] in root_list[k]:
                # recurse
                self._publish(msg, root_list[k][TOPICS[k]])

    def subscribe(self, func, _owner_=None, **kwargs):
        """
        Register a listener. The kwargs is a dictionary of args that **all** must be true
        to call this listener. You may register the same function multiple times with different
        kwargs, and it may be called multiple times for each message.
        @param func: The function to run
        @param kwargs: The key/value pairs to listen for
        """
        # only bound methods (or explicit owners) are allowed to subscribe so they are easier to clean up later
        if _owner_ is None:
            if hasattr(func, '__self__') and func.__self__ is not None:
                owner = func.__self__
            else:
                raise ValueError("Function {} passed to subscribe_listener() ".format(func.__name__) +
                                 "must be a bound method of an object")
        else:
            owner = _owner_

        # sort so we always get the same order
        keys = sorted(kwargs.keys())
        root_list = self._listeners
        for k in keys:
            v = kwargs[k]

            if k not in root_list:
                root_list[k] = {}
            if v not in root_list[k]:
                root_list[k][v] = {}
            # go down a level
            root_list = root_list[k][v]

        # now that we're done, we have the leaf in root_list. Append it to the None list
        listeners = root_list.get(None, set())
        listeners.add((func, owner))
        root_list[None] = listeners

    def unsubscribe(self, owner, TOPICS):
        """
        Unsubscribe owner from all subscriptions that match TOPICS. Only EXACT matches will be unsubscribed
        """

        keys = sorted(TOPICS.keys())
        root_list = self._listeners

        # go down the trie
        for k in keys:
            v = TOPICS[k]

            if k not in root_list:
                return  # not subscribed
            if v not in root_list[k]:
                return  # not subscribed
            # go down a level
            root_list = root_list[k][v]

        # now that we're done, that means that we are subscribed and we have the leaf in root_list
        listeners = root_list.get(None, set())

        # filter out any subscriptions by 'owner'
        root_list[None] = set([x for x in listeners if x[1] != owner])

    def _clean_trie(self, root_list=None):
        """
        Internal method called to clean out the trie from subscription keys that no longer have any subscriptions
        :param root_list : sub-trie to clean, or None for root of trie
        :result : number of subscriptions in the sub-trie
        """

        # base case
        if root_list is None:
            root_list = self._listeners

        # total subscriptions in this subtrie
        total_sub = 0
        for k in list(root_list.keys()):
            if k is not None:  # skip the special NONE key (that's used for callback list)
                for v in list(root_list[k].keys()):
                    num_sub = self._clean_trie(root_list[k][v])
                    # remove a sub-trie if it doesn't have any subscriptions in it
                    if num_sub == 0:
                        del root_list[k][v]
                    else:  # our total_sub is the sum of our subtries + any subscriptions at our level
                        total_sub += num_sub

            # delete the k if there are no v under it
            if len(root_list[k]) == 0:
                del root_list[k]

        # add subscriptions ar our level
        total_sub += len(root_list.get(None, set()))

        return total_sub

    def unsubscribe_all(self, owner, root_list=None):
        """
        Unsubscribe all function in our list that have a n owner that matches 'owner'
        """
        if root_list is None:
            root_list = self._listeners

        if None in root_list:  # don't bother checking if there's no listeners here
            root_list[None] = set([x for x in root_list[None] if x[1] != owner])

        for k in root_list:
            if k is not None:  # special key for listener list
                for v in root_list[k]:
                    # call it again
                    self.unsubscribe_all(owner, root_list[k][v])

    @classmethod
    def call_on_start(cls, func):
        """
        Call the supplied function when the broker starts OR if the broker has already started, call ASAP
        """

        if cls._started.called:
            # make sure its run in the broker
            @run_in_broker
            def inner():
                # already started, queue it up in the reactor
                return defer.maybeDeferred(func)

            return inner()
        else:
            # need a lambda to eat any results from the previous callback in the chain
            cls._started.addBoth(lambda *args: func())
            return cls._started

    @classmethod
    def call_on_stop(cls, func):
        """
        Call the supplied function when the broker stops OR if the broker has already stopped, call ASAP
        """

        if cls._stopped.called:
            # already started, queue it up in the reactor
            func()
        else:
            # need a lambda to eat any results from the previous callback in the chain
            cls._stopped.addBoth(lambda *args: func())

    def open_protocol(self, protocol_name, open_params):
        """
        Open a protocol with the given name and parameters (only run this once the Broker has started running
        """

        for adapter in self.adapters:
            try:
                return adapter.open_protocol(protocol_name, open_params)
            except LookupError as e:
                # could not find in this adapter, continue
                continue

        # if we get this far, it means we couldn't find it
        message = "Could not find a protocol in any adapter with name:  " + str(protocol_name)
        message += "\n\n  If this protocol is defined in python, you may need to import it, like so:"
        message += "\n    from  some.python.module import " + str(protocol_name)
        raise LookupError(message)

    def handle_broker_message(self, msg, message_callback):
        """
        Any message with topic type 'broker' should be passed into here.  'broker' messages are special messages
        that don't get 'published'. They are for querying the state of the system.
        'broker' messages have a 'request' field and will reply with an appropriate 'response' field

        message_callback is the function to call to send the message back to the protocol
        """
        if msg['TOPICS']['type'] != "broker":
            raise KeyError("handle_broker_message can only handle messages with 'TOPICS''type' == 'broker'")

        try:
            request = msg['TOPICS']['request']
        except KeyError as _:
            print(("BAD BROKER MESSAGE. NO REQUEST! == ", msg))
            return

        reply = {'TOPICS': {'type': 'broker', 'response': request + "_response"},
                 'CONTENTS': {'status': "STATUS NOT FILLED IN"}}

        if request == 'get_protocols':
            d = defer.DeferredList([defer.maybeDeferred(x.get_protocols) for x in self.adapters])

            def protocols_done(protocol_list):
                protocols = {}
                for x in protocol_list:
                    protocols.update(x[1])  # ignore x[0] which is done or not done

                reply['CONTENTS'] = protocols
                message_callback(reply)

            d.addCallback(protocols_done)

        elif request == 'open_protocol':
            protocol_name = msg['CONTENTS']['protocol_name']
            open_params = msg['CONTENTS'].get('params', {})
            try:
                d = self.open_protocol(protocol_name, open_params)

                # attach callbacks to open deferred
                def finished_open(_p):
                    """We've finished opening the protocol"""
                    reply['CONTENTS'] = {'name': str(_p), 'STATUS': 'ok'}
                    message_callback(reply)

                d.addCallback(finished_open)

                def error_opening(_e):
                    """ OOPS error while opening"""
                    # print to std_err
                    try:
                        _e.printTraceback()
                    except Exception as _:
                        print((str(_e)))

                    reply['CONTENTS'] = {'STATUS': "Error while opening: " + str(_e)}
                    message_callback(reply)

                d.addErrback(error_opening)

            # could not find protocol name
            except LookupError as _:
                reply['TOPICS']['response'] = 'error'
                reply['CONTENTS'] = {'error': "Unknown protocol name: " + str(protocol_name)}
                message_callback(reply)  # send right away

        elif request == 'get_open_protocols':
            # respond with the string repr of each protocol
            try:
                protocols = defer.DeferredList([defer.maybeDeferred(x.get_open_protocols) for x in self.adapters])

                def protocols_done(protocol_results):
                    flat_protocol_list = []  # flatten all of the lists into a single protocol list
                    for x in protocol_results:
                        flat_protocol_list.extend(x[1])

                    reply['CONTENTS']['protocols'] = [{"name": str(x),
                                                       "protocol_type": getattr(x, "_protocol_type_name", "UNKNOWN")}
                                                      for x in flat_protocol_list]
                    reply['CONTENTS']['status'] = 'ok'
                    message_callback(reply)

                protocols.addCallback(protocols_done)

            except Exception as e:
                reply['CONTENTS']['status'] = 'Error while listing protocols: ' + str(e)
                message_callback(reply)

        elif request == 'close_protocol':

            new_protocol_list = []
            to_close = msg["CONTENTS"]["protocol"]

            for adapter in self.adapters:
                protocols = adapter.get_open_protocols()

                try:
                    for x in protocols:
                        if str(x) == to_close:
                            adapter.untrack_open_protocol(x)
                            x.close()

                        else:
                            new_protocol_list.append(x)

                except NotImplementedError as _:
                    reply['CONTENTS'][
                        'STATUS'] = "Error while closing protocol. Protocol does not define close() method"
                    message_callback(reply)

                except Exception as e:
                    reply['CONTENTS']['STATUS'] = "Error while closing protocol " + str(e)
                    message_callback(reply)

                else:
                    reply['CONTENTS']['STATUS'] = 'ok'
                    message_callback(reply)

            # recalc list
            reply['CONTENTS']['protocols'] = [str(x) for x in new_protocol_list]
            reply['CONTENTS']['STATUS'] = "ok"
            message_callback(reply)

        elif request == "get_discovery":
            # if we're forcing a refresh, clear our whole cache
            force = msg['CONTENTS'].get('force', False)

            all_d = defer.DeferredList([defer.maybeDeferred(x.discover, force=force) for x in self.adapters],
                                       fireOnOneErrback=True, consumeErrors=False)

            def discovery_done(adapters_discovery):
                discovery = []
                for x in adapters_discovery:
                    if x[0] and len(x[1]) > 0:  # sanity checks
                        discovery.extend(x[1])

                # append the discovery for the broker
                discovery.append(self._discovery)

                reply['CONTENTS']['status'] = 'ok'
                reply['CONTENTS']['discovery'] = discovery
                message_callback(reply)

                # announce it to the world
                reply['TOPICS']['type'] = 'DISCOVERY_BROADCAST'
                self.publish(reply, lambda _: _)

            def discovery_error(*adapters_discovery):
                # only show the error messages
                reply['CONTENTS']['status'] = str(adapters_discovery)
                reply['CONTENTS']['discovery'] = []
                message_callback(reply)

            all_d.addCallback(discovery_done)
            all_d.addErrback(discovery_error)

        elif request == 'verify_broker_comms':
            reply["CONTENTS"]['status'] = "ok"
            message_callback(reply)

        elif request == "shutdown":
            reply["CONTENTS"]['status'] = "ok"
            message_callback(reply)
            # give some time for the message to propagate, and the even queue to clean
            self.reactor.callLater(0.1, self.cleanup)

        elif request == "get_config":
            reply["CONTENTS"] = self.config.config_dict
            message_callback(reply)

    def handle_subscribe_message(self, msg, message_callback):
        self.subscribe(message_callback, **(msg['CONTENTS']['TOPICS']))
        resp_msg = msg.copy()
        resp_msg['TOPICS']['type'] = 'subscribe_response'
        resp_msg['CONTENTS']['status'] = 'ok'

        # send the reply
        message_callback(resp_msg)

    def handle_unsubscribe_message(self, msg, message_callback):
        if hasattr(message_callback, 'im_self') and message_callback.__self__ is not None:
            owner = message_callback.__self__
        else:
            raise ValueError("Function {} passed to handle_unsubscribe_message() ".format(message_callback.__name__) +
                             "must be a bound method of an object")

        self.unsubscribe(owner, msg['CONTENTS']['TOPICS'])
        resp_msg = msg.copy()
        resp_msg['TOPICS']['type'] = 'unsubscribe_response'
        resp_msg['CONTENTS']['status'] = 'ok'

        # send the reply
        message_callback(resp_msg)

    def cleanup(self, stop_reactor=True):
        """
        called on exit to clean up the parlay environment
        """
        print("Cleaning Up")
        self._stopped.callback(None)
        if stop_reactor:
            self.reactor.stop()
        print("Exiting...")

    @staticmethod
    def get_local_ip():
        """
        :return: IP address of this machine on the LAN
        Solution sourced from https://stackoverflow.com/a/28950776/2126242
        """
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # IP address and port are just stand-ins. A successful connection is not necessary.
            s.connect(('10.255.255.255', 1))
            ip = s.getsockname()[0]
        except:
            ip = 'UNKNOWN'
        finally:
            s.close()
        return ip

    def run(self, mode=Modes.DEVELOPMENT, ssl_only=False, use_ssl=False, open_browser=True, ui_path=None,
            ui_caching=False, default_ip="127.0.0.1"):
        """
        Start up and run the broker. This method call with not return
        """
        from parlay.protocols.websocket import WebSocketServerAdapter
        import webbrowser

        # cleanup on sigint
        signal.signal(signal.SIGINT, lambda sig, frame: self.cleanup())

        if mode == Broker.Modes.DEVELOPMENT:
            print("INFO: Broker running in DEVELOPER mode. This is fine for a development environment")
            print(("INFO: For production systems run the Broker in PRODUCTION mode. e.g.: " + \
                  "broker.run(mode=Broker.Modes.PRODUCTION)"))
            # print out the local ip to access this broker from
            print(("This device is remotely accessible at http://" + self.get_local_ip() + ":" + str(self.http_port)))

        self._run_mode = mode

        # interface to listen on. In Development mode listen on everything
        # in production mode, only listen on localhost
        interface = '127.0.0.1' if mode == Broker.Modes.PRODUCTION else ""

        # UI path
        if ui_path is not None:
            root = static.File(ui_path)
            # root.putChild("parlay", static.File(PARLAY_PATH + "/ui"))
        else:
            root = static.File(PARLAY_PATH + "/ui/dist")
            # root.putChild("docs", static.File(PARLAY_PATH + "/docs/_build/html"))

        # ssl websocket
        if use_ssl:
            try:
                from OpenSSL.SSL import Context
                ssl_context_factory = BrokerSSlContextFactory()

                factory = WebSocketServerFactory("wss://localhost:" + str(self.secure_websocket_port))
                factory.protocol = WebSocketServerAdapter
                factory.setProtocolOptions()
                listenWS(factory, ssl_context_factory, interface=interface)
                root.contentTypes['.crt'] = 'application/x-x509-ca-cert'
                self.reactor.listenSSL(self.https_port, CacheControlledSite(ui_caching, root), ssl_context_factory,
                                       interface=interface)

            except ImportError:
                print("WARNING: PyOpenSSL is *not* installed. Parlay cannot host HTTPS or WSS without PyOpenSSL")
            except Exception as e:
                print(("WARNING: PyOpenSSL has had an error: " + str(e)))
                if ssl_only:
                    raise

        if not ssl_only:
            # listen for websocket connections on port 16185
            factory = WebSocketServerFactory("ws://localhost:" + str(self.websocket_port))
            factory.protocol = WebSocketServerAdapter
            try:
                self.reactor.listenTCP(self.websocket_port, factory, interface=interface)
                # http server
                self.reactor.listenTCP(self.http_port, CacheControlledSite(ui_caching, root), interface=interface)
                if open_browser:
                    # give the reactor some time to init before opening the browser
                    self.reactor.callLater(.5, lambda: webbrowser.open_new_tab("http://" + default_ip + ":"
                                                                               + str(self.http_port)))
            except twisted.internet.error.CannotListenError:
                sys.exit(portErr)

        # add advertising
        if Broker.get_local_ip() != 'UNKNOWN':
            try:
                reactor.listenMulticast(self.websocket_port, advertiser.ParlayAdvertiser(),
                                listenMultiple=True)
            except MulticastJoinError as err:
                self._logger("{0}".format(err))

        self.reactor.callWhenRunning(self._started.callback, None)
        self.reactor.run()

try:
    from twisted.internet import ssl


    class BrokerSSlContextFactory(ssl.ContextFactory):
        """
        A more secure context factory than the default one. Only supports high security encryption ciphers and exchange
        formats. Last Updated August 2015
        """

        def getContext(self):
            """Return a SSL.Context object. override in subclasses."""

            ssl_context_factory = ssl.DefaultOpenSSLContextFactory(PARLAY_PATH + '/keys/broker.key',
                                                                   PARLAY_PATH + '/keys/broker.crt')
            # We only want to use 'High' and 'Medium' ciphers, not 'Weak' ones. We want *actual* security here.
            ssl_context = ssl_context_factory.getContext()
            # perfect forward secrecy ciphers
            ssl_context.set_cipher_list(
                'EECDH+ECDSA+AESGCM EECDH+aRSA+AESGCM EECDH+ECDSA+SHA384 EECDH+ECDSA+SHA256 EECDH' +
                '+aRSA+SHA384 EECDH+aRSA+SHA256 EECDH+aRSA+RC4 EECDH EDH+aRSA RC4 !aNULL' +
                '!eNULL !LOW !3DES !MD5 !EXP !PSK !SRP !DSS')
            return ssl_context

except ImportError:
    print("WARNING: PyOpenSSL is *not* installed. Parlay cannot host HTTPS or WSS without PyOpenSSL")
except Exception as e:
    print(("WARNING: PyOpenSSL has had an error: " + str(e)))


def run_in_broker(fn):
    """
    Decorator: Wrap any method in this when you want to be sure it's called from the broker thread.
    If in a background thread, it will block until completion. If already in a reactor thread, then no change
    """
    from parlay.server.reactor import run_in_reactor
    @functools.wraps(fn)
    def decorator(*args, **kwargs):
        reactor = Broker.get_instance().reactor
        return run_in_reactor(reactor)(fn)(*args, **kwargs)

    return decorator


def run_in_thread(fn):
    """
    Decorator: Wrap any method in this when you want to be sure it's called from a background thread .
    If in a background thread, no change. If in the broker thread, will move to background thread and return deferred
    with result.
    """
    from parlay.server.reactor import run_in_thread

    @functools.wraps(fn)
    def decorator(*args, **kwargs):
        reactor = Broker.get_instance().reactor
        return run_in_thread(reactor)(fn)(*args, **kwargs)

    return decorator

def main():
    #d = Broker(reactor)
    print("\n Broker is running...\n")
    Broker.start()


if __name__ == "__main__":
    main()
