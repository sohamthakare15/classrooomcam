"""
ONVIF Camera WS-Discovery & Local Subnet Probe Module.
Discovers IP cameras and Network Video Transmitters on the local Wi-Fi / LAN
using standard WS-Discovery (OASIS standard over UDP multicast 239.255.255.250:3702)
and rapid socket port detection. Zero external library dependencies.
"""
import socket
import uuid
import re
import xml.etree.ElementTree as ET
import urllib.parse
from typing import List, Dict, Any, Optional

WS_DISCOVERY_PROBE_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope"
          xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
          xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
          xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <Header>
    <wsa:MessageID>uuid:{message_id}</wsa:MessageID>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005/04/discovery</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
  </Header>
  <Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </Body>
</Envelope>"""

COMMON_CAMERA_PRESETS = {
    "CPPLUS": {"stream_path": "/cam/realmonitor?channel=1&subtype=0", "port": 554},
    "CP Plus": {"stream_path": "/cam/realmonitor?channel=1&subtype=0", "port": 554},
    "Hikvision": {"stream_path": "/Streaming/Channels/101", "port": 554},
    "Dahua": {"stream_path": "/cam/realmonitor?channel=1&subtype=0", "port": 554},
    "TP-Link Tapo": {"stream_path": "/stream1", "port": 554},
    "Reolink": {"stream_path": "/h264Preview_01_main", "port": 554},
    "Amcrest": {"stream_path": "/cam/realmonitor?channel=1&subtype=0", "port": 554},
    "Generic": {"stream_path": "/live/ch0", "port": 554}
}

class ONVIFDiscovery:
    """Discovers ONVIF and RTSP video endpoints on the local subnet."""

    @staticmethod
    def discover_cameras(timeout_sec: float = 2.5) -> List[Dict[str, Any]]:
        """
        Broadcasts WS-Discovery multicast probe and collects responses.
        Returns a deduplicated list of discovered camera objects.
        """
        discovered = {}
        msg_id = str(uuid.uuid4())
        probe_payload = WS_DISCOVERY_PROBE_TEMPLATE.format(message_id=msg_id).encode("utf-8")

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        sock.settimeout(timeout_sec)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 4)

        try:
            # Broadcast to ONVIF WS-Discovery Multicast Group
            sock.sendto(probe_payload, ("239.255.255.250", 3702))
        except Exception as e:
            print(f"[ONVIFDiscovery] WS-Discovery broadcast send error: {e}")
            sock.close()
            return []

        # Listen for ProbeMatches
        while True:
            try:
                data, addr = sock.recvfrom(65535)
                camera_info = ONVIFDiscovery._parse_probe_response(data.decode("utf-8", errors="ignore"), addr[0])
                if camera_info and camera_info["ip"]:
                    discovered[camera_info["ip"]] = camera_info
            except socket.timeout:
                break
            except Exception as e:
                print(f"[ONVIFDiscovery] Error reading probe reply: {e}")
                break

        sock.close()
        return list(discovered.values())

    @staticmethod
    def _parse_probe_response(xml_text: str, sender_ip: str) -> Optional[Dict[str, Any]]:
        """Extracts XAddrs, scopes, model, and endpoint information from WS-Discovery XML."""
        try:
            # Fallback regex extraction if namespaces cause XML parsing hiccups
            xaddrs_match = re.search(r"<(?:\w+:)?XAddrs>(.*?)</(?:\w+:)?XAddrs>", xml_text, re.DOTALL)
            scopes_match = re.search(r"<(?:\w+:)?Scopes>(.*?)</(?:\w+:)?Scopes>", xml_text, re.DOTALL)

            xaddrs = xaddrs_match.group(1).strip() if xaddrs_match else ""
            scopes = scopes_match.group(1).strip() if scopes_match else ""

            # Extract IP from XAddrs URL or sender address
            ip = sender_ip
            onvif_port = 80
            if xaddrs:
                urls = xaddrs.split()
                if urls:
                    parsed = urllib.parse.urlparse(urls[0])
                    if parsed.hostname:
                        ip = parsed.hostname
                    if parsed.port:
                        onvif_port = parsed.port

            # Parse manufacturer / model from scopes
            manufacturer = "Generic ONVIF Camera"
            model = ""
            for scope in scopes.split():
                if "onvif://www.onvif.org/name/" in scope:
                    manufacturer = urllib.parse.unquote(scope.split("name/")[-1])
                elif "onvif://www.onvif.org/hardware/" in scope:
                    model = urllib.parse.unquote(scope.split("hardware/")[-1])

            display_name = f"{manufacturer} {model}".strip() if model else manufacturer
            if not display_name or display_name == "Generic ONVIF Camera":
                display_name = f"IP Camera ({ip})"

            # Identify recommended stream path based on brand match
            recommended_path = "/live/ch0"
            for brand, conf in COMMON_CAMERA_PRESETS.items():
                if brand.lower() in display_name.lower():
                    recommended_path = conf["stream_path"]
                    break

            return {
                "ip": ip,
                "rtsp_port": 554,
                "onvif_port": onvif_port,
                "name": display_name,
                "xaddrs": xaddrs,
                "recommended_stream_path": recommended_path,
                "raw_scopes": scopes
            }
        except Exception:
            return None

    @staticmethod
    def probe_rtsp_port(ip: str, port: int = 554, timeout: float = 1.5) -> bool:
        """Rapid TCP handshake check to verify if the camera's RTSP port is open."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            res = s.connect_ex((ip, port))
            s.close()
            return res == 0
        except Exception:
            return False
