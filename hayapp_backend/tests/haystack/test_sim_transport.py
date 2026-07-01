"""Tests for SimTransport simulated port list (scan_ports / sim_connect / sim_disconnect)."""

from unittest.mock import MagicMock

import pytest

from hayapp_python.items.haystack.sim_transport import SimTransport


@pytest.fixture
def sim_transport():
    t = SimTransport(response_processor=lambda c, p: None)
    t._adapter = MagicMock()
    return t


def test_scan_ports_default_empty(sim_transport):
    assert sim_transport.scan_ports() == []


def test_sim_connect_adds_port(sim_transport):
    assert sim_transport.sim_connect() == ["SIM"]
    assert sim_transport.scan_ports() == ["SIM"]


def test_sim_connect_second_port_and_idempotent(sim_transport):
    sim_transport.sim_connect("SIM")
    assert sim_transport.sim_connect("SIM2") == ["SIM", "SIM2"]
    assert sim_transport.sim_connect("SIM") == ["SIM", "SIM2"]


def test_sim_disconnect_clears_ports(sim_transport):
    sim_transport.sim_connect("A")
    sim_transport.sim_connect("B")
    assert sim_transport.sim_disconnect() == []
    assert sim_transport.scan_ports() == []
