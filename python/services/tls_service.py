import ssl
import socket
from datetime import datetime
from typing import Any


class TLSService:
    def check(self, domain: str, port: int = 443) -> dict[str, Any]:
        result: dict[str, Any] = {
            "domain": domain,
            "port": port,
            "valid": False,
            "issuer": None,
            "subject": None,
            "san": [],
            "expiry": None,
            "days_remaining": None,
            "version": None,
            "cipher": None,
            "chain": [],
            "error": None,
        }

        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=domain) as s:
                s.settimeout(10)
                s.connect((domain, port))
                cert = s.getpeercert()
                result["valid"] = True
                result["version"] = s.version()
                result["cipher"] = s.cipher()[0] if s.cipher() else None

                if "issuer" in cert:
                    result["issuer"] = dict(x[0] for x in cert["issuer"])
                if "subject" in cert:
                    result["subject"] = dict(x[0] for x in cert["subject"])

                san = cert.get("subjectAltName", ())
                result["san"] = [v for t, v in san if t == "DNS"]

                if "notAfter" in cert:
                    expiry = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
                    result["expiry"] = expiry.isoformat()
                    result["days_remaining"] = (expiry - datetime.utcnow()).days

                chain = s.get_peer_cert_chain()
                if chain:
                    result["chain"] = [
                        {
                            "subject": dict(x[0] for x in c.get("subject", ())),
                            "issuer": dict(x[0] for x in c.get("issuer", ())),
                        }
                        for c in chain
                    ]

        except ssl.SSLCertVerificationError as e:
            result["error"] = f"Certificate verification failed: {str(e)}"
        except ssl.SSLError as e:
            result["error"] = f"SSL error: {str(e)}"
        except socket.timeout:
            result["error"] = "Connection timed out"
        except socket.gaierror:
            result["error"] = f"Cannot resolve domain: {domain}"
        except Exception as e:
            result["error"] = f"Unexpected error: {str(e)}"

        return result
