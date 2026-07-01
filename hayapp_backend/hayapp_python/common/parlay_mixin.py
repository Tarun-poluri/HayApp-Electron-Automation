"""
Mixin for ParlayCommandItem subclasses that call send_event / publish from
background threads.

Twisted is single-threaded: all broker I/O (including WebSocket writes to the
frontend) must be driven from the reactor thread.

The Parlay call chain is:

    send_event(info, event, description)
      → send_message(...)
        → self.publish(msg)
          → self._adapter.publish(msg, callback)
            → broker.publish(msg)  ← WebSocket writes happen here

None of these methods have a thread-safety guard.  When called from a daemon
thread, a transport callback, or a @parlay_command thread, the broker.publish
fires on the wrong thread — WebSocket writes are silently dropped and the
frontend never receives the event.

This mixin overrides ``publish()`` so that calls from non-reactor threads are
routed through ``reactor.callFromThread()``.  Because send_event → send_message
→ self.publish(), intercepting ``publish`` catches all event delivery.

Usage
-----
Add ThreadSafePublishMixin as the *first* base class before ParlayCommandItem:

    class MyItem(ThreadSafePublishMixin, ParlayCommandItem):
        ...

No special __init__ changes required — ParlayCommandItem does not bind
publish or send_event on the instance, so MRO resolution finds the mixin's
override correctly.
"""


class ThreadSafePublishMixin:
    """Override publish to always execute on the Twisted reactor thread."""

    def publish(self, msg):
        if self._reactor.in_reactor_thread():
            super().publish(msg)
        else:
            self._reactor.callFromThread(lambda: super(ThreadSafePublishMixin, self).publish(msg))
