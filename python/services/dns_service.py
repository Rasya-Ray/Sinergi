import dns.resolver
import dns.rdatatype
from typing import Any


class DNSService:
    RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "CAA"]

    def check(self, domain: str) -> dict[str, Any]:
        result: dict[str, Any] = {
            "domain": domain,
            "records": {},
            "spf": None,
            "dmarc": None,
            "dnssec": False,
            "errors": [],
        }

        for rtype in self.RECORD_TYPES:
            try:
                answers = dns.resolver.resolve(domain, rtype)
                result["records"][rtype] = [str(r) for r in answers]
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
                result["records"][rtype] = []
            except Exception as e:
                result["errors"].append(f"{rtype}: {str(e)}")
                result["records"][rtype] = []

        try:
            txt_records = dns.resolver.resolve(domain, "TXT")
            for r in txt_records:
                txt = str(r).strip('"')
                if txt.startswith("v=spf1"):
                    result["spf"] = txt
                if txt.startswith("v=DMARC1"):
                    result["dmarc"] = txt
        except Exception:
            pass

        try:
            answers = dns.resolver.resolve(domain, "DNSKEY")
            result["dnssec"] = len(list(answers)) > 0
        except Exception:
            result["dnssec"] = False

        return result
