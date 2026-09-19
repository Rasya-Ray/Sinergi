from schemas.security import ClassifyResult


class DomainClassifier:
    HIGH_RISK_KEYWORDS = [
        "porn", "xxx", "sex", "nude", "naked", "hentai", "boobs",
        "nsfw", "erotic", "strip", "cam4", "chaturbate", "livejasmin",
        "tube8", "redtube", "youporn", "xvideo", "xnxx", "brazzers",
        "bangbros", "onlyfans", "stripchat", "bongacams", "myfreecams",
        "flirt4free", "camsoda", "rule34", "e621", "gelbooru",
        "gambling", "casino", "poker", "betting", "slot",
        "phishing", "malware", "ransomware", "trojan",
    ]

    def classify(self, domain: str) -> ClassifyResult:
        d = domain.lower().strip(".")

        # Check for adult/malicious keywords
        matched = [kw for kw in self.HIGH_RISK_KEYWORDS if kw in d]

        if matched:
            return ClassifyResult(
                domain=domain,
                risk="HIGH",
                score=0.95,
                warning=f"Domain mengandung kata kunci berisiko: {', '.join(matched)}",
                categories=["adult"] if any(k in ["porn", "xxx", "sex", "nude", "hentai"] for k in matched) else ["potentially_unsafe"],
                confidence=0.95,
            )

        # Check for suspicious TLDs
        suspicious_tlds = [".xyz", ".top", ".buzz", ".click", ".link"]
        if any(d.endswith(tld) for tld in suspicious_tlds):
            return ClassifyResult(
                domain=domain,
                risk="MEDIUM",
                score=0.4,
                warning=f"Domain menggunakan TLD yang sering disalahgunakan",
                categories=["suspicious_tld"],
                confidence=0.4,
            )

        return ClassifyResult(
            domain=domain,
            risk="LOW",
            score=0.1,
            warning="Tidak ditemukan indikator risiko signifikan",
            categories=[],
            confidence=0.3,
        )
